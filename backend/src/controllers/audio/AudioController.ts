import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { ValidatedRequest } from "@/types";
import { GenerateAudioContractType } from "@/contracts/api";
import { AudioUtils } from "./utils";
import { AUDIO_CONFIG } from "./constants";
import { VoiceService } from "../../services/audio/VoiceService";
import { AudioService } from "../../services/audio/AudioService";
import { VoiceSelectionContractType, AudioGenerationContractType, ScriptOptimizationContractType } from "../../contracts/audio";

export class AudioController {
  private static voiceService = new VoiceService();
  private static audioService = new AudioService();

  /**
   * Génère un fichier audio à partir du texte fourni
   */
  static async generateAudio(
    request: Request,
    response: Response,
  ): Promise<void> {
    try {
      const validatedRequest = request as ValidatedRequest<GenerateAudioContractType>;
      const { text, voiceName, emotion, speed } = validatedRequest.validated.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        response.status(500).json({
          success: false,
          error: "Configuration API manquante",
        });
        return;
      }

      // Construire le prompt avec les paramètres
      let prompt = text;
      if (emotion) {
        prompt = `[Émotion: ${emotion}] ${prompt}`;
      }

      const geminiAI = new GoogleGenAI({ apiKey });

      const config = {
        temperature: AUDIO_CONFIG.TEMPERATURE,
        responseModalities: ["audio"] as string[],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName || AUDIO_CONFIG.VOICE_NAME,
            },
          },
        },
      };

      const contents = [{
        role: "user" as const,
        parts: [{ text: prompt }],
      }];

      // Génération avec retry logic
      for (let attempt = 0; attempt < AUDIO_CONFIG.MAX_RETRIES; attempt++) {
        try {
          const genResponse = await geminiAI.models.generateContentStream({
            model: AUDIO_CONFIG.MODEL,
            config,
            contents,
          });

          // Traiter la réponse
          await AudioUtils.processResponse(genResponse);

          response.status(200).json({
            success: true,
            message: "Audio généré avec succès",
            data: {
              text: text,
              voiceName: voiceName || AUDIO_CONFIG.VOICE_NAME,
              emotion: emotion || "neutral",
              speed: speed || 1,
            },
          });
          return;

        } catch (error: any) {
          console.error(`Tentative ${attempt + 1} échouée:`, error);

          if (error.status === 429 && attempt < AUDIO_CONFIG.MAX_RETRIES - 1) {
            console.log(`Rate limit atteint, attente de ${AUDIO_CONFIG.RETRY_DELAY / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, AUDIO_CONFIG.RETRY_DELAY));
            continue;
          }
          throw error;
        }
      }

      throw new Error("Nombre maximum de tentatives atteint");

    } catch (error: unknown) {
      console.error("Erreur lors de la génération audio:", error);
      response.status(500).json({
        success: false,
        error: "Erreur lors de la génération audio",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async selectVoice(request: Request, response: Response): Promise<void> {
    try {
      const validatedRequest = request as ValidatedRequest<VoiceSelectionContractType>;
      const { content, targetAudience, emotion, gender, age } = validatedRequest.validated.body;

      const recommendation = await AudioController.voiceService.analyzeAndRecommendVoice({
        content,
        targetAudience,
        emotion,
        gender,
        age
      });

      response.status(200).json({
        recommendedVoice: recommendation.voiceName,
        reasoning: recommendation.reasoning,
        alternatives: recommendation.alternatives.map(voice => voice.name),
        confidenceScore: recommendation.confidenceScore
      });
    } catch (error) {
      console.error("Voice selection error:", error);
      response.status(500).json({
        error: "Erreur lors de la sélection de voix",
        details: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  static async generateAudioFromService(request: Request, response: Response): Promise<void> {
    try {
      const validatedRequest = request as ValidatedRequest<AudioGenerationContractType>;
      const { text, voiceName, emotion, speed, effects } = validatedRequest.validated.body;

      const result = await AudioController.audioService.generateAudio({
        text,
        voiceName,
        emotion,
        speed,
        effects
      });

      response.status(200).json({
        url: result.url,
        duration: result.duration,
        quality: result.quality,
        fileSize: result.fileSize,
        downloadUrl: result.downloadUrl
      });
    } catch (error) {
      console.error("Audio generation error:", error);
      response.status(500).json({
        error: "Erreur lors de la génération audio",
        details: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  static async optimizeScript(request: Request, response: Response): Promise<void> {
    try {
      const validatedRequest = request as ValidatedRequest<ScriptOptimizationContractType>;
      const { originalText, targetDuration, style, constraints } = validatedRequest.validated.body;

      // Mock implementation - replace with actual service call
      const result = {
        text: originalText,
        changes: [],
        duration: targetDuration,
        suggestions: ["Script optimisé avec succès"]
      };

      response.status(200).json(result);
    } catch (error) {
      console.error("Script optimization error:", error);
      response.status(500).json({
        error: "Erreur lors de l'optimisation du script",
        details: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }
}