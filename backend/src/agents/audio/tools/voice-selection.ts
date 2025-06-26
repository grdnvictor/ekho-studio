// backend/src/agents/audio/tools/voice-selection.ts
import { tool } from "@langchain/core/tools";
import { VoiceSelectionSchema } from "../../../types/audio";
import { VoiceService } from "../../../services/audio";

console.log("🔧 Initialisation de voiceSelectionTool...");

const voiceService = new VoiceService();
console.log("✅ VoiceService créé");

export const voiceSelectionTool = tool(
  async ({ content, targetAudience, emotion, gender, age }) => {
    console.log("🎤 voiceSelectionTool appelé avec:", { content: content?.slice(0, 50), targetAudience, emotion, gender, age });

    try {
      console.log("📞 Appel de analyzeAndRecommendVoice...");
      const recommendation = await voiceService.analyzeAndRecommendVoice({
        content,
        targetAudience,
        emotion,
        gender,
        age
      });

      console.log("✅ Recommandation reçue:", recommendation);

      const result = {
        recommendedVoice: recommendation.voiceName,
        reasoning: recommendation.reasoning,
        alternatives: recommendation.alternatives.map(voice => voice.name),
        confidenceScore: recommendation.confidenceScore,
        voiceProfile: recommendation.voiceProfile
      };

      console.log("📤 Retour de voiceSelectionTool:", result);
      return result;
    } catch (error) {
      console.error("❌ Erreur dans voiceSelectionTool:", error);
      const fallbackResult = {
        recommendedVoice: "Aoede", // Fallback
        reasoning: "Default voice selected due to analysis error",
        alternatives: ["Thalia", "Nova"],
        confidenceScore: 0.5
      };
      console.log("🔄 Fallback result:", fallbackResult);
      return fallbackResult;
    }
  },
  {
    name: "voice_selection",
    description: "Sélectionne la voix optimale pour le contenu en analysant le texte, l'audience cible et l'émotion souhaitée",
    schema: VoiceSelectionSchema,
  }
);

console.log("✅ voiceSelectionTool configuré:", voiceSelectionTool.name);
