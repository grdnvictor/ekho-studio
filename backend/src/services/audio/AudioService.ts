// backend/src/services/audio/AudioService.ts

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AudioGenerationParams,
  AudioResult,
  ScriptGenerationParams,
  ScriptResult,
  ContentOptimizationParams,
  OptimizationResult,
  AudioMetadata,
} from "@/types/audio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AudioService {
  private geminiAI: GoogleGenAI;
  private audioOutputDir: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY manquante dans l'environnement");
    }

    this.geminiAI = new GoogleGenAI({ apiKey });

    // Créer le dossier de sortie audio s'il n'existe pas
    this.audioOutputDir = path.join(__dirname, "../../../audio_outputs");
    if (!fs.existsSync(this.audioOutputDir)) {
      fs.mkdirSync(this.audioOutputDir, { recursive: true });
      console.log("📁 Dossier audio_outputs créé:", this.audioOutputDir);
    }
  }

  async generateAudio(params: AudioGenerationParams): Promise<AudioResult> {
    console.log("🎵 Début génération audio avec Gemini:", {
      text: params.text.slice(0, 50),
      voiceName: params.voiceName,
      speed: params.speed
    });

    try {
      // Configuration Gemini pour TTS
      const config = {
        temperature: 0.7,
        responseModalities: ["audio"] as string[],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: params.voiceName || "Aoede",
            },
          },
        },
      };

      // Construire le prompt avec paramètres
      let prompt = params.text;
      if (params.emotion) {
        prompt = `[Émotion: ${params.emotion}] ${prompt}`;
      }
      if (params.speed && params.speed !== 1) {
        prompt = `[Vitesse: ${params.speed}x] ${prompt}`;
      }

      const contents = [{
        role: "user" as const,
        parts: [{ text: prompt }],
      }];

      console.log("📞 Appel Gemini TTS API...");

      // Générer avec Gemini
      const genResponse = await this.geminiAI.models.generateContentStream({
        model: "gemini-2.5-flash-preview-tts",
        config,
        contents,
      });

      // Traiter la réponse et sauvegarder
      const audioUrl = await this.processGeminiResponse(genResponse, params);

      const metadata: AudioMetadata = {
        format: "wav",
        bitrate: 44100,
        sampleRate: 44100,
        channels: 1,
        generatedAt: new Date(),
        processingTime: Date.now()
      };

      console.log("✅ Audio généré avec succès:", audioUrl);

      return {
        url: audioUrl,
        duration: this.estimateDuration(params.text, params.speed || 1),
        quality: "high",
        fileSize: params.text.length * 1000, // Estimation
        downloadUrl: audioUrl,
        metadata
      };

    } catch (error) {
      console.error("❌ Erreur génération audio:", error);
      throw new Error(`Échec génération audio: ${error.message}`);
    }
  }

  private async processGeminiResponse(response: AsyncIterable<any>, params: AudioGenerationParams): Promise<string> {
    console.log("🔄 Traitement de la réponse Gemini...");

    const timestamp = Date.now();
    const filename = `audio_${timestamp}.wav`;
    const filepath = path.join(this.audioOutputDir, filename);

    let audioChunks: Buffer[] = [];
    let fileIndex = 0;

    try {
      for await (const chunk of response) {
        console.log("📦 Chunk reçu");

        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          console.log("🎵 Données audio trouvées, MIME:", inlineData.mimeType);

          if (inlineData.data) {
            // Convertir base64 en buffer
            const audioBuffer = Buffer.from(inlineData.data, "base64");

            // Créer le fichier WAV avec header si nécessaire
            let finalBuffer = audioBuffer;
            if (inlineData.mimeType?.includes("wav")) {
              finalBuffer = this.convertToWav(inlineData.data, inlineData.mimeType);
            }

            // Sauvegarder le fichier
            const currentFilename = `audio_${timestamp}_${fileIndex}.wav`;
            const currentFilepath = path.join(this.audioOutputDir, currentFilename);

            fs.writeFileSync(currentFilepath, finalBuffer);
            console.log("💾 Fichier audio sauvegardé:", currentFilepath);

            fileIndex++;

            // Retourner l'URL du premier fichier
            if (fileIndex === 1) {
              return `http://localhost:3333/audio/${currentFilename}`;
            }
          }
        } else if (chunk.text) {
          console.log("📝 Texte reçu:", chunk.text);
        }
      }

      if (fileIndex === 0) {
        throw new Error("Aucun fichier audio généré");
      }

      return `http://localhost:3333/audio/audio_${timestamp}_0.wav`;

    } catch (error) {
      console.error("❌ Erreur traitement réponse:", error);
      throw error;
    }
  }

  private convertToWav(rawData: string, mimeType: string): Buffer {
    // Parse MIME type pour extraire les paramètres
    const options = this.parseMimeType(mimeType);
    const wavHeader = this.createWavHeader(rawData.length, options);
    const buffer = Buffer.from(rawData, "base64");
    return Buffer.concat([wavHeader, buffer]);
  }

  private parseMimeType(mimeType: string): any {
    const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());

    const options = {
      numChannels: 1,
      sampleRate: 24000,
      bitsPerSample: 16,
    };

    for (const param of params) {
      const [key, value] = param.split("=").map((s) => s.trim());
      if (key === "rate") {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return options;
  }

  private createWavHeader(dataLength: number, options: any): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
  }

  private estimateDuration(text: string, speed: number = 1): number {
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(" ").length;
    return Math.round((wordCount / wordsPerMinute) * 60);
  }

  async generateScript(params: ScriptGenerationParams): Promise<ScriptResult> {
    // Mock implementation pour le moment
    return {
      content: `Script généré pour: ${params.topic}`,
      structure: {
        introduction: "",
        mainContent: [],
        conclusion: "",
        transitions: []
      },
      estimatedTiming: {
        totalDuration: params.duration,
        sections: [],
        wordsPerMinute: 150,
        pauseRecommendations: []
      },
      improvementSuggestions: [],
      metadata: {
        wordCount: 0,
        readabilityScore: 0,
        emotionalTone: "neutral",
        keyTopics: [],
        suggestedVoices: []
      }
    };
  }

  async optimizeContent(params: ContentOptimizationParams): Promise<OptimizationResult> {
    // Mock implementation pour le moment
    return {
      text: params.originalText,
      changes: [],
      duration: params.targetDuration,
      readability: {
        score: 85,
        grade: "B+",
        avgSentenceLength: 15,
        avgWordLength: 5,
        complexWords: 10
      },
      suggestions: []
    };
  }
}