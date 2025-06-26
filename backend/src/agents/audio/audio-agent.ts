import { ChatOpenAI } from "@langchain/openai";

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

// Agent conversationnel simple qui pose les bonnes questions
export const audioAgent = {
  async invoke(input: any, config: any) {
    console.log("🤖 Agent invoke appelé avec:", {
      messagesCount: input.messages?.length,
      config: config.configurable?.thread_id
    });

    // Extraire le message utilisateur
    const userMessage =
      input.messages.find(
        (msg: { _getType: () => string }) => msg._getType() === "human",
      )?.content || "";
    console.log("👤 Message utilisateur:", userMessage);

    // Prompt système pour l'agent conversationnel
    const systemPrompt = `Tu es l'Assistant Audio professionnel d'Ekho Studio. 

MISSION: Aider l'utilisateur à créer du contenu audio de qualité professionnelle.

ÉTAPES OBLIGATOIRES:
1. Analyser la demande utilisateur
2. Poser les questions essentielles manquantes
3. Recommander des solutions audio
4. Proposer la génération quand toutes les infos sont collectées

QUESTIONS ESSENTIELLES À POSER (si pas mentionnées):
- Quel est le contenu/texte à vocaliser ?
- Quel est le public cible ? (âge, contexte)
- Quelle est la durée souhaitée ?
- Quel style/ton ? (professionnel, chaleureux, dynamique, etc.)
- Quelle utilisation ? (pub radio, podcast, formation, etc.)

RÈGLES:
- Pose UNE SEULE question à la fois pour ne pas surcharger
- Sois conversationnel et professionnel
- Propose des exemples concrets
- Ne génère de l'audio que quand tu as assez d'informations
- Utilise des émojis pour rendre ça plus engageant

Réponds toujours en français avec un ton expert mais accessible.`;

    // Construire la conversation complète
    const conversation = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    console.log("📞 Envoi à LM Studio...");

    try {
      const response = await agentModel.invoke(conversation);
      console.log("✅ Réponse reçue de LM Studio");

      return {
        messages: [response]
      };
    } catch (error) {
      console.error("❌ Erreur LM Studio:", error);
      throw error;
    }
  }
};

console.log("✅ Agent audio intelligent créé");