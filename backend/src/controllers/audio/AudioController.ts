import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { ValidatedRequest } from "@/types";
import { GenerateAudioContractType } from "@/contracts/api";
import { AudioUtils } from "./utils";
import { AUDIO_CONFIG } from "./constants";

export class AudioController {
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
}