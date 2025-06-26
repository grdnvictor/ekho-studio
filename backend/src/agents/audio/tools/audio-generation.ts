// backend/src/agents/audio/tools/audio-generation.ts
import { tool } from "@langchain/core/tools";
import { AudioGenerationSchema } from "@/types/audio.ts";
import { AudioService } from "@/services";

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
        voiceName: voiceName || "Aoede",
        emotion,
        speed: speed || 1,
        effects
      });

      console.log("✅ Audio généré:", result);

      const response = {
        success: true,
        url: result.url,
        duration: result.duration,
        quality: result.quality,
        fileSize: result.fileSize,
        downloadUrl: result.downloadUrl,
        metadata: result.metadata,
        message: `🎉 Audio généré avec succès ! Durée: ${result.duration}s. Vous pouvez l'écouter ci-dessous.`
      };

      console.log("📤 Retour de audioGenerationTool:", response);
      return response;
    } catch (error) {
      console.error("❌ Erreur dans audioGenerationTool:", error);
      console.error("Stack:", error.stack);

      return {
        success: false,
        error: `Échec de la génération audio: ${error.message}`,
        message: "❌ Désolé, une erreur s'est produite lors de la génération. Pouvez-vous réessayer ?"
      };
    }
  },
  {
    name: "audio_generation",
    description: "Génère un fichier audio professionnel à partir du texte avec la voix et les paramètres spécifiés",
    schema: AudioGenerationSchema,
  }
);

console.log("✅ audioGenerationTool configuré:", audioGenerationTool.name);