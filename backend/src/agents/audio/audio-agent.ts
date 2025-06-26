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

// Stockage en mémoire des conversations
const conversationStore = new Map<string, any[]>();

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

    // Récupérer ou initialiser l'historique pour cette session
    let conversationHistory = conversationStore.get(threadId) || [];

    // Ajouter les nouveaux messages à l'historique
    if (input.messages && input.messages.length > 0) {
      const lastMessage = input.messages[input.messages.length - 1];
      if (lastMessage._getType() === "human") {
        conversationHistory.push(lastMessage);
        conversationStore.set(threadId, conversationHistory);
      }
    }

    console.log("📚 Historique session:", conversationHistory.length, "messages");

    // Analyser l'historique pour déterminer l'état de la conversation
    const conversationState = analyzeConversationState(conversationHistory);
    console.log("🔍 État conversation:", conversationState);

    // Générer le prompt système basé sur l'état
    const systemPrompt = generateContextualPrompt(conversationState);

    // Construire la conversation complète
    const fullConversation = [
      new SystemMessage(systemPrompt),
      ...conversationHistory
    ];

    console.log("📞 Envoi à LM Studio avec", fullConversation.length, "messages...");

    try {
      // Déterminer si on doit générer de l'audio
      const shouldGenerateAudio = conversationState.phase === 'generation' &&
        conversationState.hasContent &&
        conversationState.collectedInfo.length >= 3;

      let response;

      if (shouldGenerateAudio) {
        console.log("🎵 Conditions réunies pour génération audio");

        // Extraire le texte à vocaliser depuis l'historique
        const textToGenerate = extractTextFromHistory(conversationHistory);
        const voiceParams = extractVoiceParamsFromHistory(conversationHistory, conversationState);

        if (textToGenerate) {
          console.log("🎯 Génération audio avec:", { textToGenerate: textToGenerate.slice(0, 50), voiceParams });

          try {
            // Appeler l'outil de génération audio
            const audioResult = await audioGenerationTool.invoke({
              text: textToGenerate,
              voiceName: voiceParams.voiceName,
              emotion: voiceParams.emotion,
              speed: voiceParams.speed,
              effects: voiceParams.effects
            });

            console.log("✅ Résultat génération:", audioResult);

            if (audioResult.success) {
              const audioResponse = new AIMessage(
                `🎉 Parfait ! J'ai généré votre audio avec succès !\n\n` +
                `📋 **Récapitulatif** :\n` +
                `• Texte : "${textToGenerate.slice(0, 100)}${textToGenerate.length > 100 ? '...' : ''}"\n` +
                `• Voix : ${voiceParams.voiceName}\n` +
                `• Style : ${voiceParams.emotion || 'naturel'}\n` +
                `• Durée : ~${audioResult.duration}s\n\n` +
                `🎧 Vous pouvez maintenant écouter votre audio ci-dessous. Si vous souhaitez des ajustements (vitesse, style, voix différente), faites-le moi savoir !`
              );

              conversationHistory.push(audioResponse);
              conversationStore.set(threadId, conversationHistory);

              return {
                messages: [audioResponse],
                conversationState: { ...conversationState, phase: 'complete' },
                historyLength: conversationHistory.length,
                audioGenerated: true,
                audioUrl: audioResult.url
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

            conversationHistory.push(errorResponse);
            conversationStore.set(threadId, conversationHistory);

            return {
              messages: [errorResponse],
              conversationState,
              historyLength: conversationHistory.length,
              audioGenerated: false
            };
          }
        }
      }

      // Réponse normale avec l'agent LLM
      response = await agentWithTools.invoke(fullConversation);
      console.log("✅ Réponse reçue de LM Studio");

      // Ajouter la réponse à l'historique
      const aiResponse = new AIMessage(response.content as string);
      conversationHistory.push(aiResponse);
      conversationStore.set(threadId, conversationHistory);

      return {
        messages: [response],
        conversationState,
        historyLength: conversationHistory.length,
        audioGenerated: false
      };
    } catch (error) {
      console.error("❌ Erreur LM Studio:", error);
      throw error;
    }
  },

  // Méthode pour vider l'historique d'une session
  clearHistory(threadId: string) {
    conversationStore.delete(threadId);
    console.log("🗑️ Historique supprimé pour:", threadId);
  }
};

// Fonction pour extraire le texte à vocaliser depuis l'historique
function extractTextFromHistory(history: any[]): string | null {
  const userMessages = history.filter(msg => msg._getType() === 'human');

  for (const message of userMessages.reverse()) {
    const content = message.content.toLowerCase();

    // Chercher des mots-clés indiquant du contenu à vocaliser
    if (content.includes('texte:') || content.includes('script:') || content.includes('contenu:')) {
      // Extraire le texte après le ':'
      const match = message.content.match(/(?:texte|script|contenu)\s*:\s*(.+)/i);
      if (match) return match[1].trim();
    }

    // Si le message est assez long, probablement du contenu
    if (message.content.length > 50 && !content.includes('?')) {
      return message.content.trim();
    }
  }

  // Fallback: chercher le message le plus long
  const longestMessage = userMessages.reduce((longest, current) =>
      current.content.length > longest.content.length ? current : longest,
    { content: '' }
  );

  return longestMessage.content.length > 20 ? longestMessage.content : null;
}

// Fonction pour extraire les paramètres de voix depuis l'historique
function extractVoiceParamsFromHistory(history: any[], state: any) {
  const allText = history
    .filter(msg => msg._getType() === 'human')
    .map(msg => msg.content.toLowerCase())
    .join(' ');

  const params = {
    voiceName: "Aoede", // Par défaut
    emotion: "neutral",
    speed: 1,
    effects: []
  };

  // Analyser le style/émotion
  if (allText.includes('chaleureux')) params.emotion = "warm";
  else if (allText.includes('professionnel')) params.emotion = "professional";
  else if (allText.includes('dynamique')) params.emotion = "energetic";
  else if (allText.includes('calme')) params.emotion = "calm";

  // Analyser la voix souhaitée
  if (allText.includes('féminin') || allText.includes('femme')) params.voiceName = "Aoede";
  else if (allText.includes('masculin') || allText.includes('homme')) params.voiceName = "Atlas";
  else if (allText.includes('jeune')) params.voiceName = "Nova";

  // Analyser la vitesse
  if (allText.includes('rapide') || allText.includes('vite')) params.speed = 1.2;
  else if (allText.includes('lent') || allText.includes('posé')) params.speed = 0.8;

  return params;
}

// Fonction pour analyser l'état de la conversation
function analyzeConversationState(history: any[]) {
  const userMessages = history.filter(msg => msg._getType() === 'human');
  const agentMessages = history.filter(msg => msg._getType() === 'ai');

  const allText = userMessages.map(msg => msg.content.toLowerCase()).join(' ');

  const state = {
    messageCount: userMessages.length,
    hasContent: false,
    hasAudience: false,
    hasDuration: false,
    hasStyle: false,
    hasContext: false,
    phase: 'discovery', // discovery, clarification, generation, complete
    collectedInfo: []
  };

  // Analyser le contenu collecté
  if (allText.includes('texte') || allText.includes('script') || allText.includes('contenu') ||
    userMessages.some(msg => msg.content.length > 50)) {
    state.hasContent = true;
    state.collectedInfo.push('Contenu à vocaliser');
  }

  if (allText.includes('public') || allText.includes('audience') || allText.includes('âge') ||
    allText.includes('enfant') || allText.includes('adulte') || allText.includes('professionnel')) {
    state.hasAudience = true;
    state.collectedInfo.push('Public cible');
  }

  if (allText.includes('seconde') || allText.includes('minute') || allText.includes('durée') ||
    /\d+\s*(s|sec|min)/.test(allText)) {
    state.hasDuration = true;
    state.collectedInfo.push('Durée souhaitée');
  }

  if (allText.includes('style') || allText.includes('ton') || allText.includes('chaleureux') ||
    allText.includes('professionnel') || allText.includes('dynamique') || allText.includes('calme')) {
    state.hasStyle = true;
    state.collectedInfo.push('Style/ton');
  }

  if (allText.includes('radio') || allText.includes('podcast') || allText.includes('publicité') ||
    allText.includes('formation') || allText.includes('vidéo')) {
    state.hasContext = true;
    state.collectedInfo.push('Contexte d\'utilisation');
  }

  // Déterminer la phase
  const completedItems = [state.hasContent, state.hasAudience, state.hasDuration, state.hasStyle, state.hasContext];
  const completedCount = completedItems.filter(Boolean).length;

  if (completedCount === 0) {
    state.phase = 'discovery';
  } else if (completedCount < 3) {
    state.phase = 'clarification';
  } else if (completedCount >= 3 && state.hasContent) {
    state.phase = 'generation';
  } else {
    state.phase = 'complete';
  }

  return state;
}

// Fonction pour générer un prompt contextuel
function generateContextualPrompt(state: any): string {
  const basePrompt = `Tu es l'Assistant Audio professionnel d'Ekho Studio, spécialisé dans la création de contenus audio de qualité.

CONTEXTE ACTUEL:
- Phase: ${state.phase}
- Messages échangés: ${state.messageCount}
- Informations collectées: ${state.collectedInfo.join(', ') || 'Aucune'}

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
      return `${basePrompt}

PHASE CLARIFICATION - Collecte d'informations
L'utilisateur a donné quelques informations, il faut clarifier les détails manquants.

INFORMATIONS ENCORE NÉCESSAIRES:
${!state.hasContent ? '- Le contenu exact à vocaliser' : ''}
${!state.hasAudience ? '- Le public cible (âge, contexte)' : ''}
${!state.hasDuration ? '- La durée souhaitée approximative' : ''}
${!state.hasStyle ? '- Le style/ton souhaité (professionnel, chaleureux, etc.)' : ''}
${!state.hasContext ? '- Le contexte d\'utilisation (radio, web, formation, etc.)' : ''}

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
}

console.log("✅ Agent audio intelligent créé");