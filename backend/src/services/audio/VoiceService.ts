// backend/src/services/audio/VoiceService.ts

import { ChatOpenAI } from "@langchain/openai";
import {
  VoiceProfile,
  VoiceAnalysisParams,
  VoiceRecommendation,
  VoiceGender,
  VoiceAge,
} from "@/types/audio";

export class VoiceService {
  private voiceDatabase: VoiceProfile[] = this.initializeVoiceDatabase();
  private llm: ChatOpenAI = new ChatOpenAI({
    temperature: 0.3,
    modelName: "local-model",
    openAIApiKey: "lm-studio",
    configuration: {
      baseURL: "http://localhost:1234/v1",
    },
  });

  async analyzeAndRecommendVoice(params: VoiceAnalysisParams): Promise<VoiceRecommendation> {
    const analysis = await this.analyzeContentWithLLM(params.content, params.targetAudience);
    const scored = this.scoreVoices(params, analysis);
    const bestVoice = scored[0];

    return {
      voiceName: bestVoice.profile.name,
      voiceProfile: bestVoice.profile,
      reasoning: bestVoice.reasoning,
      alternatives: scored.slice(1, 4).map(v => v.profile),
      confidenceScore: bestVoice.score,
      previewUrl: bestVoice.profile.sampleUrl,
    };
  }

  private async analyzeContentWithLLM(content: string, targetAudience: string): Promise<any> {
    const prompt = `Analyse ce contenu: "${content}" pour "${targetAudience}" et retourne un JSON avec les champs sentiment, style, emotion, formality, energy, recommended_gender, recommended_age.`;

    const response = await this.llm.invoke(prompt);
    const jsonMatch = (response.content as string).match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : this.analyzeContentFallback(content);
  }

  private scoreVoices(params: VoiceAnalysisParams, analysis: any) {/* ... */}
  private analyzeContentFallback(content: string): any {/* ... */}
  private initializeVoiceDatabase(): VoiceProfile[] {/* ... */}
}
