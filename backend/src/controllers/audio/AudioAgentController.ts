// backend/src/controllers/audio/AudioAgentController.ts
import { Request, Response } from "express";
import { audioAgent } from "@/agents/audio/audio-agent";
import { AudioAgentChatContractType } from "@/contracts/api/AudioAgentContracts";
import { ValidatedRequest } from "@/types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

interface AgentResult {
  messages: AIMessage[];
  conversationState: {
    phase: string;
    step: number;
  };
  historyLength: number;
  audioGenerated: boolean;
  audioUrl?: string;
  collectedInfo?: string[];
  sessionData?: any;
}

interface AnalysisResult {
  needsMoreInfo: boolean;
  missingInfo: string[];
  suggestions: string[];
  nextSteps: string[];
  canProceed: boolean;
  readyToGenerate: boolean;
  currentQuestion?: string;
  expectedResponseType?: string;
}

export class AudioAgentController {
  private static analysisLLM = new ChatOpenAI({
    temperature: 0.3,
    modelName: "local-model",
    openAIApiKey: "lm-studio",
    configuration: {
      baseURL: process.env.LM_STUDIO_URL || "http://localhost:1234/v1",
    },
  });

  static async chat(request: Request, response: Response): Promise<void> {
    console.log("🎯 === DEBUT AudioAgentController.chat ===");

    try {
      const validatedRequest = request as ValidatedRequest<AudioAgentChatContractType>;
      const { message, sessionId, context } = validatedRequest.validated.body;

      const finalSessionId = sessionId || `session_${Date.now()}`;

      console.log("📦 Données reçues:", {
        message: message?.slice(0, 100),
        sessionId: finalSessionId,
        context,
        hasContext: !!context
      });

      const config = {
        configurable: {
          thread_id: finalSessionId,
        },
      };

      // Créer le message utilisateur
      const userMessage = new HumanMessage(message);

      console.log("🚀 Envoi à l'agent...");

      const result = await audioAgent.invoke(
        { messages: [userMessage] },
        config
      ) as AgentResult;

      const responseContent = result.messages[0].content;
      const conversationState = result.conversationState;

      console.log("📝 Réponse agent:", responseContent?.slice(0, 200));
      console.log("📊 État conversation:", conversationState);
      console.log("🎵 Audio généré:", result.audioGenerated);

      // Normaliser la phase pour le frontend
      const normalizedPhase = AudioAgentController.normalizePhase(conversationState?.phase);

      // Analyser la réponse avec le LLM
      const analysis = await AudioAgentController.analyzeWithLLM(
        responseContent as string,
        conversationState,
        result.sessionData || {},
        message
      );

      // Construire la réponse enrichie
      const responseData = {
        success: true,
        sessionId: finalSessionId,
        response: responseContent,
        needsMoreInfo: analysis.needsMoreInfo,
        missingInfo: analysis.missingInfo,
        suggestions: analysis.suggestions,
        nextSteps: analysis.nextSteps,
        canProceed: analysis.canProceed,
        readyToGenerate: analysis.readyToGenerate,
        conversationLength: result.historyLength,
        collectedInfo: result.collectedInfo || [],
        phase: normalizedPhase,

        // Informations audio avec structure correcte pour le frontend
        audioGenerated: result.audioGenerated || false,
        audioData: result.audioGenerated && result.audioUrl ? {
          url: result.audioUrl,
          filename: result.audioUrl.split('/').pop() || 'audio.wav',
          mimeType: 'audio/wav',
          duration: result.sessionData?.duration || 10
        } : null,
        context: result.sessionData || {},

        // Métadonnées de session
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now(),
          messageCount: result.historyLength,
          hasAudioContent: !!result.audioUrl
        }
      };

      // Log de la réponse finale
      console.log("🎯 Réponse finale:", {
        success: responseData.success,
        phase: responseData.phase,
        audioGenerated: responseData.audioGenerated,
        collectedInfoCount: responseData.collectedInfo.length
      });

      response.status(200).json(responseData);

    } catch (error: unknown) {
      console.error("❌ Erreur dans AudioAgentController.chat:", error);

      // Déterminer le type d'erreur et le code de statut approprié
      let statusCode = 500;
      let errorType = "INTERNAL_ERROR";
      let userMessage = "Erreur lors de la communication avec l'agent audio";

      if (error instanceof Error) {
        if (error.message.includes("Thread ID")) {
          statusCode = 400;
          errorType = "INVALID_SESSION";
          userMessage = "Identifiant de session invalide";
        } else if (error.message.includes("timeout") || error.message.includes("network")) {
          statusCode = 503;
          errorType = "SERVICE_UNAVAILABLE";
          userMessage = "Service temporairement indisponible";
        } else if (error.message.includes("rate limit")) {
          statusCode = 429;
          errorType = "RATE_LIMIT";
          userMessage = "Trop de requêtes, veuillez patienter";
        }
      }

      const errorResponse = {
        success: false,
        error: userMessage,
        errorType,
        details: error instanceof Error ? error.message : "Erreur inconnue",
        timestamp: new Date().toISOString(),
        suggestions: [
          "Vérifiez votre connexion internet",
          "Réessayez dans quelques instants",
          "Contactez le support si le problème persiste"
        ]
      };

      console.log("📤 Réponse d'erreur:", errorResponse);
      response.status(statusCode).json(errorResponse);
    }
  }

  /**
   * Normalise les phases pour le frontend
   */
  private static normalizePhase(phase: string | undefined): string {
    if (!phase) return 'discovery';

    const phaseMapping: Record<string, string> = {
      'error': 'clarification',
      'complete': 'complete',
      'discovery': 'discovery',
      'clarification': 'clarification',
      'generation': 'generation'
    };

    return phaseMapping[phase.toLowerCase()] || 'clarification';
  }

  /**
   * Analyse intelligente de la réponse de l'agent avec LLM
   */
  private static async analyzeWithLLM(
    agentResponse: string,
    state: any,
    sessionData: any = {},
    userMessage: string
  ): Promise<AnalysisResult> {
    const prompt = `Tu es un assistant qui analyse les conversations d'un agent audio. 
Analyse cette conversation et retourne un JSON avec les informations demandées.

Réponse de l'agent : "${agentResponse}"
Dernier message utilisateur : "${userMessage}"
Phase actuelle : ${state?.phase || 'unknown'}
Données collectées : ${JSON.stringify(sessionData)}

Analyse et retourne UNIQUEMENT un JSON avec cette structure exacte :
{
  "needsMoreInfo": boolean (true si l'agent pose une question),
  "missingInfo": ["liste des informations manquantes"],
  "suggestions": ["3 suggestions pertinentes basées sur la question posée par l'agent"],
  "nextSteps": ["2-3 prochaines étapes logiques"],
  "canProceed": boolean (true si on peut continuer),
  "readyToGenerate": boolean (true si prêt à générer l'audio),
  "currentQuestion": "la question posée par l'agent (si applicable)",
  "expectedResponseType": "type de réponse attendue (texte, choix, confirmation, etc.)"
}

Les suggestions doivent être des réponses possibles à la question de l'agent, pas des actions génériques.
Par exemple :
- Si l'agent demande le public cible -> suggestions: ["Grand public", "Professionnels", "Enfants"]
- Si l'agent demande le style -> suggestions: ["Dynamique et enjoué", "Calme et posé", "Professionnel"]
- Si l'agent demande le texte -> suggestions: ["Coller mon texte", "Créer un nouveau texte", "Utiliser un modèle"]`;

    try {
      console.log("🤖 Analyse LLM en cours...");
      const response = await this.analysisLLM.invoke(prompt);
      const content = response.content as string;
      
      // Extraire le JSON de la réponse
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as AnalysisResult;
        
        // Validation et enrichissement des suggestions basées sur le contexte
        if (analysis.currentQuestion) {
          analysis.suggestions = await this.generateContextualSuggestions(
            analysis.currentQuestion,
            agentResponse,
            sessionData
          );
        }
        
        console.log("✅ Analyse LLM complétée:", analysis);
        return analysis;
      }
    } catch (error) {
      console.error("❌ Erreur analyse LLM:", error);
    }

    // Fallback si l'analyse LLM échoue
    return this.fallbackAnalysis(agentResponse, state, sessionData);
  }

  /**
   * Génère des suggestions contextuelles basées sur la question
   */
  private static async generateContextualSuggestions(
    currentQuestion: string,
    agentResponse: string,
    sessionData: any
  ): Promise<string[]> {
    const lowerQuestion = currentQuestion.toLowerCase();
    const lowerResponse = agentResponse.toLowerCase();

    // Détection intelligente du type de question et suggestions appropriées
    if (lowerQuestion.includes('public') || lowerQuestion.includes('audience')) {
      return ["Jeunes adultes (18-35 ans)", "Familles avec enfants", "Professionnels B2B"];
    }
    
    if (lowerQuestion.includes('voix') || lowerQuestion.includes('préfér')) {
      return ["Voix féminine chaleureuse", "Voix masculine professionnelle", "Peu importe"];
    }
    
    if (lowerQuestion.includes('style') || lowerQuestion.includes('ton') || lowerQuestion.includes('ambiance')) {
      return ["Dynamique et motivant", "Calme et rassurant", "Professionnel et sérieux"];
    }
    
    if (lowerQuestion.includes('texte') || lowerResponse.includes('quel est le texte')) {
      return ["J'ai déjà mon texte", "Aidez-moi à en créer un", "J'ai besoin de conseils"];
    }
    
    if (lowerResponse.includes('on lance') || lowerResponse.includes('générer')) {
      return ["Oui, c'est parfait !", "Attendez, je veux modifier", "Go ! Lance la génération"];
    }
    
    if (lowerQuestion.includes('type') || lowerQuestion.includes('projet')) {
      return ["Publicité radio", "Podcast ou narration", "Formation e-learning"];
    }

    // Suggestions par défaut si aucune correspondance
    return [
      "Continuez avec vos questions",
      "J'ai besoin de plus d'infos",
      "Passons à l'étape suivante"
    ];
  }

  /**
   * Analyse de fallback si le LLM échoue
   */
  private static fallbackAnalysis(
    agentResponse: string,
    state: any,
    sessionData: any
  ): AnalysisResult {
    const lowerResponse = agentResponse.toLowerCase();
    const hasQuestion = agentResponse.includes('?');
    const isReadyToGenerate = lowerResponse.includes('on lance') || 
                             lowerResponse.includes('générer') ||
                             lowerResponse.includes('prêt');
    const audioGenerated = lowerResponse.includes('audio') && 
                          (lowerResponse.includes('généré') || 
                           lowerResponse.includes('prêt'));

    return {
      needsMoreInfo: hasQuestion && !isReadyToGenerate && !audioGenerated,
      missingInfo: !sessionData?.textContent ? ['Texte à vocaliser'] : [],
      suggestions: [
        "Répondez naturellement",
        "Donnez plus de détails",
        "Passez à l'étape suivante"
      ],
      nextSteps: audioGenerated 
        ? ["Écouter l'audio", "Télécharger", "Créer un nouveau"]
        : ["Continuer la conversation", "Fournir les informations demandées"],
      canProceed: isReadyToGenerate || audioGenerated,
      readyToGenerate: isReadyToGenerate || audioGenerated
    };
  }

  static async generateProject(request: Request, response: Response): Promise<void> {
    console.log("🎯 generateProject appelé");
    response.status(501).json({
      error: "Fonctionnalité en développement",
      message: "La génération de projet complète sera bientôt disponible"
    });
  }

  /**
   * Endpoint pour vider l'historique d'une session
   */
  static async clearHistory(request: Request, response: Response): Promise<void> {
    try {
      const { sessionId } = request.body;

      if (!sessionId) {
        response.status(400).json({
          success: false,
          error: "sessionId requis"
        });
        return;
      }

      audioAgent.clearHistory(sessionId);
      console.log("🗑️ Historique supprimé pour session:", sessionId);

      response.json({
        success: true,
        message: "Historique supprimé avec succès",
        sessionId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("❌ Erreur lors de la suppression:", error);
      response.status(500).json({
        success: false,
        error: "Erreur lors de la suppression de l'historique",
        details: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  /**
   * Endpoint pour obtenir le statut d'une session
   */
  static async getSessionStatus(request: Request, response: Response): Promise<void> {
    try {
      const { sessionId } = request.params;

      // Cette méthode pourrait être ajoutée à l'agent pour obtenir le statut
      // Pour le moment, on retourne un statut basique
      response.json({
        success: true,
        sessionId,
        status: "active",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      response.status(500).json({
        success: false,
        error: "Erreur lors de la récupération du statut"
      });
    }
  }
}