// backend/src/agents/audio/tools/audio-generation.ts
import { tool } from "@langchain/core/tools";
import { AudioGenerationSchema } from "../../../types/audio";
import { AudioService } from "../../../services/audio";

console.log("🔧 Initialisation de audioGenerationTool...");

const audioService = new AudioService();
console.log("✅ AudioService créé");

export const audioGenerationTool = tool(
  async ({ text, voiceName, emotion, speed, effects }) => {
    console.log("🎵 audioGenerationTool appelé avec:", {
      text: text?.slice(0, 50),
      voiceName,
      emotion,
      speed,
      effects
    });

    try {
      console.log("📞 Appel de generateAudio...");
      const result = await audioService.generateAudio({
        text,
        voiceName,
        emotion,
        speed,
        effects
      });

      console.log("✅ Audio généré:", result);

      const response = {
        url: result.url,
        duration: result.duration,
        quality: result.quality,
        fileSize: result.fileSize,
        downloadUrl: result.downloadUrl,
        metadata: result.metadata
      };

      console.log("📤 Retour de audioGenerationTool:", response);
      return response;
    } catch (error) {
      console.error("❌ Erreur dans audioGenerationTool:", error);
      console.error("Stack:", error.stack);
      throw new Error(`Échec de la génération audio: ${error.message}`);
    }
  },
  {
    name: "audio_generation",
    description: "Génère un fichier audio professionnel à partir du texte avec la voix et les paramètres spécifiés",
    schema: AudioGenerationSchema,
  }
);

console.log("✅ audioGenerationTool configuré:", audioGenerationTool.name);