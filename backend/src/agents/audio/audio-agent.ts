// backend/src/agents/audio/audio-agent.ts

import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { audioGenerationTool } from "./tools/audio-generation";
import { recommendVoice } from "../../services/audio/VoiceGuide";

console.log("🚀 Initialisation de l'agent audio intelligent...");

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

const agentWithTools = agentModel.bindTools([audioGenerationTool]);

// Interface pour les données collectées
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
  currentStep?: string; // Ajout du suivi de l'étape actuelle
  hasAskedForText?: boolean; // Flag pour éviter de redemander le texte
}

// Énumération des étapes
enum ConversationStep {
  INITIAL = 'initial',
  PROJECT_TYPE = 'project_type',
  TEXT_CONTENT = 'text_content',
  TARGET_AUDIENCE = 'target_audience',
  VOICE_PREFERENCE = 'voice_preference',
  STYLE_EMOTION = 'style_emotion',
  CONFIRMATION = 'confirmation',
  GENERATION = 'generation',
  COMPLETE = 'complete'
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

// Stockage en mémoire des sessions
const sessionStore = new Map<string, CollectedData>();
const conversationHistory = new Map<string, { role: string; content: string }[]>();

// Prompts optimisés par étape
const STEP_PROMPTS = {
  [ConversationStep.INITIAL]: [
    "🎙️ Salut ! Je suis ton assistant audio d'Ekho Studio. Quel type de contenu audio tu veux créer aujourd'hui ? (publicité, podcast, formation, narration...)",
    "🎵 Bienvenue sur Ekho Studio ! Dis-moi, c'est pour quel type de projet audio ?",
  ],
  [ConversationStep.TEXT_CONTENT]: [
    "Super choix ! Maintenant, quel est le texte exact que tu veux transformer en audio ?",
    "Génial ! Partage-moi le texte que tu veux vocaliser.",
    "Parfait ! Quel message veux-tu faire passer ? Donne-moi le texte complet."
  ],
  [ConversationStep.TARGET_AUDIENCE]: [
    "C'est noté ! Pour qui est destiné cet audio ? (grand public, professionnels, enfants...)",
    "Excellent ! Qui va écouter ton audio ?",
    "Top ! À quel public s'adresse ton message ?"
  ],
  [ConversationStep.VOICE_PREFERENCE]: [
    "Compris ! Quel type de voix préfères-tu ? (masculine, féminine, jeune, mature...)",
    "D'accord ! Tu préfères une voix masculine, féminine, ou peu importe ?",
  ],
  [ConversationStep.STYLE_EMOTION]: [
    "Presque fini ! Quel style veux-tu donner à ton audio ? (dynamique, calme, professionnel, chaleureux...)",
    "Dernière touche : quelle ambiance souhaites-tu ?",
  ],
  [ConversationStep.CONFIRMATION]: [
    "🚀 Parfait ! J'ai tout ce qu'il me faut. On lance la création de ton audio ?",
    "✨ Super ! Tout est prêt. Je peux générer ton audio maintenant ?",
  ]
};

// Fonction pour déterminer la prochaine étape
function getNextStep(sessionData: CollectedData): ConversationStep {
  if (!sessionData.projectType) return ConversationStep.PROJECT_TYPE;
  if (!sessionData.textContent && !sessionData.hasAskedForText) return ConversationStep.TEXT_CONTENT;
  if (!sessionData.targetAudience) return ConversationStep.TARGET_AUDIENCE;
  if (!sessionData.voiceGender) return ConversationStep.VOICE_PREFERENCE;
  if (!sessionData.emotionStyle) return ConversationStep.STYLE_EMOTION;
  if (!sessionData.isReadyToGenerate) return ConversationStep.CONFIRMATION;
  return ConversationStep.GENERATION;
}

// Fonction pour détecter le type de projet
function detectProjectType(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  const projectTypes = {
    'publicité': ['pub', 'publicité', 'annonce', 'spot', 'commercial'],
    'podcast': ['podcast', 'émission', 'chronique'],
    'formation': ['formation', 'cours', 'tutoriel', 'e-learning', 'éducatif'],
    'narration': ['narration', 'histoire', 'conte', 'documentaire', 'récit'],
    'présentation': ['présentation', 'pitch', 'conférence'],
    'audiobook': ['audiobook', 'livre audio', 'lecture']
  };

  for (const [type, keywords] of Object.entries(projectTypes)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return type;
    }
  }
  return null;
}

// Fonction pour détecter le public cible
function detectTargetAudience(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  const audiences = {
    'grand public': ['grand public', 'tout public', 'général', 'tous'],
    'professionnels': ['professionnel', 'entreprise', 'b2b', 'business', 'corporate'],
    'jeunes': ['jeune', 'ado', 'adolescent', 'étudiant', 'génération z'],
    'enfants': ['enfant', 'kids', 'jeunesse', 'petit'],
    'familles': ['famille', 'familial', 'parent'],
    'seniors': ['senior', 'âgé', 'retraité']
  };

  for (const [audience, keywords] of Object.entries(audiences)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return audience;
    }
  }
  return null;
}

// Fonction pour détecter les préférences de voix
function detectVoicePreference(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('masculin') || lowerMessage.includes('homme')) return 'masculine';
  if (lowerMessage.includes('féminin') || lowerMessage.includes('femme')) return 'feminine';
  if (lowerMessage.includes('jeune')) return 'jeune';
  if (lowerMessage.includes('mature') || lowerMessage.includes('âgé')) return 'mature';
  if (lowerMessage.includes('peu importe') || lowerMessage.includes('aucune préférence')) return 'neutral';
  return null;
}

// Fonction pour détecter le style émotionnel
function detectEmotionStyle(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  const styles = {
    'dynamique': ['dynamique', 'énergique', 'enjoué', 'enthousiaste'],
    'calme': ['calme', 'posé', 'tranquille', 'apaisant', 'zen'],
    'professionnel': ['professionnel', 'sérieux', 'formel', 'corporate'],
    'chaleureux': ['chaleureux', 'amical', 'sympathique', 'convivial'],
    'dramatique': ['dramatique', 'intense', 'émotionnel', 'passionné'],
    'neutre': ['neutre', 'naturel', 'normal']
  };

  for (const [style, keywords] of Object.entries(styles)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return style;
    }
  }
  return null;
}

// Fonction améliorée pour analyser le message utilisateur
async function analyzeUserMessage(
  message: string,
  sessionData: CollectedData,
  currentStep: ConversationStep
): Promise<Partial<CollectedData>> {
  const detectedInfo: Partial<CollectedData> = {};

  // Analyse basée sur l'étape actuelle
  switch (currentStep) {
    case ConversationStep.PROJECT_TYPE:
      const projectType = detectProjectType(message);
      if (projectType) detectedInfo.projectType = projectType;
      break;

    case ConversationStep.TEXT_CONTENT:
      // Le texte est tout ce qui est fourni à cette étape
      if (message.length > 10) {
        detectedInfo.textContent = message.trim();
        detectedInfo.hasAskedForText = true;
      }
      break;

    case ConversationStep.TARGET_AUDIENCE:
      const audience = detectTargetAudience(message);
      if (audience) detectedInfo.targetAudience = audience;
      break;

    case ConversationStep.VOICE_PREFERENCE:
      const voice = detectVoicePreference(message);
      if (voice) detectedInfo.voiceGender = voice;
      break;

    case ConversationStep.STYLE_EMOTION:
      const style = detectEmotionStyle(message);
      if (style) detectedInfo.emotionStyle = style;
      break;

    case ConversationStep.CONFIRMATION:
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.match(/oui|ok|go|lance|génère|parfait|c'est bon/)) {
        detectedInfo.isReadyToGenerate = true;
      }
      break;
  }

  // Détection opportuniste : si l'utilisateur donne plusieurs infos d'un coup
  if (!sessionData.projectType) {
    const projectType = detectProjectType(message);
    if (projectType) detectedInfo.projectType = projectType;
  }

  // NE PAS détecter automatiquement le texte sauf si on est à l'étape TEXT_CONTENT
  // Cela évite de prendre n'importe quelle phrase comme étant le texte à vocaliser

  return detectedInfo;
}

// Fonction pour obtenir une réponse appropriée selon l'étape
function getStepResponse(step: ConversationStep, sessionData: CollectedData): string {
  const prompts = STEP_PROMPTS[step];
  if (!prompts || prompts.length === 0) {
    return "Dis-moi en plus sur ton projet !";
  }

  // Personnaliser la réponse selon le contexte
  let response = prompts[Math.floor(Math.random() * prompts.length)];

  // Ajouter des encouragements contextuels
  if (sessionData.projectType && step === ConversationStep.TEXT_CONTENT) {
    response = `Une ${sessionData.projectType}, excellent choix ! ${response}`;
  }

  return response;
}

// Fonction pour vérifier si on peut passer à l'étape suivante
function canProceedToNextStep(sessionData: CollectedData, currentStep: ConversationStep): boolean {
  switch (currentStep) {
    case ConversationStep.PROJECT_TYPE:
      return !!sessionData.projectType;
    case ConversationStep.TEXT_CONTENT:
      return !!sessionData.textContent;
    case ConversationStep.TARGET_AUDIENCE:
      return !!sessionData.targetAudience;
    case ConversationStep.VOICE_PREFERENCE:
      return !!sessionData.voiceGender;
    case ConversationStep.STYLE_EMOTION:
      return !!sessionData.emotionStyle;
    case ConversationStep.CONFIRMATION:
      return !!sessionData.isReadyToGenerate;
    default:
      return false;
  }
}

export const audioAgent = {
  async invoke(input: any, config: any): Promise<AgentResponse> {
    console.log("🤖 Agent intelligent appelé");

    const threadId: string = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("Thread ID manquant");
    }

    // Récupérer ou initialiser les données de session
    let sessionData: CollectedData = sessionStore.get(threadId) || {
      currentStep: ConversationStep.INITIAL
    };
    let history = conversationHistory.get(threadId) || [];

    // Extraire le message utilisateur
    const userMessage = input.messages?.[input.messages.length - 1];
    const userText: string = userMessage?.content || '';

    console.log("📊 État session:", {
      currentStep: sessionData.currentStep,
      hasText: !!sessionData.textContent,
      hasProjectType: !!sessionData.projectType,
      historyLength: history.length,
      userMessage: userText.slice(0, 50)
    });

    try {
      // Si c'est le premier message
      if (history.length === 0) {
        const welcomeMessage = new AIMessage(getStepResponse(ConversationStep.INITIAL, sessionData));
        history.push({ role: 'assistant', content: welcomeMessage.content as string });
        conversationHistory.set(threadId, history);

        sessionData.currentStep = ConversationStep.PROJECT_TYPE;
        sessionStore.set(threadId, sessionData);

        return {
          messages: [welcomeMessage],
          conversationState: { phase: 'discovery', step: 1 },
          historyLength: 1,
          audioGenerated: false,
          sessionData
        };
      }

      // Ajouter le message utilisateur à l'historique
      history.push({ role: 'user', content: userText });

      // Analyser le message selon l'étape actuelle
      const currentStep = sessionData.currentStep as ConversationStep;
      const detectedInfo = await analyzeUserMessage(userText, sessionData, currentStep);

      console.log("🔍 Analyse du message:", {
        currentStep,
        detectedInfo,
        userText: userText.slice(0, 50)
      });

      // Mettre à jour les données de session
      sessionData = { ...sessionData, ...detectedInfo };

      // Vérifier si on peut passer à l'étape suivante
      if (canProceedToNextStep(sessionData, currentStep)) {
        const nextStep = getNextStep(sessionData);
        sessionData.currentStep = nextStep;
        console.log(`✅ Passage à l'étape: ${currentStep} -> ${nextStep}`);
      } else {
        console.log(`⏸️ Reste à l'étape: ${currentStep} (info manquante)`);
      }

      sessionStore.set(threadId, sessionData);

      // Si on est prêt à générer
      if (sessionData.currentStep === ConversationStep.GENERATION && sessionData.isReadyToGenerate) {
        console.log("🎵 Génération audio demandée");

        const statusMessage = new AIMessage(
          "🎵 Super ! Je lance la génération de ton audio... Ça va prendre quelques secondes ⏳"
        );
        history.push({ role: 'assistant', content: statusMessage.content as string });
        conversationHistory.set(threadId, history);

        return await this.generateAudio(sessionData, threadId);
      }

      // Générer la réponse appropriée pour l'étape actuelle
      const response = getStepResponse(sessionData.currentStep as ConversationStep, sessionData);

      // Déterminer la phase pour le frontend
      let phase = 'discovery';
      if (sessionData.textContent) {
        phase = 'clarification';
      }
      if (sessionData.currentStep === ConversationStep.CONFIRMATION) {
        phase = 'generation';
      }

      // Créer le message de réponse
      const responseMessage = new AIMessage(response);
      history.push({ role: 'assistant', content: response });
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
        collectedInfo,
        sessionData
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

      // Choisir la voix optimale
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
          `${funMessages[Math.floor(Math.random() * funMessages.length)]}\n\n` +
          `📋 Petit récap de ton projet :\n` +
          (sessionData.projectType ? `• Type : ${sessionData.projectType}\n` : '') +
          (sessionData.targetAudience ? `• Public : ${sessionData.targetAudience}\n` : '') +
          `• Voix : ${this.getVoiceDisplayName(voiceName)}\n` +
          (sessionData.emotionStyle ? `• Style : ${this.getStyleDisplayName(sessionData.emotionStyle)}\n` : '') +
          `• Durée : ~${('duration' in audioResult ? audioResult.duration : 0)}s\n\n` +
          `🎧 Tu peux maintenant écouter et télécharger ton audio ci-dessus.\n\n` +
          `💡 Envie d'autre chose ? Dis-moi "nouveau" pour créer un autre audio !`
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

  clearHistory(threadId: string): void {
    sessionStore.delete(threadId);
    conversationHistory.delete(threadId);
    console.log("🗑️ Session supprimée:", threadId);
  }
};

console.log("✅ Agent audio intelligent créé");