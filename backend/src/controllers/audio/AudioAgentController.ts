// backend/src/controllers/audio/AudioAgentController.ts
import { Request, Response } from "express";
import { audioAgent } from "@/agents/audio/audio-agent";
import { AudioAgentChatContractType } from "@/contracts/api/AudioAgentContracts";
import { ValidatedRequest } from "@/types";
import { HumanMessage } from "@langchain/core/messages";

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
        context
      });

      const config = {
        configurable: {
          thread_id: finalSessionId,
        },
      };

      // Construire le message avec contexte si fourni
      let fullMessage = message;
      if (context) {
        const contextParts = [];
        if (context.targetAudience) contextParts.push(`Public cible: ${context.targetAudience}`);
        if (context.style) contextParts.push(`Style: ${context.style}`);
        if (context.duration) contextParts.push(`Durée: ${context.duration}s`);
        if (context.emotion) contextParts.push(`Émotion: ${context.emotion}`);

        if (contextParts.length > 0) {
          fullMessage = `${message}\n\nContexte fourni: ${contextParts.join(', ')}`;
        }
      }

      // Créer le message utilisateur
      const userMessage = new HumanMessage(fullMessage);

      console.log("🚀 Envoi à l'agent...");

      const result = await audioAgent.invoke(
        { messages: [userMessage] },
        config
      );

      const responseContent = result.messages[0].content;
      const conversationState = result.conversationState;

      console.log("📝 Réponse agent:", responseContent?.slice(0, 200));
      console.log("📊 État conversation:", conversationState);

      // Analyser la réponse pour déterminer les actions possibles
      const analysis = AudioAgentController.analyzeAgentResponse(
        responseContent as string,
        conversationState
      );

      response.status(200).json({
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
        collectedInfo: conversationState.collectedInfo,
        phase: conversationState.phase
      });

    } catch (error: unknown) {
      console.error("❌ Erreur:", error);

      response.status(500).json({
        success: false,
        error: "Erreur lors de la communication avec l'agent audio",
        details: error instanceof Error ? error.message : undefined,
      });
    }
  }

  /**
   * Analyse intelligente de la réponse de l'agent
   */
  private static analyzeAgentResponse(content: string, state: any): {
    needsMoreInfo: boolean;
    missingInfo: string[];
    suggestions: string[];
    nextSteps: string[];
    canProceed: boolean;
    readyToGenerate: boolean;
  } {
    const lowerContent = content.toLowerCase();

    // Déterminer les infos manquantes basé sur l'état
    const missingInfo = [];
    if (!state.hasContent) missingInfo.push('Contenu à vocaliser');
    if (!state.hasAudience) missingInfo.push('Public cible');
    if (!state.hasDuration) missingInfo.push('Durée souhaitée');
    if (!state.hasStyle) missingInfo.push('Style/ton');
    if (!state.hasContext) missingInfo.push('Contexte d\'utilisation');

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

    // Indicateurs que l'agent est prêt à générer
    const readyToGenerate = [
      /générer/i,
      /créer.*audio/i,
      /procéder/i,
      /lancer/i,
      /parfait/i,
      /excellent/i,
      /toutes.*informations/i,
      /prêt/i,
      /maintenant/i
    ].some(pattern => pattern.test(content)) && state.phase === 'generation';

    const needsMoreInfo = askingQuestions && !readyToGenerate;
    const canProceed = state.phase === 'generation' || state.phase === 'complete';

    // Générer des suggestions basées sur la phase
    let suggestions: string[] = [];
    let nextSteps: string[] = [];

    switch (state.phase) {
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
        break;

      case 'complete':
        suggestions = [
          "Toutes les informations sont collectées",
          "Prêt pour la génération audio",
          "Personnalisations possibles"
        ];
        nextSteps = [
          "Générer l'audio",
          "Télécharger le fichier",
          "Nouvelles variations"
        ];
        break;
    }

    return {
      needsMoreInfo,
      missingInfo,
      suggestions,
      nextSteps,
      canProceed,
      readyToGenerate
    };
  }

  static async generateProject(request: Request, response: Response): Promise<void> {
    response.status(501).json({ error: "Not implemented yet" });
  }

  /**
   * Endpoint pour vider l'historique d'une session
   */
  static async clearHistory(request: Request, response: Response): Promise<void> {
    try {
      const { sessionId } = request.body;
      if (sessionId) {
        audioAgent.clearHistory(sessionId);
        console.log("🗑️ Historique supprimé pour session:", sessionId);
      }
      response.json({ success: true, message: "Historique supprimé" });
    } catch (error) {
      response.status(500).json({ success: false, error: "Erreur lors de la suppression" });
    }
  }
}