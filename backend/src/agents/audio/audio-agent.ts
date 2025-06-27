// backend/src/agents/audio/audio-agent.ts

import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { audioGenerationTool } from "./tools/audio-generation";
import { recommendVoice } from "../../services/audio/VoiceGuide";

console.log("🚀 Initialisation de l'agent audio intelligent...");

// URL de LM Studio depuis la variable d'environnement
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
console.log("🌍 URL LM Studio:", LM_STUDIO_URL);

const agentModel = new ChatOpenAI({
  temperature: 0.7, // Plus créatif pour des réponses naturelles
  model: "local-model",
  apiKey: "lm-studio",
  configuration: {
    baseURL: LM_STUDIO_URL
  }
});

// Ajouter les outils à l'agent
const agentWithTools = agentModel.bindTools([audioGenerationTool]);

// Interface pour les données collectées de manière flexible
interface CollectedData {
  projectType?: string;
  textContent?: string;
  targetAudience?: string;
  voiceGender?: string;
  emotionStyle?: string;
  duration?: number;
  context?: string;
  isReadyToGenerate?: boolean;
  conversationContext?: string[];
}

// Interface pour la réponse de l'agent
interface AgentResponse {
  messages: AIMessage[];
  conversationState: {
    phase: string;
    step: number;
  };
  historyLength: number;
  audioGenerated: boolean;
  audioUrl?: string;
  collectedInfo?: string[];
  sessionData?: CollectedData;
}

// Stockage en mémoire des sessions avec contexte conversationnel
const sessionStore = new Map<string, CollectedData>();
const conversationHistory = new Map<string, string[]>();

// Prompts optimisés pour une conversation naturelle
const CONVERSATION_PROMPTS = {
  welcome: [
    "🎙️ Salut ! Je suis ton assistant audio d'Ekho Studio. Dis-moi, quel type de contenu audio tu veux créer aujourd'hui ?",
    "🎵 Bienvenue sur Ekho Studio ! Je suis là pour t'aider à créer l'audio parfait. Qu'est-ce que tu as en tête ?",
    "👋 Hello ! Prêt(e) à créer quelque chose d'incroyable ? Raconte-moi ton projet audio !",
  ],

  clarification: {
    text: [
      "Super ! Et quel est le texte que tu veux transformer en audio ?",
      "Génial ! Maintenant, partage-moi le texte que tu veux vocaliser.",
      "Parfait ! Quel message veux-tu faire passer ?"
    ],
    audience: [
      "C'est noté ! Pour qui est destiné cet audio ?",
      "Excellent choix ! Qui va écouter ton audio ?",
      "Top ! À quel public s'adresse ton message ?"
    ],
    voice: [
      "Compris ! Quel type de voix préfères-tu ?",
      "D'accord ! Tu préfères une voix masculine, féminine, ou peu importe ?",
      "Ok ! As-tu une préférence pour le type de voix ?"
    ],
    style: [
      "Presque fini ! Quel style veux-tu donner à ton audio ?",
      "Dernière touche : quelle ambiance souhaites-tu ?",
      "Et pour finir, quel ton veux-tu adopter ?"
    ]
  },

  encouragement: [
    "C'est un super projet !",
    "J'adore ton idée !",
    "Ça va être génial !",
    "Excellent choix !",
    "Tu as bon goût !",
    "C'est exactement ce qu'il faut !",
    "Wow, j'ai hâte d'entendre le résultat !"
  ],

  readyToGenerate: [
    "🚀 Parfait ! J'ai tout ce qu'il me faut. On lance la création de ton audio ?",
    "✨ Super ! Tout est prêt. Je peux générer ton audio maintenant ?",
    "🎯 Excellent ! J'ai toutes les infos. On y va ?"
  ]
};

// Analyser intelligemment le message utilisateur
function analyzeUserMessage(message: string, sessionData: CollectedData): {
  detectedInfo: Partial<CollectedData>;
  confidence: number;
} {
  const lowerMessage = message.toLowerCase();
  const detectedInfo: Partial<CollectedData> = {};
  let confidence = 0;

  // Détection du type de projet
  const projectKeywords = {
    'publicité': ['pub', 'publicit', 'spot', 'annonce', 'promo'],
    'podcast': ['podcast', 'émission', 'épisode'],
    'formation': ['formation', 'cours', 'tutoriel', 'e-learning', 'apprendre'],
    'narration': ['histoire', 'conte', 'récit', 'narrat'],
    'présentation': ['présentation', 'pitch', 'démo'],
    'livre audio': ['livre', 'audiobook', 'lecture'],
    'méditation': ['méditation', 'relaxation', 'zen', 'calme']
  };

  for (const [type, keywords] of Object.entries(projectKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      detectedInfo.projectType = type;
      confidence += 0.2;
      break;
    }
  }

  // Détection du public cible
  const audienceKeywords = {
    'enfants': ['enfant', 'jeune', 'kid', 'école', 'maternelle'],
    'adolescents': ['ado', 'lycée', 'jeune', 'teen'],
    'adultes': ['adulte', 'professionnel', 'entreprise', 'société'],
    'seniors': ['senior', 'âgé', 'retraité'],
    'grand public': ['tout le monde', 'général', 'large', 'tous']
  };

  for (const [audience, keywords] of Object.entries(audienceKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      detectedInfo.targetAudience = audience;
      confidence += 0.2;
      break;
    }
  }

  // Détection du genre de voix
  if (lowerMessage.includes('masculin') || lowerMessage.includes('homme')) {
    detectedInfo.voiceGender = 'masculine';
    confidence += 0.15;
  } else if (lowerMessage.includes('féminin') || lowerMessage.includes('femme')) {
    detectedInfo.voiceGender = 'feminine';
    confidence += 0.15;
  }

  // Détection du style/émotion
  const styleKeywords = {
    'professionnel': ['professionnel', 'sérieux', 'formel', 'corporate'],
    'chaleureux': ['chaleureux', 'amical', 'sympathique', 'accueillant'],
    'dynamique': ['dynamique', 'énergique', 'enjoué', 'motivant', 'enthousiaste'],
    'calme': ['calme', 'posé', 'tranquille', 'apaisant', 'doux'],
    'dramatique': ['dramatique', 'intense', 'captivant', 'suspense']
  };

  for (const [style, keywords] of Object.entries(styleKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      detectedInfo.emotionStyle = style;
      confidence += 0.15;
      break;
    }
  }

  // Détection de texte long (probable contenu à vocaliser)
  if (message.length > 100 && !message.includes('?')) {
    detectedInfo.textContent = message;
    confidence += 0.3;
  }

  return { detectedInfo, confidence };
}

// Déterminer ce qui manque pour générer
function getMissingInfo(sessionData: CollectedData): string[] {
  const missing: string[] = [];

  if (!sessionData.textContent) {
    missing.push('Le texte à vocaliser');
  }

  // Les autres infos sont optionnelles mais améliorent le résultat
  if (!sessionData.projectType) {
    missing.push('Le type de projet (optionnel)');
  }
  if (!sessionData.targetAudience) {
    missing.push('Le public cible (optionnel)');
  }

  return missing;
}

// Choisir une réponse appropriée
function getRandomResponse(responses: string[]): string {
  return responses[Math.floor(Math.random() * responses.length)];
}

export const audioAgent = {
  async invoke(input: any, config: any): Promise<AgentResponse> {
    console.log("🤖 Agent intelligent appelé");

    const threadId: string = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("Thread ID manquant");
    }

    // Récupérer ou initialiser les données de session
    let sessionData: CollectedData = sessionStore.get(threadId) || {};
    let history: string[] = conversationHistory.get(threadId) || [];

    // Extraire le message utilisateur
    const userMessage = input.messages?.[input.messages.length - 1];
    const userText: string = userMessage?.content || '';

    console.log("📊 État session:", {
      hasText: !!sessionData.textContent,
      hasProjectType: !!sessionData.projectType,
      userMessage: userText.slice(0, 50)
    });

    try {
      // Si c'est le premier message
      if (history.length === 0) {
        const welcomeMessage = new AIMessage(getRandomResponse(CONVERSATION_PROMPTS.welcome));
        history.push(`User: ${userText}`);
        history.push(`Assistant: ${welcomeMessage.content}`);
        conversationHistory.set(threadId, history);

        return {
          messages: [welcomeMessage],
          conversationState: { phase: 'discovery', step: 1 },
          historyLength: 1,
          audioGenerated: false
        };
      }

      // Analyser le message utilisateur
      const { detectedInfo, confidence } = analyzeUserMessage(userText, sessionData);

      // Mettre à jour les données de session avec les infos détectées
      sessionData = { ...sessionData, ...detectedInfo };
      sessionStore.set(threadId, sessionData);

      // Ajouter au contexte conversationnel
      history.push(`User: ${userText}`);

      // Si on a le texte principal, on peut générer
      if (sessionData.textContent && (userText.toLowerCase().includes('oui') ||
        userText.toLowerCase().includes('go') ||
        userText.toLowerCase().includes('lance') ||
        userText.toLowerCase().includes('génère'))) {
        console.log("🎵 Génération demandée");
        return await this.generateAudio(sessionData, threadId);
      }

      // Déterminer la prochaine question pertinente
      let response: string;
      let phase: string = 'clarification';

      if (!sessionData.textContent) {
        // Si on a détecté du texte dans ce message
        if (detectedInfo.textContent) {
          response = `${getRandomResponse(CONVERSATION_PROMPTS.encouragement)} "${detectedInfo.textContent.slice(0, 50)}${detectedInfo.textContent.length > 50 ? '...' : ''}"`;

          // Demander des infos supplémentaires optionnelles
          if (!sessionData.targetAudience) {
            response += `\n\n${getRandomResponse(CONVERSATION_PROMPTS.clarification.audience)}`;
          } else if (!sessionData.voiceGender) {
            response += `\n\n${getRandomResponse(CONVERSATION_PROMPTS.clarification.voice)}`;
          } else if (!sessionData.emotionStyle) {
            response += `\n\n${getRandomResponse(CONVERSATION_PROMPTS.clarification.style)}`;
          } else {
            // On a tout, proposer de générer
            response += `\n\n${getRandomResponse(CONVERSATION_PROMPTS.readyToGenerate)}`;
            phase = 'generation';
          }
        } else {
          // Demander le texte
          response = getRandomResponse(CONVERSATION_PROMPTS.clarification.text);
        }
      } else {
        // On a le texte, enrichir avec d'autres infos
        response = getRandomResponse(CONVERSATION_PROMPTS.encouragement);

        if (!sessionData.targetAudience && confidence < 0.5) {
          response += ` ${getRandomResponse(CONVERSATION_PROMPTS.clarification.audience)}`;
        } else if (!sessionData.voiceGender && confidence < 0.7) {
          response += ` ${getRandomResponse(CONVERSATION_PROMPTS.clarification.voice)}`;
        } else if (!sessionData.emotionStyle && confidence < 0.8) {
          response += ` ${getRandomResponse(CONVERSATION_PROMPTS.clarification.style)}`;
        } else {
          // Proposer de générer
          response = getRandomResponse(CONVERSATION_PROMPTS.readyToGenerate);
          phase = 'generation';
          sessionData.isReadyToGenerate = true;
        }
      }

      // Créer le message de réponse
      const responseMessage = new AIMessage(response);
      history.push(`Assistant: ${response}`);
      conversationHistory.set(threadId, history);

      // Collecter les infos pour l'affichage
      const collectedInfo: string[] = [];
      if (sessionData.projectType) collectedInfo.push(`Type: ${sessionData.projectType}`);
      if (sessionData.textContent) collectedInfo.push('Texte fourni ✓');
      if (sessionData.targetAudience) collectedInfo.push(`Public: ${sessionData.targetAudience}`);
      if (sessionData.voiceGender) collectedInfo.push(`Voix: ${sessionData.voiceGender}`);
      if (sessionData.emotionStyle) collectedInfo.push(`Style: ${sessionData.emotionStyle}`);

      return {
        messages: [responseMessage],
        conversationState: { phase, step: history.length },
        historyLength: history.length,
        audioGenerated: false,
        collectedInfo
      };

    } catch (error: unknown) {
      console.error("❌ Erreur dans l'agent:", error);
      const errorMessage = new AIMessage(
        "😅 Oups ! J'ai eu un petit souci. Peux-tu reformuler ta demande ?"
      );

      return {
        messages: [errorMessage],
        conversationState: { phase: 'error', step: history.length },
        historyLength: history.length,
        audioGenerated: false
      };
    }
  },

  async generateAudio(sessionData: CollectedData, threadId: string): Promise<AgentResponse> {
    console.log("🎵 Génération audio avec données:", sessionData);

    try {
      if (!sessionData.textContent) {
        throw new Error("Contenu textuel manquant");
      }

      // Choisir la voix optimale intelligemment
      const voiceName: string = recommendVoice({
        projectType: sessionData.projectType,
        targetAudience: sessionData.targetAudience,
        emotion: sessionData.emotionStyle,
        gender: sessionData.voiceGender
      });

      // Préparer les paramètres
      const generationParams = {
        text: sessionData.textContent,
        voiceName: voiceName,
        emotion: sessionData.emotionStyle || 'neutral',
        speed: 1.0,
        effects: []
      };

      console.log("🎯 Paramètres génération:", generationParams);

      // Générer l'audio
      const audioResult = await audioGenerationTool.invoke(generationParams);

      if (audioResult.success) {
        const funMessages = [
          "🎉 Tadaaa ! Ton audio est prêt ! J'espère qu'il te plaira autant qu'à moi !",
          "✨ Et voilà ! J'ai mis tout mon cœur dans cet audio. Écoute-le vite !",
          "🚀 Mission accomplie ! Ton audio est fin prêt. C'est du lourd !",
          "🎵 Boom ! Audio généré avec succès ! J'ai hâte que tu l'écoutes !"
        ];

        const summaryMessage = new AIMessage(
          `${getRandomResponse(funMessages)}\n\n` +
          `📋 **Petit récap de ton projet :**\n` +
          (sessionData.projectType ? `• **Type :** ${sessionData.projectType}\n` : '') +
          (sessionData.targetAudience ? `• **Public :** ${sessionData.targetAudience}\n` : '') +
          `• **Voix :** ${this.getVoiceDisplayName(voiceName)}\n` +
          (sessionData.emotionStyle ? `• **Style :** ${this.getStyleDisplayName(sessionData.emotionStyle)}\n` : '') +
          `• **Durée :** ~${('duration' in audioResult ? audioResult.duration : 0)}s\n\n` +
          `🎧 Tu peux maintenant écouter et télécharger ton audio ci-dessus.\n\n` +
          `💡 **Envie d'autre chose ?** Dis-moi "nouveau" pour créer un autre audio ou explique-moi ce que tu veux modifier !`
        );

        // Reset pour un nouveau projet
        sessionStore.delete(threadId);
        conversationHistory.delete(threadId);

        return {
          messages: [summaryMessage],
          conversationState: { phase: 'complete', step: 6 },
          historyLength: 6,
          audioGenerated: true,
          audioUrl: ('url' in audioResult) ? audioResult.url : undefined,
          sessionData: sessionData
        };
      } else {
        throw new Error(('error' in audioResult ? audioResult.error : audioResult.message) || "Échec de génération");
      }
    } catch (error: unknown) {
      console.error("❌ Erreur génération:", error);
      const errorMessage = new AIMessage(
        `😔 Oups, j'ai eu un problème lors de la génération...\n${error instanceof Error ? error.message : 'Erreur inconnue'}\n\n` +
        `Pas de panique ! Tape "oui" pour réessayer ou "nouveau" pour recommencer avec un autre projet.`
      );

      return {
        messages: [errorMessage],
        conversationState: { phase: 'error', step: 5 },
        historyLength: 5,
        audioGenerated: false
      };
    }
  },

  getVoiceDisplayName(voiceName: string): string {
    const voiceDisplayNames: Record<string, string> = {
      'aoede': 'Aoede (voix féminine chaleureuse)',
      'achernar': 'Achernar (voix masculine forte)',
      'callirrhoe': 'Callirrhoe (voix jeune et dynamique)',
      'charon': 'Charon (voix grave et mystérieuse)',
      'despina': 'Despina (voix moderne et claire)',
      'orus': 'Orus (voix masculine professionnelle)',
      'pulcherrima': 'Pulcherrima (voix élégante)',
      'vindemiatrix': 'Vindemiatrix (voix expressive)',
      'zephyr': 'Zephyr (voix apaisante)',
      'sadachbia': 'Sadachbia (voix traditionnelle)',
      'fenrir': 'Fenrir (voix dramatique)'
    };

    return voiceDisplayNames[voiceName] || voiceName;
  },

  getStyleDisplayName(style: string): string {
    const styleNames: Record<string, string> = {
      'professional': 'Professionnel',
      'warm': 'Chaleureux',
      'energetic': 'Dynamique',
      'calm': 'Calme',
      'dramatic': 'Dramatique',
      'neutral': 'Naturel'
    };

    return styleNames[style] || style;
  },

  // Méthode pour vider l'historique d'une session
  clearHistory(threadId: string): void {
    sessionStore.delete(threadId);
    conversationHistory.delete(threadId);
    console.log("🗑️ Session supprimée:", threadId);
  }
};

console.log("✅ Agent audio intelligent créé");