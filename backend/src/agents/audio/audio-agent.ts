// backend/src/agents/audio/audio-agent.ts

import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { audioGenerationTool } from "./tools/audio-generation";
import { recommendVoice } from "../../services/audio/VoiceGuide";

console.log("🚀 Initialisation de l'agent audio structuré...");

// URL de LM Studio depuis la variable d'environnement
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
console.log("🌍 URL LM Studio:", LM_STUDIO_URL);

const agentModel = new ChatOpenAI({
  temperature: 0.3, // Plus bas pour des réponses plus cohérentes
  model: "local-model",
  apiKey: "lm-studio",
  configuration: {
    baseURL: LM_STUDIO_URL
  }
});

// Ajouter les outils à l'agent
const agentWithTools = agentModel.bindTools([audioGenerationTool]);

// Interface pour les données collectées étape par étape
interface CollectedData {
  step: number;
  projectType?: string;
  textContent?: string;
  targetAudience?: string;
  voiceGender?: string;
  emotionStyle?: string;
  isComplete: boolean;
}

// Interface pour une étape du processus
interface ProcessStep {
  name: string;
  question: string;
  validate: (answer: string) => boolean;
  process: (answer: string, data: CollectedData) => void;
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

// Stockage en mémoire des sessions avec progression étape par étape
const sessionStore = new Map<string, CollectedData>();

// Définition des étapes structurées
const STEPS: Record<number, ProcessStep> = {
  1: {
    name: "Type de projet",
    question: "Quel type de contenu audio souhaitez-vous créer ?\n\n• Publicité radio\n• Formation/E-learning\n• Podcast\n• Documentaire\n• Présentation\n• Autre\n\nRépondez simplement par le type qui vous intéresse.",
    validate: (answer: string): boolean => answer.length > 2,
    process: (answer: string, data: CollectedData): void => {
      const lower = answer.toLowerCase();
      if (lower.includes('pub') || lower.includes('radio')) {
        data.projectType = 'publicité radio';
      } else if (lower.includes('formation') || lower.includes('learning')) {
        data.projectType = 'formation';
      } else if (lower.includes('podcast')) {
        data.projectType = 'podcast';
      } else if (lower.includes('documentaire')) {
        data.projectType = 'documentaire';
      } else if (lower.includes('présentation')) {
        data.projectType = 'présentation';
      } else {
        data.projectType = answer.trim();
      }
    }
  },
  2: {
    name: "Contenu à vocaliser",
    question: "Parfait ! Maintenant, quel est le texte exact que vous souhaitez faire vocaliser ?\n\nÉcrivez simplement votre texte ci-dessous :",
    validate: (answer: string): boolean => answer.length > 10,
    process: (answer: string, data: CollectedData): void => {
      data.textContent = answer.trim();
    }
  },
  3: {
    name: "Public cible",
    question: "Excellent ! Qui est votre public cible ?\n\n• Enfants (moins de 12 ans)\n• Adolescents (12-18 ans)\n• Jeunes adultes (18-35 ans)\n• Adultes (35-55 ans)\n• Seniors (55+ ans)\n• Professionnels\n• Grand public\n\nRépondez simplement par la catégorie qui correspond.",
    validate: (answer: string): boolean => answer.length > 2,
    process: (answer: string, data: CollectedData): void => {
      const lower = answer.toLowerCase();
      if (lower.includes('enfant')) {
        data.targetAudience = 'enfants';
      } else if (lower.includes('ado') || lower.includes('12-18')) {
        data.targetAudience = 'adolescents';
      } else if (lower.includes('jeune') || lower.includes('18-35')) {
        data.targetAudience = 'jeunes adultes';
      } else if (lower.includes('adulte') || lower.includes('35-55')) {
        data.targetAudience = 'adultes';
      } else if (lower.includes('senior') || lower.includes('55')) {
        data.targetAudience = 'seniors';
      } else if (lower.includes('professionnel')) {
        data.targetAudience = 'professionnels';
      } else if (lower.includes('grand public')) {
        data.targetAudience = 'grand public';
      } else {
        data.targetAudience = answer.trim();
      }
    }
  },
  4: {
    name: "Type de voix",
    question: "Quel type de voix préférez-vous ?\n\n• Voix masculine\n• Voix féminine\n• Peu importe\n\nRépondez simplement par votre préférence.",
    validate: (answer: string): boolean => answer.length > 2,
    process: (answer: string, data: CollectedData): void => {
      const lower = answer.toLowerCase();
      if (lower.includes('masculin') || lower.includes('homme')) {
        data.voiceGender = 'masculine';
      } else if (lower.includes('féminin') || lower.includes('femme')) {
        data.voiceGender = 'feminine';
      } else {
        data.voiceGender = 'neutral';
      }
    }
  },
  5: {
    name: "Style et émotion",
    question: "Dernière question ! Quel style souhaitez-vous pour votre audio ?\n\n• Professionnel et neutre\n• Chaleureux et amical\n• Dynamique et énergique\n• Calme et posé\n• Dramatique et expressif\n\nRépondez par le style qui vous correspond.",
    validate: (answer: string): boolean => answer.length > 2,
    process: (answer: string, data: CollectedData): void => {
      const lower = answer.toLowerCase();
      if (lower.includes('professionnel')) {
        data.emotionStyle = 'professional';
      } else if (lower.includes('chaleureux') || lower.includes('amical')) {
        data.emotionStyle = 'warm';
      } else if (lower.includes('dynamique') || lower.includes('énergique')) {
        data.emotionStyle = 'energetic';
      } else if (lower.includes('calme') || lower.includes('posé')) {
        data.emotionStyle = 'calm';
      } else if (lower.includes('dramatique') || lower.includes('expressif')) {
        data.emotionStyle = 'dramatic';
      } else {
        data.emotionStyle = 'neutral';
      }
      data.isComplete = true;
    }
  }
};

export const audioAgent = {
  async invoke(input: any, config: any): Promise<AgentResponse> {
    console.log("🤖 Agent structuré appelé");

    const threadId: string = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("Thread ID manquant");
    }

    // Récupérer ou initialiser les données de session
    let sessionData: CollectedData = sessionStore.get(threadId) || {
      step: 1,
      isComplete: false
    };

    // Extraire le message utilisateur
    const userMessage = input.messages?.[input.messages.length - 1];
    const userText: string = userMessage?.content || '';

    console.log("📊 État session:", {
      step: sessionData.step,
      isComplete: sessionData.isComplete,
      userMessage: userText.slice(0, 50)
    });

    try {
      // Si c'est le premier message, commencer par l'accueil
      if (sessionData.step === 1 && !userText.includes('créer') && userText.length < 10) {
        const welcomeMessage = new AIMessage(
          "🎙️ Bonjour ! Je suis votre assistant audio d'Ekho Studio.\n\n" +
          "Je vais vous aider à créer votre audio professionnel en 5 étapes simples.\n\n" +
          STEPS[1].question
        );

        return {
          messages: [welcomeMessage],
          conversationState: { phase: 'step_1', step: 1 },
          historyLength: 1,
          audioGenerated: false
        };
      }

      // Si toutes les étapes sont terminées, générer l'audio
      if (sessionData.isComplete) {
        console.log("🎵 Toutes les étapes terminées, génération audio...");
        return await this.generateAudio(sessionData, threadId);
      }

      // Traiter la réponse utilisateur pour l'étape actuelle
      const currentStep: ProcessStep | undefined = STEPS[sessionData.step];

      if (currentStep && currentStep.validate(userText)) {
        // Traiter la réponse
        currentStep.process(userText, sessionData);
        sessionData.step++;

        // Sauvegarder les données
        sessionStore.set(threadId, sessionData);

        console.log("✅ Étape", sessionData.step - 1, "validée:", {
          projectType: sessionData.projectType,
          textContent: sessionData.textContent?.slice(0, 30),
          targetAudience: sessionData.targetAudience,
          voiceGender: sessionData.voiceGender,
          emotionStyle: sessionData.emotionStyle
        });

        // Si toutes les étapes sont terminées, générer
        if (sessionData.isComplete) {
          console.log("🎯 Toutes les informations collectées, génération...");
          return await this.generateAudio(sessionData, threadId);
        }

        // Passer à l'étape suivante
        const nextStep: ProcessStep | undefined = STEPS[sessionData.step];
        if (nextStep) {
          const responseMessage = new AIMessage(
            `✅ Parfait !\n\n**Étape ${sessionData.step}/5** - ${nextStep.name}\n\n${nextStep.question}`
          );

          return {
            messages: [responseMessage],
            conversationState: { phase: `step_${sessionData.step}`, step: sessionData.step },
            historyLength: sessionData.step,
            audioGenerated: false,
            collectedInfo: this.getCollectedInfo(sessionData)
          };
        }
      } else {
        // Réponse invalide, redemander
        const errorMessage = new AIMessage(
          `❌ Je n'ai pas bien compris votre réponse.\n\n` +
          `**Étape ${sessionData.step}/5** - ${currentStep?.name || 'Inconnue'}\n\n${currentStep?.question || 'Question non trouvée'}`
        );

        return {
          messages: [errorMessage],
          conversationState: { phase: `step_${sessionData.step}`, step: sessionData.step },
          historyLength: sessionData.step,
          audioGenerated: false
        };
      }

      // Fallback si aucune condition n'est remplie
      throw new Error("État de conversation non géré");

    } catch (error: unknown) {
      console.error("❌ Erreur dans l'agent:", error);
      const errorMessage = new AIMessage(
        "❌ Une erreur s'est produite. Recommençons depuis le début.\n\n" + STEPS[1].question
      );

      // Reset la session
      sessionStore.set(threadId, { step: 1, isComplete: false });

      return {
        messages: [errorMessage],
        conversationState: { phase: 'step_1', step: 1 },
        historyLength: 1,
        audioGenerated: false
      };
    }
  },

  async generateAudio(sessionData: CollectedData, threadId: string): Promise<AgentResponse> {
    console.log("🎵 Génération audio avec données:", sessionData);

    try {
      // Vérifier que toutes les données nécessaires sont présentes
      if (!sessionData.textContent) {
        throw new Error("Contenu textuel manquant");
      }

      // Choisir la voix optimale
      const voiceName: string = this.selectOptimalVoice(sessionData);

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
        const summaryMessage = new AIMessage(
          `🎉 **Audio généré avec succès !**\n\n` +
          `📋 **Récapitulatif de votre projet :**\n` +
          `• **Type :** ${sessionData.projectType || 'Non spécifié'}\n` +
          `• **Public :** ${sessionData.targetAudience || 'Non spécifié'}\n` +
          `• **Voix :** ${this.getVoiceDisplayName(voiceName)}\n` +
          `• **Style :** ${this.getStyleDisplayName(sessionData.emotionStyle || 'neutral')}\n` +
          `• **Durée :** ~${('duration' in audioResult ? audioResult.duration : 0)}s\n\n` +
          `🎧 Vous pouvez maintenant écouter et télécharger votre audio ci-dessus.\n\n` +
          `💡 **Besoin de modifications ?** Tapez "nouveau" pour créer un autre audio ou "modifier [élément]" pour ajuster quelque chose.`
        );

        // Reset pour un nouveau projet
        sessionStore.delete(threadId);

        return {
          messages: [summaryMessage],
          conversationState: { phase: 'complete', step: 6 },
          historyLength: 6,
          audioGenerated: true,
          audioUrl: ('url' in audioResult) ? audioResult.url : undefined,
          sessionData: sessionData
        };
      } else {
        throw new Error(('error' in audioResult ? audioResult.error : audioResult.message) || "Échec de génération");      }
    } catch (error: unknown) {
      console.error("❌ Erreur génération:", error);
      const errorMessage = new AIMessage(
        `❌ Désolé, une erreur s'est produite lors de la génération :\n${error instanceof Error ? error.message : 'Erreur inconnue'}\n\n` +
        `Voulez-vous réessayer ? Tapez "oui" pour relancer ou "nouveau" pour recommencer.`
      );

      return {
        messages: [errorMessage],
        conversationState: { phase: 'error', step: sessionData.step },
        historyLength: sessionData.step,
        audioGenerated: false
      };
    }
  },

  selectOptimalVoice(sessionData: CollectedData): string {
    // Recommandation intelligente basée sur les données collectées
    const recommendation: string = recommendVoice({
      projectType: sessionData.projectType,
      targetAudience: sessionData.targetAudience,
      emotion: sessionData.emotionStyle,
      gender: sessionData.voiceGender
    });

    console.log("🎤 Voix recommandée:", recommendation);
    return recommendation;
  },

  getVoiceDisplayName(voiceName: string): string {
    const voiceDisplayNames: Record<string, string> = {
      'aoede': 'Aoede (féminine chaleureuse)',
      'achernar': 'Achernar (masculine forte)',
      'callirrhoe': 'Callirrhoe (jeune féminine)',
      'charon': 'Charon (masculine profonde)',
      'despina': 'Despina (féminine moderne)',
      'orus': 'Orus (masculine claire)',
      'pulcherrima': 'Pulcherrima (féminine élégante)',
      'vindemiatrix': 'Vindemiatrix (féminine expressive)',
      'zephyr': 'Zephyr (neutre apaisante)',
      'sadachbia': 'Sadachbia (neutre traditionnelle)',
      'fenrir': 'Fenrir (masculine dramatique)'
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

  getCollectedInfo(sessionData: CollectedData): string[] {
    const info: string[] = [];
    if (sessionData.projectType) info.push(`Type: ${sessionData.projectType}`);
    if (sessionData.textContent) info.push('Contenu fourni');
    if (sessionData.targetAudience) info.push(`Public: ${sessionData.targetAudience}`);
    if (sessionData.voiceGender) info.push(`Voix: ${sessionData.voiceGender}`);
    if (sessionData.emotionStyle) info.push(`Style: ${sessionData.emotionStyle}`);
    return info;
  },

  // Méthode pour vider l'historique d'une session
  clearHistory(threadId: string): void {
    sessionStore.delete(threadId);
    console.log("🗑️ Session supprimée:", threadId);
  }
};

console.log("✅ Agent audio structuré créé");