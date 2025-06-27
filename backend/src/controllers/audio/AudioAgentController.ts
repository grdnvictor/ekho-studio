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

      // Vérifier si un audio a été généré
      let audioUrl = null;
      let audioData = null;

      if (result.audioGenerated && result.audioUrl) {
        audioUrl = result.audioUrl;
        audioData = {
          url: audioUrl,
          filename: audioUrl.split('/').pop() || 'audio.wav',
          mimeType: 'audio/wav',
          duration: 10
        };
        console.log("🎵 Audio généré avec URL:", audioUrl);
      }

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

        // Informations audio
        audioGenerated: result.audioGenerated || false,
        audioUrl: audioUrl,
        audioData: audioData,

        context: result.sessionData || {},

        // Métadonnées de session
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: Date.now(),
          messageCount: result.historyLength,
          hasAudioContent: !!audioUrl
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
    try {
      // Analyse directe sans LLM pour plus de rapidité et fiabilité
      const lowerResponse = agentResponse.toLowerCase();
      const analysis: AnalysisResult = {
        needsMoreInfo: false,
        missingInfo: [],
        suggestions: [],
        nextSteps: [],
        canProceed: false,
        readyToGenerate: false,
        currentQuestion: "",
        expectedResponseType: "text"
      };

      // Détection du type de question posée par l'agent
      if (lowerResponse.includes('quel texte')) {
        analysis.needsMoreInfo = true;
        analysis.currentQuestion = "Quel texte veux-tu transformer ?";
        analysis.expectedResponseType = "text";
        analysis.suggestions = [
          "\"Découvrez nos offres exceptionnelles ce week-end !\"",
          "\"Bienvenue dans notre nouveau magasin\"",
          "\"Formation professionnelle en ligne disponible\""
        ];
      } else if (lowerResponse.includes('style') && lowerResponse.includes('🎯')) {
        analysis.needsMoreInfo = true;
        analysis.currentQuestion = "Quel style préfères-tu ?";
        analysis.expectedResponseType = "choice";
        analysis.suggestions = ["Dynamique 🎯", "Calme 😌", "Pro 💼"];
      } else if (lowerResponse.includes('pour qui') && lowerResponse.includes('👦')) {
        analysis.needsMoreInfo = true;
        analysis.currentQuestion = "Pour quel public ?";
        analysis.expectedResponseType = "choice";
        analysis.suggestions = ["Jeunes 👦", "Familles 👨‍👩‍👧", "Pros 👔"];
      } else if (lowerResponse.includes('on génère') || lowerResponse.includes('lance')) {
        analysis.needsMoreInfo = true;
        analysis.currentQuestion = "Prêt à générer ?";
        analysis.expectedResponseType = "confirmation";
        analysis.suggestions = ["Oui, go ! 🚀", "C'est parti ! ✨", "Lance ! 🎵"];
        analysis.readyToGenerate = true;
      } else if (lowerResponse.includes('audio est prêt') || lowerResponse.includes('tadaaa')) {
        analysis.needsMoreInfo = false;
        analysis.canProceed = true;
        analysis.suggestions = ["Nouveau projet ! 🆕", "Super ! 🙏", "J'adore ! ❤️"];
      }

      // Déterminer les infos manquantes
      if (!sessionData.textContent) {
        analysis.missingInfo.push("Le texte à vocaliser");
      }
      if (!sessionData.emotionStyle) {
        analysis.missingInfo.push("Le style");
      }
      if (!sessionData.targetAudience) {
        analysis.missingInfo.push("Le public cible");
      }

      // Prochaines étapes
      if (analysis.readyToGenerate) {
        analysis.nextSteps = ["Confirmer la génération", "L'audio sera créé"];
      } else if (analysis.missingInfo.length > 0) {
        analysis.nextSteps = ["Répondre à la question", "Continuer la conversation"];
      } else {
        analysis.nextSteps = ["Écouter l'audio", "Créer un nouveau projet"];
      }

      analysis.canProceed = analysis.missingInfo.length === 0 || analysis.readyToGenerate;

      console.log("✅ Analyse complétée:", analysis);
      return analysis;
    } catch (error) {
      console.error("❌ Erreur analyse:", error);
      return this.fallbackAnalysis(agentResponse, state, sessionData);
    }
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

    // Détection basée sur les mots-clés de l'agent
    if (lowerResponse.includes('quel texte') || lowerResponse.includes('texte')) {
      return [
        "Voici mon texte : \"Bienvenue chez nous\"",
        "\"Découvrez nos offres exceptionnelles\"",
        "Je veux créer un texte avec vous"
      ];
    }

    if (lowerResponse.includes('style') && (lowerResponse.includes('dynamique') || lowerResponse.includes('calme') || lowerResponse.includes('pro'))) {
      return ["Dynamique 🎯", "Calme 😌", "Pro 💼"];
    }

    if (lowerResponse.includes('pour qui') || lowerResponse.includes('jeunes') || lowerResponse.includes('familles')) {
      return ["Jeunes 👦", "Familles 👨‍👩‍👧", "Pros 👔"];
    }

    if (lowerResponse.includes('génère') || lowerResponse.includes('lance') || lowerResponse.includes('on génère')) {
      return ["Oui, go ! 🚀", "Lance la génération !", "C'est parti !"];
    }

    // Suggestions par défaut basées sur l'état
    if (!sessionData.textContent) {
      return [
        "Publicité : \"Découvrez nos offres\"",
        "Narration : \"Il était une fois\"",
        "Info : \"Bienvenue sur notre service\""
      ];
    }

    return ["Oui", "Continue", "C'est bon"];
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