import { z } from "zod";

export const VoiceSelectionContract = {
  body: z.object({
    content: z.string().min(1, "Le contenu est requis"),
    targetAudience: z.string().min(1, "L'audience cible est requise"),
    emotion: z.string().min(1, "L'émotion est requise"),
    gender: z.enum(["male", "female", "neutral"]).optional(),
    age: z.enum(["young", "adult", "mature"]).optional()
  }),
  response: z.object({
    recommendedVoice: z.string(),
    reasoning: z.string(),
    alternatives: z.array(z.string()),
    confidenceScore: z.number().optional()
  })
};

export const AudioGenerationContract = {
  body: z.object({
    text: z.string().min(1, "Le texte est requis"),
    voiceName: z.string().min(1, "Le nom de la voix est requis"),
    emotion: z.string().optional(),
    speed: z.number().min(0.5).max(2).optional(),
    effects: z.array(z.string()).optional()
  }),
  response: z.object({
    url: z.string(),
    duration: z.number(),
    quality: z.string(),
    fileSize: z.number(),
    downloadUrl: z.string()
  })
};

export const ScriptOptimizationContract = {
  body: z.object({
    originalText: z.string().min(1, "Le texte original est requis"),
    targetDuration: z.number().min(5).max(3600),
    style: z.string().min(1, "Le style est requis"),
    constraints: z.array(z.string()).optional()
  }),
  response: z.object({
    text: z.string(),
    changes: z.array(z.any()),
    duration: z.number(),
    suggestions: z.array(z.string())
  })
};

export type VoiceSelectionContractType = typeof VoiceSelectionContract;
export type AudioGenerationContractType = typeof AudioGenerationContract;
export type ScriptOptimizationContractType = typeof ScriptOptimizationContract; 