// backend/src/agents/audio/audio-agent.ts

import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { audioGenerationTool } from "./tools/audio-generation";

console.log("🚀 Initialisation de l'agent audio intelligent...");

// URL de LM Studio depuis la variable d'environnement
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
console.log("🌍 URL LM Studio:", LM_STUDIO_URL);

const agentModel = new ChatOpenAI({
  temperature: 0.7,
  model: "local-model",
  apiKey: "lm-studio",
  configuration: {
    baseURL: LM_STUDIO_URL
  }
});

// Ajouter les outils à l'agent
const agentWithTools = agentModel.bindTools([audioGenerationTool]);

const agentCheckpointer = new MemorySaver();

// Interface pour le contexte de conversation amélioré
interface ConversationContext {
  textContent?: string;
  voicePreference?: string;
  emotionStyle?: string;
  targetAudience?: string;
  projectType?: string;
  duration?: number;
  speed?: number;
  additionalRequirements?: string[];
}

// Stockage en mémoire des conversations avec contexte
const conversationStore = new Map<string, {
  messages: any[];
  context: ConversationContext;
}>();

export const audioAgent = {
  async invoke(input: any, config: any) {
    console.log("🤖 Agent invoke appelé avec:", {
      messagesCount: input.messages?.length,
      threadId: config.configurable?.thread_id
    });

    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("Thread ID manquant");
    }

    // Récupérer ou initialiser l'historique et le contexte pour cette session
    let sessionData = conversationStore.get(threadId) || {
      messages: [],
      context: {}
    };

    // Ajouter les nouveaux messages à l'historique
    if (input.messages && input.messages.length > 0) {
      const lastMessage = input.messages[input.messages.length - 1];
      if (lastMessage._getType() === "human") {
        sessionData.messages.push(lastMessage);

        // Extraire et mettre à jour le contexte à partir du message
        sessionData.context = this.updateContextFromMessage(
          lastMessage.content,
          sessionData.context,
          sessionData.messages
        );

        conversationStore.set(threadId, sessionData);
      }
    }

    console.log("📚 Session data:", {
      messagesCount: sessionData.messages.length,
      context: sessionData.context
    });

    // Analyser l'état de la conversation avec le contexte enrichi
    const conversationState = this.analyzeConversationStateWithContext(
      sessionData.messages,
      sessionData.context
    );
    console.log("🔍 État conversation enrichi:", conversationState);

    // Générer le prompt système basé sur l'état et le contexte
    const systemPrompt = this.generateContextualPrompt(conversationState, sessionData.context);

    // Construire la conversation complète
    const fullConversation = [
      new SystemMessage(systemPrompt),
      ...sessionData.messages
    ];

    console.log("📞 Envoi à LM Studio avec", fullConversation.length, "messages...");

    try {
      // Déterminer si on doit générer de l'audio avec contexte enrichi
      const shouldGenerateAudio = this.shouldTriggerGeneration(conversationState, sessionData.context);

      if (shouldGenerateAudio) {
        console.log("🎵 Conditions réunies pour génération audio avec contexte");

        try {
          // Préparer les paramètres de génération basés sur le contexte
          const generationParams = this.prepareGenerationParams(sessionData.context, sessionData.messages);

          console.log("🎯 Génération audio avec paramètres:", generationParams);

          // Appeler l'outil de génération audio
          const audioResult = await audioGenerationTool.invoke(generationParams);

          console.log("✅ Résultat génération:", audioResult);

          if (audioResult.success) {
            const audioResponse = new AIMessage(
              `🎉 Parfait ! J'ai généré votre audio avec succès !\n\n` +
              `📋 **Récapitulatif** :\n` +
              `• Texte : "${generationParams.text.slice(0, 100)}${generationParams.text.length > 100 ? '...' : ''}"\n` +
              `• Voix : ${generationParams.voiceName}\n` +
              `• Style : ${generationParams.emotion || 'naturel'}\n` +
              `• Vitesse : ${generationParams.speed}x\n` +
              `• Durée : ~${audioResult.duration}s\n\n` +
              `🎧 Vous pouvez maintenant écouter votre audio ci-dessous : ${audioResult.url}\n\n` +
              `Si vous souhaitez des ajustements (vitesse, style, voix différente), faites-le moi savoir !`
            );

            sessionData.messages.push(audioResponse);
            conversationStore.set(threadId, sessionData);

            return {
              messages: [audioResponse],
              conversationState: { ...conversationState, phase: 'complete' },
              historyLength: sessionData.messages.length,
              audioGenerated: true,
              audioUrl: audioResult.url,
              context: sessionData.context
            };
          } else {
            throw new Error(audioResult.error || "Échec de génération");
          }
        } catch (audioError) {
          console.error("❌ Erreur génération audio:", audioError);
          const errorResponse = new AIMessage(
            `❌ Je rencontre une difficulté technique pour générer l'audio. L'erreur est : ${audioError.message}\n\n` +
            `Pouvons-nous réessayer ? Ou souhaitez-vous ajuster quelque chose ?`
          );

          sessionData.messages.push(errorResponse);
          conversationStore.set(threadId, sessionData);

          return {
            messages: [errorResponse],
            conversationState,
            historyLength: sessionData.messages.length,
            audioGenerated: false,
            context: sessionData.context
          };
        }
      }

      // Réponse normale avec l'agent LLM
      const response = await agentWithTools.invoke(fullConversation);
      console.log("✅ Réponse reçue de LM Studio");

      // Ajouter la réponse à l'historique
      const aiResponse = new AIMessage(response.content as string);
      sessionData.messages.push(aiResponse);
      conversationStore.set(threadId, sessionData);

      return {
        messages: [response],
        conversationState,
        historyLength: sessionData.messages.length,
        audioGenerated: false,
        context: sessionData.context
      };
    } catch (error) {
      console.error("❌ Erreur LM Studio:", error);
      throw error;
    }
  },

  /**
   * Met à jour le contexte basé sur le message utilisateur
   */
  updateContextFromMessage(messageContent: string, currentContext: ConversationContext, messageHistory: any[]): ConversationContext {
    const content = messageContent.toLowerCase();
    const newContext = { ...currentContext };

    // Extraire le contenu à vocaliser
    if (this.containsContentToVocalize(messageContent)) {
      newContext.textContent = this.extractTextContent(messageContent, messageHistory);
    }

    // Détecter le type de projet
    if (content.includes('radio') || content.includes('publicité')) {
      newContext.projectType = 'radio';
      newContext.targetAudience = 'grand public';
    } else if (content.includes('formation') || content.includes('elearning') || content.includes('cours')) {
      newContext.projectType = 'elearning';
      newContext.targetAudience = 'apprenants';
    } else if (content.includes('podcast')) {
      newContext.projectType = 'podcast';
    } else if (content.includes('documentaire')) {
      newContext.projectType = 'documentaire';
      newContext.emotionStyle = 'narratif';
    }

    // Détecter les préférences de voix
    if (content.includes('masculin') || content.includes('homme')) {
      newContext.voicePreference = 'achernar'; // Voix masculine forte
    } else if (content.includes('féminin') || content.includes('femme')) {
      newContext.voicePreference = 'aoede'; // Voix féminine chaleureuse
    } else if (content.includes('jeune')) {
      newContext.voicePreference = 'callirrhoe'; // Voix jeune
    } else if (content.includes('mature') || content.includes('profonde')) {
      newContext.voicePreference = 'charon'; // Voix profonde
    }

    // Détecter le style émotionnel
    if (content.includes('chaleureux')) {
      newContext.emotionStyle = 'warm';
    } else if (content.includes('professionnel')) {
      newContext.emotionStyle = 'professional';
    } else if (content.includes('dynamique')) {
      newContext.emotionStyle = 'energetic';
    } else if (content.includes('calme')) {
      newContext.emotionStyle = 'calm';
    }

    // Détecter la durée
    const durationMatch = content.match(/(\d+)\s*(seconde|minute|s|min)/);
    if (durationMatch) {
      let duration = parseInt(durationMatch[1]);
      if (durationMatch[2].includes('min')) {
        duration *= 60;
      }
      newContext.duration = duration;
    }

    // Détecter la vitesse
    if (content.includes('rapide') || content.includes('vite')) {
      newContext.speed = 1.2;
    } else if (content.includes('lent') || content.includes('posé')) {
      newContext.speed = 0.8;
    }

    // Détecter l'audience cible
    if (content.includes('enfant') || content.includes('jeune')) {
      newContext.targetAudience = 'jeunes';
    } else if (content.includes('adulte') || content.includes('professionnel')) {
      newContext.targetAudience = 'adultes professionnels';
    }

    return newContext;
  },

  /**
   * Vérifie si le message contient du contenu à vocaliser
   */
  containsContentToVocalize(content: string): boolean {
    const indicators = [
      'texte:', 'script:', 'contenu:', 'dire:', 'lire:',
      'voici le texte', 'voici le contenu', 'voici le script'
    ];

    const lowerContent = content.toLowerCase();
    return indicators.some(indicator => lowerContent.includes(indicator)) ||
      (content.length > 50 && !content.includes('?'));
  },

  /**
   * Extrait le texte à vocaliser
   */
  extractTextContent(messageContent: string, messageHistory: any[]): string {
    // Chercher des patterns spécifiques
    const patterns = [
      /(?:texte|script|contenu|dire|lire)\s*:\s*(.+)/i,
      /voici\s+(?:le\s+)?(?:texte|contenu|script)\s*:?\s*(.+)/i
    ];

    for (const pattern of patterns) {
      const match = messageContent.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Si pas de pattern, prendre le message entier s'il est assez long
    if (messageContent.length > 50 && !messageContent.includes('?')) {
      return messageContent.trim();
    }

    // Fallback: chercher dans l'historique le message le plus long
    const userMessages = messageHistory.filter(msg => msg._getType() === 'human');
    const longestMessage = userMessages.reduce((longest, current) =>
        current.content.length > longest.content.length ? current : longest,
      { content: '' }
    );

    return longestMessage.content.length > 20 ? longestMessage.content : messageContent;
  },

  /**
   * Analyse l'état de la conversation avec le contexte enrichi
   */
  analyzeConversationStateWithContext(history: any[], context: ConversationContext) {
    const state = {
      messageCount: history.length,
      hasContent: !!context.textContent,
      hasAudience: !!context.targetAudience,
      hasVoice: !!context.voicePreference,
      hasStyle: !!context.emotionStyle,
      hasContext: !!context.projectType,
      phase: 'discovery' as 'discovery' | 'clarification' | 'generation' | 'complete',
      collectedInfo: [] as string[],
      context
    };

    // Construire la liste des infos collectées
    if (state.hasContent) state.collectedInfo.push('Contenu à vocaliser');
    if (state.hasAudience) state.collectedInfo.push('Public cible');
    if (state.hasVoice) state.collectedInfo.push('Type de voix');
    if (state.hasStyle) state.collectedInfo.push('Style/émotion');
    if (state.hasContext) state.collectedInfo.push('Type de projet');

    // Déterminer la phase
    const completedCount = [state.hasContent, state.hasAudience, state.hasVoice, state.hasStyle, state.hasContext]
      .filter(Boolean).length;

    if (completedCount === 0) {
      state.phase = 'discovery';
    } else if (completedCount < 3 || !state.hasContent) {
      state.phase = 'clarification';
    } else if (completedCount >= 3 && state.hasContent) {
      state.phase = 'generation';
    } else {
      state.phase = 'complete';
    }

    return state;
  },

  /**
   * Détermine si on doit déclencher la génération audio
   */
  shouldTriggerGeneration(state: any, context: ConversationContext): boolean {
    return state.phase === 'generation' &&
      state.hasContent &&
      state.collectedInfo.length >= 3 &&
      !!context.textContent;
  },

  /**
   * Prépare les paramètres de génération basés sur le contexte
   */
  prepareGenerationParams(context: ConversationContext, messageHistory: any[]) {
    return {
      text: context.textContent || this.extractTextFromHistory(messageHistory),
      voiceName: context.voicePreference || "aoede", // Voix par défaut fiable
      emotion: context.emotionStyle || "neutral",
      speed: context.speed || 1.0,
      effects: []
    };
  },

  /**
   * Fallback pour extraire le texte depuis l'historique
   */
  extractTextFromHistory(history: any[]): string {
    const userMessages = history.filter(msg => msg._getType() === 'human');

    for (const message of userMessages.reverse()) {
      if (message.content.length > 50 && !message.content.toLowerCase().includes('?')) {
        return message.content.trim();
      }
    }

    const longestMessage = userMessages.reduce((longest, current) =>
        current.content.length > longest.content.length ? current : longest,
      { content: 'Bonjour, voici un test audio.' }
    );

    return longestMessage.content;
  },

  /**
   * Génère un prompt contextuel intelligent
   */
  generateContextualPrompt(state: any, context: ConversationContext): string {
    const basePrompt = `Tu es l'Assistant Audio professionnel d'Ekho Studio, spécialisé dans la création de contenus audio de qualité.

CONTEXTE ACTUEL:
- Phase: ${state.phase}
- Messages échangés: ${state.messageCount}
- Informations collectées: ${state.collectedInfo.join(', ') || 'Aucune'}

CONTEXTE DÉTECTÉ:
${context.textContent ? `- Contenu: "${context.textContent.slice(0, 100)}..."` : ''}
${context.projectType ? `- Type de projet: ${context.projectType}` : ''}
${context.targetAudience ? `- Public cible: ${context.targetAudience}` : ''}
${context.voicePreference ? `- Voix préférée: ${context.voicePreference}` : ''}
${context.emotionStyle ? `- Style émotionnel: ${context.emotionStyle}` : ''}
${context.duration ? `- Durée souhaitée: ${context.duration}s` : ''}

MISSION: Aider l'utilisateur à créer du contenu audio professionnel étape par étape.

IMPORTANT: Tu as accès à un outil de génération audio. Quand tu as assez d'informations (phase génération), tu peux proposer de créer l'audio immédiatement.`;

    switch (state.phase) {
      case 'discovery':
        return `${basePrompt}

PHASE DÉCOUVERTE - Premier contact
Tu découvres les besoins de l'utilisateur pour la première fois.

APPROCHE:
- Sois accueillant et professionnel
- Pose UNE question ouverte pour comprendre le projet global
- Demande soit le contenu à vocaliser, soit le type de projet
- Ne submerge pas avec trop de questions

EXEMPLES DE QUESTIONS:
- "Quel type de contenu audio souhaitez-vous créer ?"
- "Avez-vous déjà un texte à vocaliser ou voulez-vous que je vous aide à le créer ?"
- "Parlez-moi de votre projet audio"

Reste conversationnel et évite les listes à puces.`;

      case 'clarification':
        const missingElements = [];
        if (!state.hasContent) missingElements.push('- Le contenu exact à vocaliser');
        if (!state.hasAudience) missingElements.push('- Le public cible (âge, contexte)');
        if (!state.hasVoice) missingElements.push('- Le type de voix souhaité (masculin, féminin, etc.)');
        if (!state.hasStyle) missingElements.push('- Le style/ton souhaité (professionnel, chaleureux, etc.)');
        if (!state.hasContext) missingElements.push('- Le contexte d\'utilisation (radio, web, formation, etc.)');

        return `${basePrompt}

PHASE CLARIFICATION - Collecte d'informations
L'utilisateur a donné quelques informations, il faut clarifier les détails manquants.

INFORMATIONS ENCORE NÉCESSAIRES:
${missingElements.join('\n')}

APPROCHE:
- Pose UNE SEULE question à la fois
- Choisis l'information la plus importante manquante
- Reste naturel et conversationnel
- Explique pourquoi cette info est utile

NE redemande JAMAIS ce qui a déjà été fourni !`;

      case 'generation':
        return `${basePrompt}

PHASE GÉNÉRATION - Prêt à créer
La plupart des informations sont collectées, il est temps de proposer la génération.

INFORMATIONS COLLECTÉES: ${state.collectedInfo.join(', ')}

APPROCHE:
- Résume ce qui a été collecté
- Propose de procéder à la génération IMMÉDIATEMENT
- Sois confiant et enthousiaste
- Annonce que l'audio va être créé

IMPORTANT: Tu peux maintenant générer l'audio réellement ! L'outil va créer un fichier MP3/WAV que l'utilisateur pourra écouter.

EXEMPLE: "Parfait ! J'ai toutes les informations nécessaires. Je vais créer votre audio [style] maintenant. Génération en cours..."`;

      case 'complete':
        return `${basePrompt}

PHASE COMPLÈTE - Audio généré ou prêt
L'audio a été généré ou toutes les informations sont disponibles.

APPROCHE:
- Présente le résultat
- Propose des ajustements si nécessaire
- Offre des options supplémentaires (variations, autres versions)
- Sois fier du travail accompli`;

      default:
        return basePrompt;
    }
  },

  // Méthode pour vider l'historique d'une session
  clearHistory(threadId: string) {
    conversationStore.delete(threadId);
    console.log("🗑️ Historique supprimé pour:", threadId);
  }
};

console.log("✅ Agent audio intelligent créé");