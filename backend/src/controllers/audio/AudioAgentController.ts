// backend/src/controllers/audio/AudioAgentController.ts
import { Request, Response } from "express";
import { audioAgent } from "@/agents/audio/audio-agent";
import { AudioAgentChatContractType } from "@/contracts/api/AudioAgentContracts";
import { ValidatedRequest } from "@/types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

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

      // Analyser la réponse pour déterminer les actions possibles
      const analysis = AudioAgentController.analyzeAgentResponse(
        responseContent as string,
        conversationState,
        result.sessionData || {}
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

        // Informations audio
        audioGenerated: result.audioGenerated || false,
        audioUrl: result.audioUrl || null,
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
   * Analyse intelligente de la réponse de l'agent
   */
  private static analyzeAgentResponse(
    content: string,
    state: any,
    sessionData: any = {}
  ): {
    needsMoreInfo: boolean;
    missingInfo: string[];
    suggestions: string[];
    nextSteps: string[];
    canProceed: boolean;
    readyToGenerate: boolean;
  } {
    const lowerContent = content.toLowerCase();

    // Déterminer les infos manquantes
    const missingInfo = [];
    if (!sessionData?.textContent) {
      missingInfo.push('Texte à vocaliser');
    }

    // Indicateurs que l'agent pose des questions
    const askingQuestions = /\?/.test(content) && !lowerContent.includes('on lance');

    // Indicateurs que l'agent est prêt à générer
    const readyToGenerate =
      (lowerContent.includes('on lance') ||
        lowerContent.includes('générer') ||
        lowerContent.includes('prêt') ||
        lowerContent.includes('go')) &&
      sessionData?.textContent;

    // Indicateurs qu'un audio a été généré
    const audioGenerated =
      lowerContent.includes('audio') &&
      (lowerContent.includes('généré') ||
        lowerContent.includes('prêt') ||
        lowerContent.includes('voilà'));

    const needsMoreInfo = askingQuestions && !readyToGenerate && !audioGenerated;
    const canProceed = readyToGenerate || audioGenerated;

    // Générer des suggestions contextuelles
    let suggestions: string[] = [];
    let nextSteps: string[] = [];

    if (audioGenerated) {
      suggestions = [
        "L'audio est prêt !",
        "Tu peux l'écouter et le télécharger",
        "Dis 'nouveau' pour créer un autre audio"
      ];
      nextSteps = [
        "Écouter l'audio",
        "Télécharger",
        "Créer un nouveau"
      ];
    } else if (readyToGenerate) {
      suggestions = [
        "Tout est prêt pour générer",
        "Réponds 'oui' ou 'go' pour lancer",
        "Tu peux encore modifier si besoin"
      ];
      nextSteps = [
        "Confirmer la génération",
        "Modifier les paramètres"
      ];
    } else {
      suggestions = [
        "Continue la conversation naturellement",
        "L'assistant te guide étape par étape",
        "Pas besoin de tout dire d'un coup"
      ];
      nextSteps = [
        "Répondre à la question",
        "Fournir plus de détails"
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