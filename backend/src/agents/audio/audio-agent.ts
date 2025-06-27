// backend/src/agents/audio/audio-agent.ts

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { audioGenerationTool } from "./tools/audio-generation";
import { recommendVoice } from "../../services/audio/VoiceGuide";

console.log("🚀 Initialisation de l'agent audio intelligent...");

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';

const agentModel = new ChatOpenAI({
  temperature: 0.7,
  model: "local-model",
  apiKey: "lm-studio",
  configuration: {
    baseURL: LM_STUDIO_URL
  }
});

const agentWithTools = agentModel.bindTools([audioGenerationTool]);

interface CollectedData {
  textContent?: string;
  emotionStyle?: string;
  targetAudience?: string;
  voiceGender?: string;
  projectType?: string;
  isReadyToGenerate?: boolean;
}

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

const sessionStore = new Map<string, CollectedData>();
const conversationHistory = new Map<string, { role: string; content: string }[]>();

// Détection améliorée du texte
function detectTextContent(message: string): string | null {
  const cleanedMessage = message.trim();

  // Patterns prioritaires pour détecter le texte
  const patterns = [
    // Texte entre guillemets
    /["«"''](.+?)["»"'']/,
    // Après "le texte est" ou similaire
    /(?:le texte est|texte\s*:|voici le texte)\s*:?\s*(.+)/i,
    // Message complet si > 20 mots et pas une question
    { pattern: /^(.+)$/, condition: (m: string) => m.split(/\s+/).length > 20 && !m.includes('?') }
  ];

  for (const p of patterns) {
    if ('pattern' in p) {
      if (p.condition(cleanedMessage)) {
        return cleanedMessage;
      }
    } else {
      const match = cleanedMessage.match(p);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  // Si le message fait plus de 30 caractères sans être une question
  if (cleanedMessage.length > 30 && !cleanedMessage.includes('?') &&
    !cleanedMessage.toLowerCase().includes('veux') &&
    !cleanedMessage.toLowerCase().includes('créer')) {
    return cleanedMessage;
  }

  return null;
}

// Détection du style
function detectStyle(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  const styleMapping: Record<string, string> = {
    'dynamique': 'energetic',
    'calme': 'calm',
    'pro': 'professional',
    'professionnel': 'professional',
    'énergique': 'energetic',
    'doux': 'calm',
    'sérieux': 'professional',
    'fun': 'energetic',
    'apaisant': 'calm'
  };

  for (const [key, value] of Object.entries(styleMapping)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }

  return null;
}

// Détection du public
function detectAudience(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  const audienceMapping: Record<string, string> = {
    'jeune': 'jeunes adultes',
    'famille': 'familles',
    'pro': 'professionnels',
    'enfant': 'enfants',
    'entreprise': 'professionnels',
    'ado': 'adolescents',
    'senior': 'seniors',
    'étudiant': 'étudiants'
  };

  for (const [key, value] of Object.entries(audienceMapping)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }

  return null;
}

// Vérifier si on peut générer
function canGenerate(data: CollectedData): boolean {
  return !!(data.textContent && (data.emotionStyle || data.targetAudience));
}

// Obtenir la prochaine question
function getNextQuestion(data: CollectedData): string {
  if (!data.textContent) {
    return "🎤 Quel texte veux-tu transformer en audio ?";
  }

  if (!data.emotionStyle) {
    return "✨ Quel style : dynamique 🎯, calme 😌 ou professionnel 💼 ?";
  }

  if (!data.targetAudience) {
    return "👥 Pour qui : jeunes 👦, familles 👨‍👩‍👧 ou pros 👔 ?";
  }

  return "🚀 Super ! J'ai tout ce qu'il faut. On génère ton audio ?";
}

export const audioAgent = {
  async invoke(input: any, config: any): Promise<AgentResponse> {
    console.log("🤖 Agent appelé");

    const threadId: string = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("Thread ID manquant");
    }

    let sessionData: CollectedData = sessionStore.get(threadId) || {};
    let history = conversationHistory.get(threadId) || [];

    const userMessage = input.messages?.[input.messages.length - 1];
    const userText: string = userMessage?.content || '';

    console.log("📊 État:", {
      hasText: !!sessionData.textContent,
      userMessage: userText.slice(0, 50),
      step: history.length
    });

    try {
      // Premier message ou message vide
      if (history.length === 0 || userText === "") {
        const welcomeMessage = new AIMessage(
          "🎙️ Salut ! Je suis ton assistant Ekho Studio. Dis-moi directement ton texte à transformer en audio, ou décris ton projet !"
        );
        if (history.length === 0) {
          history.push({ role: 'assistant', content: welcomeMessage.content as string });
          conversationHistory.set(threadId, history);
        }

        return {
          messages: [welcomeMessage],
          conversationState: { phase: 'discovery', step: 1 },
          historyLength: 1,
          audioGenerated: false
        };
      }

      // Ajouter à l'historique
      history.push({ role: 'user', content: userText });

      // Détection automatique des informations
      const detectedText = detectTextContent(userText);
      const detectedStyle = detectStyle(userText);
      const detectedAudience = detectAudience(userText);

      // Mise à jour des données
      if (detectedText && !sessionData.textContent) {
        sessionData.textContent = detectedText;
        console.log("✅ Texte détecté:", detectedText.slice(0, 50));
      }
      if (detectedStyle && !sessionData.emotionStyle) {
        sessionData.emotionStyle = detectedStyle;
        console.log("✅ Style détecté:", detectedStyle);
      }
      if (detectedAudience && !sessionData.targetAudience) {
        sessionData.targetAudience = detectedAudience;
        console.log("✅ Public détecté:", detectedAudience);
      }

      sessionStore.set(threadId, sessionData);

      // Si l'utilisateur confirme et qu'on peut générer
      const confirmWords = ['oui', 'ok', 'go', 'lance', 'génère', 'parfait', 'super'];
      const userConfirms = confirmWords.some(word => userText.toLowerCase().includes(word));

      if (canGenerate(sessionData) && (userConfirms || history.length > 4)) {
        console.log("🎵 Génération audio !");

        const statusMessage = new AIMessage(
          "🎵 C'est parti ! Je génère ton audio... Ça prend quelques secondes ⏳"
        );
        history.push({ role: 'assistant', content: statusMessage.content as string });
        conversationHistory.set(threadId, history);

        return await this.generateAudio(sessionData, threadId);
      }

      // Sinon, poser la prochaine question
      const nextQuestion = getNextQuestion(sessionData);
      const phase = !sessionData.textContent ? 'discovery' :
        canGenerate(sessionData) ? 'generation' : 'clarification';

      const responseMessage = new AIMessage(nextQuestion);
      history.push({ role: 'assistant', content: nextQuestion });
      conversationHistory.set(threadId, history);

      // Collecter les infos pour l'affichage
      const collectedInfo: string[] = [];
      if (sessionData.textContent) collectedInfo.push('Texte ✓');
      if (sessionData.emotionStyle) collectedInfo.push(`Style: ${sessionData.emotionStyle}`);
      if (sessionData.targetAudience) collectedInfo.push(`Public: ${sessionData.targetAudience}`);

      return {
        messages: [responseMessage],
        conversationState: { phase, step: history.length },
        historyLength: history.length,
        audioGenerated: false,
        collectedInfo,
        sessionData
      };

    } catch (error: unknown) {
      console.error("❌ Erreur:", error);
      const errorMessage = new AIMessage(
        "😅 Oups ! Petit bug. Réessaye !"
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
    console.log("🎵 Génération audio:", sessionData);

    try {
      if (!sessionData.textContent) {
        throw new Error("Texte manquant");
      }

      const voiceName = recommendVoice({
        emotion: sessionData.emotionStyle,
        targetAudience: sessionData.targetAudience,
        gender: sessionData.voiceGender
      });

      const generationParams = {
        text: sessionData.textContent,
        voiceName: voiceName,
        emotion: sessionData.emotionStyle || 'neutral',
        speed: 1.0,
        effects: []
      };

      console.log("🎯 Paramètres:", generationParams);

      const audioResult = await audioGenerationTool.invoke(generationParams);

      if (audioResult.success && audioResult.url) {
        const successMessage = new AIMessage(
          `🎉 Tadaaa ! Ton audio est prêt !\n\n` +
          `📋 Récap :\n` +
          `• Voix : ${voiceName}\n` +
          (sessionData.emotionStyle ? `• Style : ${sessionData.emotionStyle}\n` : '') +
          (sessionData.targetAudience ? `• Public : ${sessionData.targetAudience}\n` : '') +
          `\n🎧 Écoute et télécharge ton audio ci-dessus !`
        );

        // Reset session
        sessionStore.delete(threadId);
        conversationHistory.delete(threadId);

        return {
          messages: [successMessage],
          conversationState: { phase: 'complete', step: 6 },
          historyLength: 6,
          audioGenerated: true,
          audioUrl: audioResult.url,
          sessionData
        };
      } else {
        throw new Error(audioResult.error || "Échec génération");
      }
    } catch (error: unknown) {
      console.error("❌ Erreur génération:", error);
      const errorMessage = new AIMessage(
        `😔 Oups, problème de génération...\nRéessaye en tapant "oui" !`
      );

      return {
        messages: [errorMessage],
        conversationState: { phase: 'error', step: 5 },
        historyLength: 5,
        audioGenerated: false
      };
    }
  },

  clearHistory(threadId: string): void {
    sessionStore.delete(threadId);
    conversationHistory.delete(threadId);
    console.log("🗑️ Session supprimée:", threadId);
  }
};

console.log("✅ Agent audio créé");