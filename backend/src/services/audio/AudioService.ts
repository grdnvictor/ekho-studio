// backend/src/services/audio/AudioService.ts
import { GoogleGenAI } from "@google/genai";
import {
  AudioGenerationParams,
  AudioResult,
  AudioMetadata,
  ScriptGenerationParams,
  ScriptResult,
  ContentOptimizationParams,
  OptimizationResult
} from "@/types/audio";
import { AUDIO_CONFIG } from "@/controllers/audio/constants";

export class AudioService {
  private geminiAI: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }
    this.geminiAI = new GoogleGenAI({ apiKey });
  }

  async generateAudio(params: AudioGenerationParams): Promise<AudioResult> {
    const startTime = Date.now();

    try {
      const config = {
        temperature: AUDIO_CONFIG.TEMPERATURE,
        responseModalities: ["audio"] as string[],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: params.voiceName,
            },
          },
        },
      };

      // Construire le prompt avec les paramètres
      let prompt = params.text;
      if (params.emotion) {
        prompt = `[Émotion: ${params.emotion}] ${prompt}`;
      }

      const contents = [{
        role: "user" as const,
        parts: [{ text: prompt }],
      }];

      // Génération avec retry logic
      for (let attempt = 0; attempt < AUDIO_CONFIG.MAX_RETRIES; attempt++) {
        try {
          const response = await this.geminiAI.models.generateContentStream({
            model: AUDIO_CONFIG.MODEL,
            config,
            contents,
          });

          // Traiter la réponse et obtenir l'URL
          const audioUrl = await this.processAudioResponse(response);
          const processingTime = Date.now() - startTime;

          return {
            url: audioUrl,
            duration: this.estimateDuration(params.text, params.speed || 1),
            quality: 'high' as const,
            fileSize: 0, // À calculer depuis le fichier généré
            downloadUrl: audioUrl,
            metadata: {
              format: 'wav',
              bitrate: 44100,
              sampleRate: 44100,
              channels: 1,
              generatedAt: new Date(),
              processingTime
            }
          };

        } catch (error: any) {
          if (error.status === 429 && attempt < AUDIO_CONFIG.MAX_RETRIES - 1) {
            await this.delay(AUDIO_CONFIG.RETRY_DELAY);
            continue;
          }
          throw error;
        }
      }

      throw new Error("Max retries exceeded");
    } catch (error) {
      console.error("Audio generation failed:", error);
      throw error;
    }
  }

  async generateScript(params: ScriptGenerationParams): Promise<ScriptResult> {
    const prompt = `
      Génère un script ${params.style} de ${params.duration} secondes sur le sujet "${params.topic}".
      Public cible: ${params.targetAudience}
      Objectifs: ${params.objectives.join(', ')}
      
      Retourne un script structuré avec introduction, développement et conclusion.
    `;

    try {
      const response = await this.geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        config: { temperature: 0.7 },
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      const content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        content,
        structure: this.parseScriptStructure(content),
        estimatedTiming: this.calculateTiming(content, params.duration),
        improvementSuggestions: this.generateImprovementSuggestions(content),
        metadata: {
          wordCount: content.split(' ').length,
          readabilityScore: this.calculateReadabilityScore(content),
          emotionalTone: 'neutral', // À implémenter
          keyTopics: [params.topic],
          suggestedVoices: ['Aoede', 'Thalia']
        }
      };
    } catch (error) {
      console.error("Script generation failed:", error);
      throw error;
    }
  }

  async optimizeContent(params: ContentOptimizationParams): Promise<OptimizationResult> {
    const prompt = `
      Optimise ce texte pour une durée de ${params.targetDuration} secondes:
      "${params.originalText}"
      
      Style souhaité: ${params.style}
      Contraintes: ${params.constraints?.join(', ') || 'Aucune'}
      
      Retourne le texte optimisé en conservant le message principal.
    `;

    try {
      const response = await this.geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        config: { temperature: 0.3 },
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      const optimizedText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        text: optimizedText,
        changes: this.detectChanges(params.originalText, optimizedText),
        duration: this.estimateDuration(optimizedText),
        readability: this.calculateReadabilityMetrics(optimizedText),
        suggestions: this.generateOptimizationSuggestions(optimizedText)
      };
    } catch (error) {
      console.error("Content optimization failed:", error);
      throw error;
    }
  }

  async enhanceAudio(audioUrl: string, effects: string[]): Promise<string> {
    // Placeholder pour post-traitement audio
    // Ici vous pourriez intégrer des APIs comme Elevenlabs, Azure Speech, etc.
    console.log(`Enhancing audio ${audioUrl} with effects: ${effects.join(', ')}`);
    return audioUrl; // Retourner l'URL de l'audio amélioré
  }

  // Méthodes utilitaires privées
  private async processAudioResponse(response: AsyncIterable<any>): Promise<string> {
    // Traiter la réponse streaming et sauvegarder le fichier
    // Retourner l'URL du fichier généré
    // Implementation similaire à votre AudioUtils.processResponse
    return "https://example.com/generated-audio.wav";
  }

  private estimateDuration(text: string, speed: number = 1): number {
    const wordsPerMinute = 150 * speed; // Vitesse moyenne de lecture
    const wordCount = text.split(' ').length;
    return Math.round((wordCount / wordsPerMinute) * 60);
  }

  private parseScriptStructure(content: string): any {
    // Parser le contenu pour extraire la structure
    return {
      introduction: content.split('\n')[0] || "",
      mainContent: content.split('\n').slice(1, -1),
      conclusion: content.split('\n').slice(-1)[0] || "",
      transitions: []
    };
  }

  private calculateTiming(content: string, targetDuration: number): any {
    const wordCount = content.split(' ').length;
    const wordsPerMinute = (wordCount / targetDuration) * 60;

    return {
      totalDuration: targetDuration,
      sections: [],
      wordsPerMinute,
      pauseRecommendations: []
    };
  }

  private generateImprovementSuggestions(content: string): string[] {
    return [
      "Ajouter des pauses pour améliorer le rythme",
      "Utiliser des transitions plus fluides",
      "Renforcer l'accroche de l'introduction"
    ];
  }

  private calculateReadabilityScore(content: string): number {
    // Calcul simple de lisibilité (Flesch-Kincaid approximatif)
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(' ').length;
    const avgWordsPerSentence = words / sentences;

    return Math.max(0, 100 - avgWordsPerSentence * 2);
  }

  private detectChanges(original: string, optimized: string): any[] {
    // Détecter les changements entre l'original et l'optimisé
    return [];
  }

  private calculateReadabilityMetrics(text: string): any {
    const words = text.split(' ');
    const sentences = text.split(/[.!?]+/);

    return {
      score: this.calculateReadabilityScore(text),
      grade: 'A',
      avgSentenceLength: words.length / sentences.length,
      avgWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
      complexWords: words.filter(word => word.length > 6).length
    };
  }

  private generateOptimizationSuggestions(text: string): string[] {
    return [
      "Simplifier certaines phrases complexes",
      "Ajouter des connecteurs logiques",
      "Équilibrer la longueur des paragraphes"
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}