// backend/src/controllers/audio/AudioAgentController.ts
import { Request, Response } from "express";
import { audioAgent } from "@/agents/audio/audio-agent";
import { AudioAgentChatContractType } from "@/contracts/api/AudioAgentContracts";
import { ValidatedRequest } from "@/types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

interface AgentResult {
  messages: AIMessage[];
  conversationState: AudioAgentControllerState;
  historyLength: number;
  audioGenerated: boolean;
  audioUrl: any;
  context?: {
    textContent?: string;
    targetAudience?: string;
    voicePreference?: string;
    emotionStyle?: string;
    projectType?: string;
  };
}

interface AudioAgentControllerState {
  phase: string;
  messageCount: number;
  hasContent: boolean;
  hasAudience: boolean;
  hasDuration: boolean;
  hasStyle: boolean;
  hasContext: boolean;
  hasVoice: boolean;  // Ajouté car utilisé dans analyzeAgentResponse
  collectedInfo: never[];
}

interface AudioAgentResponse {
  messages: AIMessage[];
  conversationState: AudioAgentControllerState;
  historyLength: number;
  audioGenerated: boolean;
  audioUrl: any;
  context: {
    textContent?: string;
    targetAudience?: string;
    voicePreference?: string;
    emotionStyle?: string;
    projectType?: string;
  };
}

export class AudioAgentController {
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

      // Ne PAS modifier le message avec le contexte - laisser l'agent analyser naturellement
      console.log("📝 Message original envoyé à l'agent:", message);

      // Créer le message utilisateur sans modification
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

      // Analyser la réponse pour déterminer les actions possibles
      const analysis = AudioAgentController.analyzeAgentResponse(
        responseContent as string,
        conversationState,
        result.context || {} // Utilisation d'un objet vide par défaut
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
        collectedInfo: conversationState?.collectedInfo || [],
        phase: conversationState?.phase || 'discovery',

        // Nouvelles informations enrichies
        audioGenerated: result.audioGenerated || false,
        audioUrl: result.audioUrl || null,
        context: result.context || {},

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
   * Analyse intelligente de la réponse de l'agent avec contexte enrichi
   */
  private static analyzeAgentResponse(
    content: string,
    state: any,
    context: any = {}
  ): {
    needsMoreInfo: boolean;
    missingInfo: string[];
    suggestions: string[];
    nextSteps: string[];
    canProceed: boolean;
    readyToGenerate: boolean;
  } {
    const lowerContent = content.toLowerCase();

    // Déterminer les infos manquantes basé sur l'état et le contexte
    const missingInfo = [];
    if (!state?.hasContent && !context?.textContent) {
      missingInfo.push('Contenu à vocaliser');
    }
    if (!state?.hasAudience && !context?.targetAudience) {
      missingInfo.push('Public cible');
    }
    if (!state?.hasVoice && !context?.voicePreference) {
      missingInfo.push('Type de voix');
    }
    if (!state?.hasStyle && !context?.emotionStyle) {
      missingInfo.push('Style/ton');
    }
    if (!state?.hasContext && !context?.projectType) {
      missingInfo.push('Contexte d\'utilisation');
    }

    // Indicateurs que l'agent pose des questions
    const askingQuestions = [
      /quel.*\?/i,
      /quelle.*\?/i,
      /pouvez-vous/i,
      /pourriez-vous/i,
      /avez-vous/i,
      /me dire/i,
      /préciser/i,
      /plus.*informations/i,
      /\?.*$/m
    ].some(pattern => pattern.test(content));

    // Indicateurs que l'agent est prêt à générer ou a généré
    const readyToGenerate = [
      /générer/i,
      /créer.*audio/i,
      /procéder/i,
      /lancer/i,
      /parfait/i,
      /excellent/i,
      /toutes.*informations/i,
      /prêt/i,
      /maintenant/i,
      /génération.*en.*cours/i
    ].some(pattern => pattern.test(content)) && state?.phase === 'generation';

    // Indicateurs qu'un audio a été généré
    const audioGenerated = [
      /audio.*généré/i,
      /fichier.*créé/i,
      /écouter.*ci-dessous/i,
      /http.*\/audio\//i
    ].some(pattern => pattern.test(content));

    const needsMoreInfo = askingQuestions && !readyToGenerate && !audioGenerated;
    const canProceed = state?.phase === 'generation' || state?.phase === 'complete' || audioGenerated;

    // Générer des suggestions basées sur la phase et le contexte
    let suggestions: string[] = [];
    let nextSteps: string[] = [];

    switch (state?.phase) {
      case 'discovery':
        suggestions = [
          "Décrivez votre projet audio en quelques mots",
          "Mentionnez le type de contenu (pub, formation, etc.)",
          "L'assistant va vous guider étape par étape"
        ];
        nextSteps = [
          "Décrire le projet",
          "Fournir le contexte général"
        ];
        break;

      case 'clarification':
        suggestions = [
          "Répondez à la question posée par l'assistant",
          "Soyez précis dans votre réponse",
          "Une seule information à la fois"
        ];
        nextSteps = [
          "Répondre à la question",
          "Clarifier les détails demandés"
        ];
        break;

      case 'generation':
        if (audioGenerated) {
          suggestions = [
            "L'audio a été généré avec succès",
            "Vous pouvez l'écouter ci-dessus",
            "Demandez des ajustements si nécessaire"
          ];
          nextSteps = [
            "Écouter l'audio",
            "Télécharger le fichier",
            "Demander des modifications"
          ];
        } else {
          suggestions = [
            "L'assistant peut maintenant générer votre audio",
            "Confirmez pour procéder",
            "Vous pourrez écouter et télécharger le résultat"
          ];
          nextSteps = [
            "Confirmer la génération",
            "Générer l'audio",
            "Écouter le résultat"
          ];
        }
        break;

      case 'complete':
        suggestions = [
          "Toutes les informations sont collectées",
          "L'audio est prêt ou généré",
          "Nouvelles variations possibles"
        ];
        nextSteps = [
          "Écouter l'audio final",
          "Télécharger le fichier",
          "Créer des variantes"
        ];
        break;

      default:
        suggestions = [
          "Décrivez ce que vous souhaitez créer",
          "L'assistant vous guidera pas à pas"
        ];
        nextSteps = [
          "Commencer la conversation"
        ];
    }

    return {
      needsMoreInfo,
      missingInfo,
      suggestions,
      nextSteps,
      canProceed,
      readyToGenerate: readyToGenerate || audioGenerated
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