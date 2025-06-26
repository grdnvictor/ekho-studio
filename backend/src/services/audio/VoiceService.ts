// backend/src/services/audio/VoiceService.ts
import {
  VoiceProfile,
  VoiceAnalysisParams,
  VoiceRecommendation,
  VoiceGender,
  VoiceAge,
  AVAILABLE_VOICES
} from "@/types/audio";

export class VoiceService {
  private voiceDatabase: VoiceProfile[];

  constructor() {
    this.voiceDatabase = this.initializeVoiceDatabase();
  }

  async analyzeAndRecommendVoice(params: VoiceAnalysisParams): Promise<VoiceRecommendation> {
    try {
      // Analyse sémantique du contenu
      const contentAnalysis = await this.analyzeContent(params.content);

      // Scoring des voix disponibles
      const scoredVoices = this.scoreVoices(params, contentAnalysis);

      // Sélection de la meilleure voix
      const bestVoice = scoredVoices[0];
      const alternatives = scoredVoices.slice(1, 4); // Top 3 alternatives

      return {
        voiceName: bestVoice.profile.name,
        voiceProfile: bestVoice.profile,
        reasoning: bestVoice.reasoning,
        alternatives: alternatives.map(v => v.profile),
        confidenceScore: bestVoice.score,
        previewUrl: bestVoice.profile.sampleUrl
      };
    } catch (error) {
      console.error("Voice analysis failed:", error);
      throw error;
    }
  }

  async getAvailableVoices(): Promise<VoiceProfile[]> {
    return this.voiceDatabase;
  }

  async getVoiceById(voiceId: string): Promise<VoiceProfile | null> {
    return this.voiceDatabase.find(voice => voice.id === voiceId) || null;
  }

  async getVoicesByFilter(filters: Partial<VoiceProfile>): Promise<VoiceProfile[]> {
    return this.voiceDatabase.filter(voice => {
      return Object.entries(filters).every(([key, value]) => {
        if (key === 'gender' && value) return voice.gender === value;
        if (key === 'age' && value) return voice.age === value;
        if (key === 'language' && value) return voice.language.includes(value as string);
        return true;
      });
    });
  }

  // Méthodes privées
  private initializeVoiceDatabase(): VoiceProfile[] {
    return [
      {
        id: "sadachbia",
        name: "Sadachbia",
        displayName: "Sadachbia - Voix Dramatique",
        gender: VoiceGender.FEMALE,
        age: VoiceAge.ADULT,
        language: "fr-FR",
        description: "Voix dramatique et expressive, parfaite pour les contenus émotionnels",
        emotions: ["dramatic", "passionate", "intense", "sad"],
        tags: ["drama", "storytelling", "emotional"],
        popularity: 85,
        quality: "premium",
        sampleUrl: "https://example.com/samples/sadachbia.mp3"
      },
      {
        id: "aoede",
        name: "Aoede",
        displayName: "Aoede - Voix Harmonieuse",
        gender: VoiceGender.FEMALE,
        age: VoiceAge.YOUNG,
        language: "fr-FR",
        description: "Voix mélodieuse et apaisante, idéale pour la narration",
        emotions: ["calm", "soothing", "professional", "friendly"],
        tags: ["narration", "educational", "podcast"],
        popularity: 92,
        quality: "premium",
        sampleUrl: "https://example.com/samples/aoede.mp3"
      },
      {
        id: "thalia",
        name: "Thalia",
        displayName: "Thalia - Voix Joyeuse",
        gender: VoiceGender.FEMALE,
        age: VoiceAge.YOUNG,
        language: "fr-FR",
        description: "Voix énergique et positive, parfaite pour les contenus commerciaux",
        emotions: ["happy", "excited", "energetic", "cheerful"],
        tags: ["commercial", "marketing", "upbeat"],
        popularity: 88,
        quality: "premium"
      },
      {
        id: "nova",
        name: "Nova",
        displayName: "Nova - Voix Moderne",
        gender: VoiceGender.NEUTRAL,
        age: VoiceAge.ADULT,
        language: "fr-FR",
        description: "Voix moderne et polyvalente pour tous types de contenus",
        emotions: ["neutral", "professional", "versatile"],
        tags: ["versatile", "corporate", "modern"],
        popularity: 90,
        quality: "professional"
      }
    ];
  }

  private async analyzeContent(content: string): Promise<any> {
    // Analyse simple du contenu (vous pourriez utiliser Gemini ici aussi)
    const words = content.toLowerCase();

    return {
      sentiment: this.detectSentiment(words),
      complexity: this.calculateComplexity(content),
      topics: this.extractTopics(words),
      style: this.detectStyle(words)
    };
  }

  private scoreVoices(params: VoiceAnalysisParams, contentAnalysis: any): Array<{
    profile: VoiceProfile;
    score: number;
    reasoning: string;
  }> {
    return this.voiceDatabase.map(voice => {
      let score = voice.popularity; // Score de base
      let reasoning = `Voix ${voice.displayName} sélectionnée pour `;

      // Correspondance genre
      if (params.gender && voice.gender === params.gender) {
        score += 15;
        reasoning += `genre ${params.gender}, `;
      }

      // Correspondance âge
      if (params.age && voice.age === params.age) {
        score += 10;
        reasoning += `âge ${params.age}, `;
      }

      // Correspondance émotion
      if (params.emotion && voice.emotions.includes(params.emotion)) {
        score += 20;
        reasoning += `émotion ${params.emotion}, `;
      }

      // Correspondance avec l'audience
      if (params.targetAudience.includes('jeune') && voice.age === VoiceAge.YOUNG) {
        score += 10;
      }
      if (params.targetAudience.includes('professionnel') && voice.tags.includes('corporate')) {
        score += 15;
      }

      // Analyse du contenu
      if (contentAnalysis.sentiment === 'positive' && voice.emotions.includes('happy')) {
        score += 10;
      }
      if (contentAnalysis.style === 'commercial' && voice.tags.includes('commercial')) {
        score += 15;
      }

      return {
        profile: voice,
        score,
        reasoning: reasoning.slice(0, -2) // Enlever la dernière virgule
      };
    }).sort((a, b) => b.score - a.score);
  }

  private detectSentiment(text: string): string {
    const positiveWords = ['excellent', 'super', 'génial', 'fantastique', 'merveilleux'];
    const negativeWords = ['triste', 'difficile', 'problème', 'erreur', 'échec'];

    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateComplexity(text: string): 'simple' | 'medium' | 'complex' {
    const avgWordLength = text.split(' ').reduce((sum, word) => sum + word.length, 0) / text.split(' ').length;

    if (avgWordLength < 5) return 'simple';
    if (avgWordLength < 7) return 'medium';
    return 'complex';
  }

  private extractTopics(text: string): string[] {
    const topics = [];
    if (text.includes('commercial') || text.includes('vente')) topics.push('commercial');
    if (text.includes('éducation') || text.includes('apprendre')) topics.push('educational');
    if (text.includes('histoire') || text.includes('récit')) topics.push('storytelling');
    return topics;
  }

  private detectStyle(text: string): string {
    if (text.includes('achetez') || text.includes('offre')) return 'commercial';
    if (text.includes('donc') || text.includes('par exemple')) return 'educational';
    if (text.includes('il était') || text.includes('histoire')) return 'narrative';
    return 'neutral';
  }
}