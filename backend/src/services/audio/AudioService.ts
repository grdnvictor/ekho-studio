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
      // Configuration Gemini pour TTS avec voix optimisée
      const config = {
        temperature: 0.7,
        responseModalities: ["audio"] as string[],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.mapVoiceName(params.voiceName || "Aoede"),
            },
          },
        },
      };

      // Construire le prompt avec paramètres améliorés
      let enhancedText = this.enhanceTextForTTS(params.text, params);

      const contents = [{
        role: "user" as const,
        parts: [{ text: enhancedText }],
      }];

      console.log("📞 Appel Gemini TTS API avec texte optimisé...");

      // Générer avec Gemini avec retry logic
      let genResponse;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          genResponse = await this.geminiAI.models.generateContentStream({
            model: "gemini-2.5-flash-preview-tts",
            config,
            contents,
          });
          break;
        } catch (error: any) {
          attempts++;
          console.warn(`Tentative ${attempts} échouée:`, error.message);

          if (attempts >= maxAttempts) {
            throw error;
          }

          // Attendre avant retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!genResponse) {
        throw new Error("Impossible de générer l'audio après plusieurs tentatives");
      }

      // Traiter la réponse et sauvegarder
      const audioResult = await this.processGeminiResponse(genResponse, params);

      console.log("✅ Audio généré avec succès:", audioResult.url);

      return audioResult;

    } catch (error) {
      console.error("❌ Erreur génération audio:", error);
      throw new Error(`Échec génération audio: ${error.message}`);
    }
  }

  /**
   * Améliore le texte pour une meilleure synthèse vocale
   */
  private enhanceTextForTTS(text: string, params: AudioGenerationParams): string {
    let enhancedText = text;

    // Nettoyer le texte
    enhancedText = enhancedText.trim();

    // Ajouter des pauses naturelles
    enhancedText = enhancedText.replace(/\. /g, '. <break time="0.5s"/> ');
    enhancedText = enhancedText.replace(/\, /g, ', <break time="0.2s"/> ');
    enhancedText = enhancedText.replace(/\! /g, '! <break time="0.6s"/> ');
    enhancedText = enhancedText.replace(/\? /g, '? <break time="0.6s"/> ');

    // Appliquer l'émotion si spécifiée
    if (params.emotion && params.emotion !== 'neutral') {
      const emotionMappings = {
        'happy': 'avec joie et enthousiasme',
        'calm': 'de manière calme et posée',
        'professional': 'avec un ton professionnel',
        'warm': 'avec chaleur et bienveillance',
        'energetic': 'avec énergie et dynamisme',
        'dramatic': 'de manière dramatique'
      };

      const emotionDesc = emotionMappings[params.emotion] || params.emotion;
      enhancedText = `[Parlez ${emotionDesc}] ${enhancedText}`;
    }

    // Appliquer la vitesse si différente de 1
    if (params.speed && params.speed !== 1) {
      if (params.speed > 1) {
        enhancedText = `[Parlez plus rapidement] ${enhancedText}`;
      } else if (params.speed < 1) {
        enhancedText = `[Parlez plus lentement] ${enhancedText}`;
      }
    }

    console.log("📝 Texte optimisé pour TTS:", enhancedText.slice(0, 100));
    return enhancedText;
  }

  /**
   * Mappe les noms de voix vers les voix disponibles dans Gemini
   */
  private mapVoiceName(voiceName: string): string {
    const voiceMapping = {
      // Voix féminines
      'Aoede': 'aoede',          // Voix féminine chaleureuse (muse de la poésie)
      'Thalia': 'aoede',         // Fallback vers aoede
      'Nova': 'callirrhoe',      // Voix jeune féminine
      'Zara': 'despina',         // Voix féminine moderne
      'Echo': 'erinome',         // Voix féminine avec résonance

      // Voix masculines
      'Atlas': 'achernar',       // Voix masculine forte
      'Orus': 'orus',            // Voix masculine directe
      'Charon': 'charon',        // Voix masculine profonde

      // Voix neutres/spécialisées
      'Astra': 'despina',        // Voix moderne
      'Sadachbia': 'sadachbia',  // Voix traditionnelle
      'Pulcherrima': 'pulcherrima', // Belle voix
      'Vindemiatrix': 'vindemiatrix' // Voix expressive
    };

    // Normaliser le nom d'entrée
    const normalizedInput = voiceName.toLowerCase();

    // Chercher d'abord une correspondance exacte
    if (this.isValidGeminiVoice(normalizedInput)) {
      return normalizedInput;
    }

    // Puis chercher dans le mapping
    const mappedVoice = voiceMapping[voiceName];
    if (mappedVoice && this.isValidGeminiVoice(mappedVoice)) {
      return mappedVoice;
    }

    // Fallback vers aoede (voix féminine fiable)
    return 'aoede';
  }

  /**
   * Vérifie si une voix est valide dans Gemini
   */
  private isValidGeminiVoice(voiceName: string): boolean {
    const validVoices = [
      'achernar', 'achird', 'algenib', 'algieba', 'alnilam', 'aoede',
      'autonoe', 'callirrhoe', 'charon', 'despina', 'enceladus',
      'erinome', 'fenrir', 'gacrux', 'iapetus', 'kore', 'laomedeia',
      'leda', 'orus', 'puck', 'pulcherrima', 'rasalgethi', 'sadachbia',
      'sadaltager', 'schedar', 'sulafat', 'umbriel', 'vindemiatrix',
      'zephyr', 'zubenelgenubi'
    ];

    return validVoices.includes(voiceName.toLowerCase());
  }

  /**
   * Traite la réponse de Gemini et sauvegarde l'audio
   */
  private async processGeminiResponse(response: AsyncIterable<any>, params: AudioGenerationParams): Promise<AudioResult> {
    console.log("🔄 Traitement de la réponse Gemini...");

    const timestamp = Date.now();
    const filename = `audio_${timestamp}.wav`;
    let audioChunks: Buffer[] = [];
    let totalDuration = 0;
    let totalSize = 0;

    try {
      for await (const chunk of response) {
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          console.log("🎵 Données audio trouvées, MIME:", inlineData.mimeType);

          if (inlineData.data) {
            // Décoder les données base64
            const rawAudioData = Buffer.from(inlineData.data, "base64");

            // Créer un fichier WAV valide avec header correct
            const wavBuffer = this.createValidWavFile(rawAudioData, inlineData.mimeType);
            audioChunks.push(wavBuffer);

            totalSize += wavBuffer.length;
          }
        } else if (chunk.text) {
          console.log("📝 Texte reçu:", chunk.text);
        }
      }

      if (audioChunks.length === 0) {
        throw new Error("Aucune donnée audio générée");
      }

      // Combiner tous les chunks audio
      const finalAudioBuffer = Buffer.concat(audioChunks);
      const filepath = path.join(this.audioOutputDir, filename);

      // Sauvegarder le fichier
      fs.writeFileSync(filepath, finalAudioBuffer);
      console.log("💾 Fichier audio sauvegardé:", filepath);

      // Calculer la durée estimée
      totalDuration = this.estimateDuration(params.text, params.speed || 1);

      const metadata: AudioMetadata = {
        format: "wav",
        bitrate: 24000,
        sampleRate: 24000,
        channels: 1,
        generatedAt: new Date(),
        processingTime: Date.now() - timestamp
      };

      const audioUrl = `http://localhost:3333/audio/${filename}`;

      return {
        url: audioUrl,
        duration: totalDuration,
        quality: "high",
        fileSize: totalSize,
        downloadUrl: audioUrl,
        metadata
      };

    } catch (error) {
      console.error("❌ Erreur traitement réponse:", error);
      throw error;
    }
  }

  /**
   * Crée un fichier WAV valide avec header correct
   */
  private createValidWavFile(rawData: Buffer, mimeType?: string): Buffer {
    // Paramètres audio standards pour Gemini TTS
    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;

    // Si les données sont déjà au format PCM, on crée juste un header WAV
    const dataLength = rawData.length;
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;

    // Créer le header WAV (44 bytes)
    const header = Buffer.alloc(44);

    // RIFF identifier
    header.write('RIFF', 0);
    // File size
    header.writeUInt32LE(36 + dataLength, 4);
    // WAVE identifier
    header.write('WAVE', 8);
    // fmt chunk identifier
    header.write('fmt ', 12);
    // fmt chunk size
    header.writeUInt32LE(16, 16);
    // Audio format (PCM)
    header.writeUInt16LE(1, 20);
    // Number of channels
    header.writeUInt16LE(channels, 22);
    // Sample rate
    header.writeUInt32LE(sampleRate, 24);
    // Byte rate
    header.writeUInt32LE(byteRate, 28);
    // Block align
    header.writeUInt16LE(blockAlign, 32);
    // Bits per sample
    header.writeUInt16LE(bitsPerSample, 34);
    // data chunk identifier
    header.write('data', 36);
    // data chunk size
    header.writeUInt32LE(dataLength, 40);

    // Combiner header et données
    return Buffer.concat([header, rawData]);
  }

  /**
   * Estime la durée basée sur le texte et la vitesse
   */
  private estimateDuration(text: string, speed: number = 1): number {
    // Estimation basée sur 150 mots par minute en vitesse normale
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(/\s+/).length;
    const durationMinutes = wordCount / wordsPerMinute;
    const durationSeconds = Math.round(durationMinutes * 60);

    // Minimum 2 secondes, maximum basé sur le calcul
    return Math.max(2, durationSeconds);
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