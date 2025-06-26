import { tool } from "@langchain/core/tools";
import { VoiceSelectionSchema } from "../../../types/audio";
import { VoiceService } from "../../../services/audio";

const voiceService = new VoiceService();

export const voiceSelectionTool = tool(
  async ({ content, targetAudience, emotion, gender, age }) => {
    try {
      const recommendation = await voiceService.analyzeAndRecommendVoice({
        content,
        targetAudience,
        emotion,
        gender,
        age
      });

      return {
        recommendedVoice: recommendation.voiceName,
        reasoning: recommendation.reasoning,
        alternatives: recommendation.alternatives.map(voice => voice.name),
        confidenceScore: recommendation.confidenceScore,
        voiceProfile: recommendation.voiceProfile
      };
    } catch (error) {
      console.error("Voice selection failed:", error);
      return {
        recommendedVoice: "Aoede", // Fallback
        reasoning: "Default voice selected due to analysis error",
        alternatives: ["Thalia", "Nova"],
        confidenceScore: 0.5
      };
    }
  },
  {
    name: "voice_selection",
    description: "Sélectionne la voix optimale pour le contenu en analysant le texte, l'audience cible et l'émotion souhaitée",
    schema: VoiceSelectionSchema,
  }
);