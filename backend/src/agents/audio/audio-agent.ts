// backend/src/agents/audio/audio-agent.ts

import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

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

const agentCheckpointer = new MemorySaver();

// Stockage en mémoire des conversations (remplace le stockage dans le controller)
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
      // Prendre seulement le dernier message utilisateur
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
      const response = await agentModel.invoke(fullConversation);
      console.log("✅ Réponse reçue de LM Studio");

      // Ajouter la réponse à l'historique
      const aiResponse = new AIMessage(response.content as string);
      conversationHistory.push(aiResponse);
      conversationStore.set(threadId, conversationHistory);

      return {
        messages: [response],
        conversationState,
        historyLength: conversationHistory.length
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

interface ConversationState {
  messageCount: number;
  hasContent: boolean;
  hasAudience: boolean;
  hasDuration: boolean;
  hasStyle: boolean;
  hasContext: boolean;
  phase: 'discovery' | 'clarification' | 'generation' | 'complete';
  collectedInfo: string[];
}

// Fonction pour analyser l'état de la conversation
function analyzeConversationState(history: any[]) {
  const userMessages = history.filter(msg => msg._getType() === 'human');
  const agentMessages = history.filter(msg => msg._getType() === 'ai');

  const allText = userMessages.map(msg => msg.content.toLowerCase()).join(' ');

  const state: ConversationState = {
    messageCount: 0,
    hasContent: false,
    hasAudience: false,
    hasDuration: false,
    hasStyle: false,
    hasContext: false,
    phase: 'discovery',
    collectedInfo: []
  };

  // Analyser le contenu collecté
  if (allText.includes('texte') || allText.includes('script') || allText.includes('contenu') || allText.length > 50) {
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
  } else if (completedCount >= 3 && completedCount < 5) {
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

MISSION: Aider l'utilisateur à créer du contenu audio professionnel étape par étape.`;

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
- Propose de procéder à la génération
- Demande confirmation ou derniers ajustements
- Sois confiant et enthousiaste

EXEMPLE: "Parfait ! J'ai toutes les informations nécessaires. Je vais créer un audio [style] de [durée] pour [audience]. Souhaitez-vous que je procède à la génération ?"`;

    case 'complete':
      return `${basePrompt}

PHASE COMPLÈTE - Toutes les infos collectées
Toutes les informations principales sont disponibles.

APPROCHE:
- Confirme la génération
- Propose des ajustements si nécessaire
- Sois prêt à générer l'audio
- Offre des options supplémentaires (vitesse, effets, etc.)`;

    default:
      return basePrompt;
  }
}

console.log("✅ Agent audio intelligent créé");