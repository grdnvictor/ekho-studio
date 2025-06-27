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
  temperature: 0.7,
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
const conversationHistory = new Map<string, { role: string; content: string }[]>();

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

// Fonction pour détecter si un message contient du texte à vocaliser
function detectTextContent(message: string): string | null {
  // Nettoyer le message
  const cleanedMessage = message.trim();
  
  // Patterns pour détecter le texte
  const textPatterns = [
    /^["«](.+)["»]$/,  // Entre guillemets
    /^[''](.+)['']$/,  // Entre apostrophes
    /le texte est\s*:?\s*(.+)/i,
    /voici le texte\s*:?\s*(.+)/i,
    /^(.+)$/  // Tout le message si aucun pattern
  ];

  for (const pattern of textPatterns) {
    const match = cleanedMessage.match(pattern);
    if (match && match[1]) {
      const extractedText = match[1].trim().replace(/^["«'']|["»'']$/g, '');
      // Vérifier que c'est bien du texte à vocaliser (plus de 3 mots ou entre guillemets)
      if (extractedText.split(/\s+/).length > 3 || /["«'']/.test(cleanedMessage)) {
        return extractedText;
      }
    }
  }

  // Si le message fait plus de 20 caractères et ne ressemble pas à une question
  if (cleanedMessage.length > 20 && !cleanedMessage.includes('?') && !cleanedMessage.toLowerCase().includes('je veux')) {
    return cleanedMessage;
  }

  return null;
}

// Analyser intelligemment le message utilisateur avec LLM
async function analyzeUserMessageWithLLM(
  message: string, 
  sessionData: CollectedData,
  conversationContext: { role: string; content: string }[]
): Promise<{
  detectedInfo: Partial<CollectedData>;
  confidence: number;
  intentRecognized: string;
}> {
  const prompt = `Tu es un assistant qui analyse les messages dans une conversation de création audio.
Analyse ce message et l'historique pour extraire les informations pertinentes.

Historique de conversation:
${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Nouveau message: "${message}"

Données déjà collectées: ${JSON.stringify(sessionData)}

IMPORTANT: Si le message contient du texte entre guillemets ou semble être le texte à vocaliser (plus de 20 caractères sans être une question), extrais-le comme textContent.

Retourne UNIQUEMENT un JSON avec:
{
  "detectedInfo": {
    "projectType": "type si mentionné (publicité/podcast/formation/etc)",
    "textContent": "texte à vocaliser si fourni",
    "targetAudience": "public cible si mentionné",
    "voiceGender": "masculine/feminine si préférence exprimée",
    "emotionStyle": "style émotionnel si mentionné"
  },
  "confidence": 0.0 à 1.0,
  "intentRecognized": "provide_text/provide_info/confirm/modify/other"
}`;

  try {
    const response = await agentModel.invoke(prompt);
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Erreur analyse LLM:", error);
  }

  // Fallback avec détection basique
  const detectedText = detectTextContent(message);
  return {
    detectedInfo: detectedText ? { textContent: detectedText } : {},
    confidence: detectedText ? 0.8 : 0.2,
    intentRecognized: detectedText ? 'provide_text' : 'other'
  };
}

// Générer la prochaine réponse avec le LLM
async function generateNextResponse(
  sessionData: CollectedData,
  conversationContext: { role: string; content: string }[],
  lastUserIntent: string
): Promise<string> {
  const missingInfo = getMissingInfo(sessionData);
  
  const prompt = `Tu es l'assistant audio d'Ekho Studio, chaleureux et professionnel.

Contexte de conversation:
${conversationContext.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Données collectées: ${JSON.stringify(sessionData)}
Informations manquantes: ${missingInfo.join(', ')}
Dernière intention utilisateur: ${lastUserIntent}

RÈGLES IMPORTANTES:
1. Ne JAMAIS redemander une information déjà fournie
2. Si le texte est fourni, passer à l'information suivante
3. Une seule question à la fois
4. Être naturel et encourageant
5. Si toutes les infos essentielles sont là, proposer de générer
6. Ne JAMAIS utiliser de markdown (pas de **, __, *, etc.)
7. Si le texte fourni est court, proposer de l'améliorer

Génère la prochaine réponse appropriée, en langage naturel sans formatage.`;

  try {
    const response = await agentModel.invoke(prompt);
    return response.content as string;
  } catch (error) {
    console.error("Erreur génération réponse:", error);
    // Fallback
    if (!sessionData.textContent) {
      return getRandomResponse(CONVERSATION_PROMPTS.clarification.text);
    } else if (missingInfo.length > 0) {
      return `${getRandomResponse(CONVERSATION_PROMPTS.encouragement)} Pour améliorer le résultat, ${missingInfo[0].toLowerCase()} ?`;
    } else {
      return getRandomResponse(CONVERSATION_PROMPTS.readyToGenerate);
    }
  }
}

// Déterminer ce qui manque pour générer
function getMissingInfo(sessionData: CollectedData): string[] {
  const missing: string[] = [];

  if (!sessionData.textContent) {
    missing.push('Le texte à vocaliser');
  }

  // Les autres infos sont optionnelles mais améliorent le résultat
  if (!sessionData.targetAudience) {
    missing.push('Pour qui est destiné cet audio');
  }
  if (!sessionData.voiceGender && !sessionData.emotionStyle) {
    missing.push('Quel style de voix tu préfères');
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
    let history = conversationHistory.get(threadId) || [];

    // Extraire le message utilisateur
    const userMessage = input.messages?.[input.messages.length - 1];
    const userText: string = userMessage?.content || '';

    console.log("📊 État session:", {
      hasText: !!sessionData.textContent,
      hasProjectType: !!sessionData.projectType,
      historyLength: history.length,
      userMessage: userText.slice(0, 50)
    });

    try {
      // Si c'est le premier message
      if (history.length === 0) {
        const welcomeMessage = new AIMessage(getRandomResponse(CONVERSATION_PROMPTS.welcome));
        history.push({ role: 'assistant', content: welcomeMessage.content as string });
        conversationHistory.set(threadId, history);

        return {
          messages: [welcomeMessage],
          conversationState: { phase: 'discovery', step: 1 },
          historyLength: 1,
          audioGenerated: false
        };
      }

      // Ajouter le message utilisateur à l'historique
      history.push({ role: 'user', content: userText });

      // Analyser le message utilisateur avec LLM
      const analysis = await analyzeUserMessageWithLLM(userText, sessionData, history);
      const { detectedInfo, confidence, intentRecognized } = analysis;

      console.log("🔍 Analyse du message:", {
        detectedInfo,
        confidence,
        intentRecognized
      });

      // Mettre à jour les données de session avec les infos détectées
      sessionData = { ...sessionData, ...detectedInfo };
      sessionStore.set(threadId, sessionData);

      // Si on a le texte principal et l'utilisateur confirme, on peut générer
      if (sessionData.textContent && 
          (intentRecognized === 'confirm' || 
           userText.toLowerCase().match(/oui|go|lance|génère|ok|parfait/))) {
        console.log("🎵 Génération audio demandée");
        
        // D'abord envoyer un message de statut
        const statusMessage = new AIMessage(
          "🎵 Super ! Je lance la génération de ton audio... Ça va prendre quelques secondes ⏳"
        );
        history.push({ role: 'assistant', content: statusMessage.content as string });
        conversationHistory.set(threadId, history);
        
        return await this.generateAudio(sessionData, threadId);
      }

      // Générer la prochaine réponse avec le LLM
      const response = await generateNextResponse(sessionData, history, intentRecognized);
      
      // Déterminer la phase
      let phase = 'clarification';
      if (!sessionData.textContent) {
        phase = 'discovery';
      } else if (getMissingInfo(sessionData).length === 0) {
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
          `📋 Petit récap de ton projet :\n` +
          (sessionData.projectType ? `• Type : ${sessionData.projectType}\n` : '') +
          (sessionData.targetAudience ? `• Public : ${sessionData.targetAudience}\n` : '') +
          `• Voix : ${this.getVoiceDisplayName(voiceName)}\n` +
          (sessionData.emotionStyle ? `• Style : ${this.getStyleDisplayName(sessionData.emotionStyle)}\n` : '') +
          `• Durée : ~${('duration' in audioResult ? audioResult.duration : 0)}s\n\n` +
          `🎧 Tu peux maintenant écouter et télécharger ton audio ci-dessus.\n\n` +
          `💡 Envie d'autre chose ? Dis-moi "nouveau" pour créer un autre audio ou explique-moi ce que tu veux modifier !`
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