import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { GenerateAudioContractType } from "@/contracts/api";
import { AudioUtils } from "./utils";
import { AUDIO_CONFIG } from "./constants";
import { ValidatedRequest } from "@/types";

export class ApiController {
  static async generateAudio(
    request: Request,
    response: Response,
  ): Promise<void> {
    // response.status(200).json({
    //   ...request.body
    // })
    // return;
    try {
      const validatedRequest = request as ValidatedRequest<GenerateAudioContractType>;
      const { text } = validatedRequest.validated.body;

      // Note: You'll need to define how to get the apiKey
      const apiKey = process.env.GEMINI_API_KEY;
      console.log(apiKey);
      if (!apiKey) {
        console.error("API key is not defined");
        response.status(500).json({
          error: "Internal server error",
          details: "API key is not defined",
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey, // This needs to be defined
      });

      const config = {
        temperature: AUDIO_CONFIG.TEMPERATURE,
        responseModalities: ["audio"] as string[],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: AUDIO_CONFIG.VOICE_NAME,
            },
          },
        },
      };

      const context = `
        Sois complètement hystérique et dramatique,comme quelqu'un qui raconte le scandale du siècle. 
        Utilise BEAUCOUP de majuscules, des points d'exclamation à gogo, et des expressions exagérées.
        Fais comme si tu étais témoin d'un événement ultra-choquant qui va faire le buzz. 
        Sois dans l'urgence émotionnelle totale, avec des phrases coupées, des "OH MON DIEU", et une tendance à dramatiser chaque détail. 
        Parle comme si tu étais en train de balancer un scoop explosif à tes abonnés.`
      const contents = [
        {
          role: "user" as const,
          parts: [
            {
              text: `
            ${context}
            Voici le texte à dire : 
            ${text}
            `,
            },
          ],
        },
      ];

      for (let attempt = 0; attempt < AUDIO_CONFIG.MAX_RETRIES; attempt++) {
        try {
          const genResponse = await ai.models.generateContentStream({
            model: AUDIO_CONFIG.MODEL,
            config,
            contents,
          });

          await AudioUtils.processResponse(genResponse);

          response.status(200).json({
            message: "Audio generated successfully",
          });
          break;
        } catch (error) {
          if (error.status === 429 && attempt < AUDIO_CONFIG.MAX_RETRIES - 1) {
            console.log(
              `Limite de quota atteinte, nouvelle tentative dans ${AUDIO_CONFIG.RETRY_DELAY / 1000}s...`,
            );
            await new Promise<void>((resolve) =>
              setTimeout(resolve, AUDIO_CONFIG.RETRY_DELAY),
            );
            continue;
          }
          console.error("Erreur finale:", error);
          throw error;
        }
      }
    } catch (error: unknown) {
      console.error("Error in generateAudio:", error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        // show line number and stack trace for debugging
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}