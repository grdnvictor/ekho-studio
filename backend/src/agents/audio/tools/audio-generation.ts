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
      // Validation des paramètres d'entrée
      if (!text || text.trim().length === 0) {
        throw new Error("Le texte à vocaliser ne peut pas être vide");
      }

      if (text.length > 5000) {
        throw new Error("Le texte est trop long (maximum 5000 caractères)");
      }

      // Nettoyer et préparer le texte
      const cleanedText = text.trim();

      // Valider et normaliser les paramètres
      const normalizedParams = {
        text: cleanedText,
        voiceName: voiceName || "aoede", // Voix par défaut fiable
        emotion: emotion || "neutral",
        speed: Math.max(0.5, Math.min(2.0, speed || 1.0)), // Limiter entre 0.5 et 2.0
        effects: effects || []
      };

      console.log("📞 Appel de generateAudio avec paramètres normalisés:", normalizedParams);

      const startTime = Date.now();
      const result = await audioService.generateAudio(normalizedParams);
      const processingTime = Date.now() - startTime;

      console.log("✅ Audio généré avec succès:", {
        url: result.url,
        duration: result.duration,
        processingTime: `${processingTime}ms`
      });

      // Construire la réponse de succès enrichie
      const response = {
        success: true,
        url: result.url,
        duration: result.duration,
        quality: result.quality,
        fileSize: result.fileSize,
        downloadUrl: result.downloadUrl,
        metadata: {
          ...result.metadata,
          processingTime,
          textLength: cleanedText.length,
          wordCount: cleanedText.split(/\s+/).length
        },
        message: `🎉 Audio généré avec succès ! Durée: ${result.duration}s. Temps de traitement: ${processingTime}ms.`,
        generationDetails: {
          voiceUsed: normalizedParams.voiceName,
          emotionApplied: normalizedParams.emotion,
          speedApplied: normalizedParams.speed,
          textProcessed: cleanedText.length,
          estimatedReadingTime: Math.round(cleanedText.split(/\s+/).length / (150 * normalizedParams.speed) * 60)
        }
      };

      console.log("📤 Retour de audioGenerationTool:", {
        success: response.success,
        url: response.url,
        duration: response.duration
      });

      return response;
    } catch (error) {
      console.error("❌ Erreur dans audioGenerationTool:", error);
      console.error("Stack trace:", error.stack);

      // Analyser le type d'erreur pour donner un message plus précis
      let errorMessage = "Échec de la génération audio";
      let userFriendlyMessage = "❌ Désolé, une erreur s'est produite lors de la génération.";

      if (error.message.includes("GEMINI_API_KEY")) {
        errorMessage = "Configuration API manquante";
        userFriendlyMessage = "❌ Problème de configuration du service. Veuillez contacter l'administrateur.";
      } else if (error.message.includes("rate limit") || error.message.includes("429")) {
        errorMessage = "Limite de débit atteinte";
        userFriendlyMessage = "⏱️ Service temporairement surchargé. Veuillez réessayer dans quelques instants.";
      } else if (error.message.includes("network") || error.message.includes("timeout")) {
        errorMessage = "Problème de connexion";
        userFriendlyMessage = "🌐 Problème de connexion réseau. Veuillez vérifier votre connexion et réessayer.";
      } else if (error.message.includes("trop long")) {
        errorMessage = "Texte trop long";
        userFriendlyMessage = "📝 Le texte est trop long. Veuillez le raccourcir (maximum 5000 caractères).";
      } else if (error.message.includes("vide")) {
        errorMessage = "Texte manquant";
        userFriendlyMessage = "📝 Veuillez fournir un texte à vocaliser.";
      }

      const errorResponse = {
        success: false,
        error: `${errorMessage}: ${error.message}`,
        message: `${userFriendlyMessage} Pouvez-vous réessayer ?`,
        details: {
          errorType: error.name || "UnknownError",
          timestamp: new Date().toISOString(),
          inputText: text?.slice(0, 100) || "N/A"
        },
        suggestions: [
          "Vérifiez que votre texte n'est pas trop long",
          "Essayez de reformuler votre demande",
          "Contactez le support si le problème persiste"
        ]
      };

      console.log("📤 Retour d'erreur de audioGenerationTool:", errorResponse);
      return errorResponse;
    }
  },
  {
    name: "audio_generation",
    description: "Génère un fichier audio professionnel à partir du texte avec la voix et les paramètres spécifiés. Retourne l'URL du fichier audio généré.",
    schema: AudioGenerationSchema,
  }
);

console.log("✅ audioGenerationTool configuré:", audioGenerationTool.name);