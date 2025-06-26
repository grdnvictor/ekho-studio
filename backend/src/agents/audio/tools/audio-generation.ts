import { tool } from "@langchain/core/tools";
import { AudioGenerationSchema } from "../../../types/audio";
import { AudioService } from "../../../services/audio";

const audioService = new AudioService();

export const audioGenerationTool = tool(
  async ({ text, voiceName, emotion, speed, effects }) => {
    try {
      const result = await audioService.generateAudio({
        text,
        voiceName,
        emotion,
        speed,
        effects
      });

      return {
        url: result.url,
        duration: result.duration,
        quality: result.quality,
        fileSize: result.fileSize,
        downloadUrl: result.downloadUrl,
        metadata: result.metadata
      };
    } catch (error) {
      console.error("Audio generation failed:", error);
      throw new Error(`Échec de la génération audio: ${error.message}`);
    }
  },
  {
    name: "audio_generation",
    description: "Génère un fichier audio professionnel à partir du texte avec la voix et les paramètres spécifiés",
    schema: AudioGenerationSchema,
  }
);