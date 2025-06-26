// backend/src/controllers/audio/AudioAgentController.ts
import { Request, Response } from "express";
import { audioAgent } from "@/agents/audio/audio-agent";
import { AudioAgentChatContractType } from "@/contracts/api/AudioAgentContracts";
import { ValidatedRequest } from "@/types";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

// Stockage en mémoire des conversations (en production, utilisez Redis ou une DB)
const conversationMemory: Map<string, any[]> = new Map();

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

      // Récupérer l'historique de la conversation
      let conversationHistory = conversationMemory.get(finalSessionId) || [];
      console.log("📚 Historique récupéré:", conversationHistory.length, "messages");

      // Construire le message avec contexte si fourni
      let fullMessage = message;
      if (context) {
        const contextParts = [];
        if (context.targetAudience) contextParts.push(`Public cible: ${context.targetAudience}`);
        if (context.style) contextParts.push(`Style: ${context.style}`);
        if (context.duration) contextParts.push(`Durée: ${context.duration}s`);
        if (context.emotion) contextParts.push(`Émotion: ${context.emotion}`);

        if (contextParts.length > 0) {
          fullMessage = `${message}\n\nContexte déjà fourni: ${contextParts.join(', ')}`;
        }
      }

      // Ajouter le nouveau message utilisateur à l'historique
      const newUserMessage = new HumanMessage(fullMessage);
      conversationHistory.push(newUserMessage);

      // Préparer les messages pour l'agent (système + historique)
      const systemPrompt = `Tu es l'Assistant Audio professionnel d'Ekho Studio. 

MISSION: Aider l'utilisateur à créer du contenu audio de qualité professionnelle.

CONTEXTE DE LA CONVERSATION:
- Tu as accès à tout l'historique de cette conversation
- Ne redemande PAS les informations déjà fournies par l'utilisateur
- Fais référence aux éléments mentionnés précédemment
- Progresse logiquement dans la collecte d'informations

ÉTAPES OBLIGATOIRES:
1. Analyser TOUT l'historique de la conversation
2. Identifier les informations DÉJÀ collectées
3. Poser UNIQUEMENT les questions pour les informations manquantes
4. Recommander des solutions audio quand possible
5. Proposer la génération quand toutes les infos sont collectées

QUESTIONS ESSENTIELLES À COLLECTER (si pas encore mentionnées):
- Quel est le contenu/texte à vocaliser ?
- Quel est le public cible ? (âge, contexte)
- Quelle est la durée souhaitée ?
- Quel style/ton ? (professionnel, chaleureux, dynamique, etc.)
- Quelle utilisation ? (pub radio, podcast, formation, etc.)

RÈGLES IMPORTANTES:
- EXAMINE d'abord l'historique complet avant de répondre
- Ne pose UNE SEULE question à la fois pour ne pas surcharger
- Si l'utilisateur a déjà donné une info, n'en redemande JAMAIS
- Sois conversationnel et professionnel
- Propose des exemples concrets
- Utilise des émojis pour rendre ça plus engageant
- Fais des résumés de ce qui a été collecté quand approprié

Réponds toujours en français avec un ton expert mais accessible.`;

      const allMessages = [
        new SystemMessage(systemPrompt),
        ...conversationHistory
      ];

      console.log("🚀 Envoi à l'agent avec", allMessages.length, "messages");

      const result = await audioAgent.invoke(
        { messages: allMessages },
        config
      );

      const responseContent = result.messages[0].content;
      console.log("📝 Réponse agent:", responseContent?.slice(0, 200));

      // Ajouter la réponse de l'agent à l'historique
      const agentMessage = new AIMessage({
        content: responseContent as string
      });
      conversationHistory.push(agentMessage);

      // Sauvegarder l'historique mis à jour
      conversationMemory.set(finalSessionId, conversationHistory);
      console.log("💾 Historique sauvegardé:", conversationHistory.length, "messages");

      // Analyser la réponse pour déterminer l'état
      const analysis = AudioAgentController.analyzeResponse(
        responseContent ?
          (Array.isArray(responseContent)
            ? (typeof responseContent[0] === 'string'
              ? responseContent[0]
              : 'string' in responseContent[0]
                ? String(responseContent[0].string)
                : String(responseContent[0]))
            : String(responseContent))
          : '',
        conversationHistory
      );
      console.log("📊 Analyse:", analysis);

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
        conversationLength: conversationHistory.length,
        collectedInfo: analysis.collectedInfo
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
   * Analyse intelligente avec prise en compte de l'historique
   */
  private static analyzeResponse(content: string, history: any[]): {
    needsMoreInfo: boolean;
    missingInfo: string[];
    suggestions: string[];
    nextSteps: string[];
    canProceed: boolean;
    readyToGenerate: boolean;
    collectedInfo: string[];
  } {
    const lowerContent = content.toLowerCase();

    // Analyser l'historique pour voir ce qui a été collecté
    const historyText = history
      .filter(msg => msg._getType() === 'human')
      .map(msg => msg.content.toLowerCase())
      .join(' ');

    console.log("🔍 Analyse de l'historique:", historyText.slice(0, 200));

    const collectedInfo = [];
    const missingInfo = [];

    // Vérifier les informations déjà collectées dans l'historique
    if (historyText.includes('texte') || historyText.includes('contenu') || historyText.includes('script')) {
      collectedInfo.push('Contenu à vocaliser');
    } else {
      missingInfo.push('Contenu à vocaliser');
    }

    if (historyText.includes('public') || historyText.includes('audience') || historyText.includes('âge')) {
      collectedInfo.push('Public cible');
    } else if (lowerContent.includes('public') || lowerContent.includes('audience')) {
      missingInfo.push('Public cible');
    }

    if (historyText.includes('durée') || historyText.includes('seconde') || historyText.includes('minute')) {
      collectedInfo.push('Durée');
    } else if (lowerContent.includes('durée') || lowerContent.includes('long')) {
      missingInfo.push('Durée souhaitée');
    }

    if (historyText.includes('style') || historyText.includes('ton') || historyText.includes('professionnel') || historyText.includes('chaleureux')) {
      collectedInfo.push('Style/ton');
    } else if (lowerContent.includes('style') || lowerContent.includes('ton')) {
      missingInfo.push('Style/ton');
    }

    if (historyText.includes('radio') || historyText.includes('podcast') || historyText.includes('formation') || historyText.includes('publicité')) {
      collectedInfo.push('Utilisation');
    } else if (lowerContent.includes('utilisation') || lowerContent.includes('contexte')) {
      missingInfo.push('Contexte d\'utilisation');
    }

    // Indicateurs que l'agent pose des questions
    const askingQuestions = [
      /quel est/i,
      /quelle est/i,
      /pouvez-vous/i,
      /pourriez-vous/i,
      /avez-vous/i,
      /\?/,
      /préciser/i,
      /me dire/i,
      /plus d'informations/i
    ].some(pattern => pattern.test(content));

    // Indicateurs que l'agent est prêt à générer
    const readyToGenerate = [
      /générer/i,
      /créer l'audio/i,
      /procéder/i,
      /lancer/i,
      /parfait/i,
      /excellent/i,
      /toutes les informations/i,
      /maintenant/i
    ].some(pattern => pattern.test(content));

    const needsMoreInfo = askingQuestions && !readyToGenerate;

    console.log("📊 Infos collectées:", collectedInfo);
    console.log("📊 Infos manquantes:", missingInfo);

    return {
      needsMoreInfo,
      missingInfo,
      collectedInfo,
      suggestions: needsMoreInfo ? [
        "Répondez à la question posée par l'assistant",
        "L'assistant se souvient de ce que vous avez déjà dit",
        "Soyez précis dans vos réponses"
      ] : [
        "L'assistant va générer votre audio",
        "Toutes les informations semblent collectées",
        "Vous pourrez ensuite l'écouter et le télécharger"
      ],
      nextSteps: needsMoreInfo ? [
        "Répondre à la question",
        "Fournir les informations demandées"
      ] : [
        "Confirmer la génération",
        "Générer l'audio",
        "Écouter le résultat"
      ],
      canProceed: !needsMoreInfo || readyToGenerate,
      readyToGenerate
    };
  }

  static async generateProject(request: Request, response: Response): Promise<void> {
    response.status(501).json({ error: "Not implemented yet" });
  }

  /**
   * Endpoint pour vider l'historique d'une session (optionnel)
   */
  static async clearHistory(request: Request, response: Response): Promise<void> {
    try {
      const { sessionId } = request.body;
      if (sessionId && conversationMemory.has(sessionId)) {
        conversationMemory.delete(sessionId);
        console.log("🗑️ Historique supprimé pour session:", sessionId);
      }
      response.json({ success: true, message: "Historique supprimé" });
    } catch (error) {
      response.status(500).json({ success: false, error: "Erreur lors de la suppression" });
    }
  }
}