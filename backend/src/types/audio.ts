
import { z } from "zod";

// ========== ENUMS ==========

export enum VoiceGender {
  MALE = "male",
  FEMALE = "female", 
  NEUTRAL = "neutral"
}

export enum VoiceAge {
  YOUNG = "young",
  ADULT = "adult",
  MATURE = "mature"
}

export enum AudioStyle {
  NARRATIVE = "narrative",
  COMMERCIAL = "commercial", 
  EDUCATIONAL = "educational",
  PODCAST = "podcast",
  DRAMATIC = "dramatic"
}

export enum AudioGenre {
  AMBIENT = "ambient",
  CORPORATE = "corporate",
  DRAMATIC = "dramatic", 
  UPBEAT = "upbeat",
  CLASSICAL = "classical",
  ELECTRONIC = "electronic"
}

export enum AudioIntensity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high"
}

export enum AudioPlatform {
  SOCIAL = "social",
  RADIO = "radio",
  PODCAST = "podcast",
  COMMERCIAL = "commercial",
  ELEARNING = "elearning"
}

// ========== SCHEMAS ZOD ==========

export const VoiceSelectionSchema = z.object({
  content: z.string().describe("Le texte à vocaliser"),
  targetAudience: z.string().describe("Public cible"),
  emotion: z.string().describe("Émotion souhaitée"),
  gender: z.nativeEnum(VoiceGender).optional(),
  age: z.nativeEnum(VoiceAge).optional()
});

export const ScriptGenerationSchema = z.object({
  topic: z.string().describe("Sujet principal du script"),
  duration: z.number().min(5).max(3600).describe("Durée souhaitée en secondes"),
  style: z.nativeEnum(AudioStyle),
  targetAudience: z.string().describe("Public cible"),
  objectives: z.array(z.string()).describe("Objectifs du contenu")
});

export const AudienceAnalysisSchema = z.object({
  content: z.string().describe("Contenu à analyser"),
  context: z.string().describe("Contexte d'utilisation"),
  platform: z.nativeEnum(AudioPlatform).optional()
});

export const AudioGenerationSchema = z.object({
  text: z.string().describe("Texte à vocaliser"),
  voiceName: z.string().describe("Nom de la voix à utiliser"),
  emotion: z.string().optional().describe("Émotion à appliquer"),
  speed: z.number().min(0.5).max(2).optional().describe("Vitesse de lecture"),
  effects: z.array(z.string()).optional().describe("Effets audio à appliquer")
});

export const MusicGenerationSchema = z.object({
  genre: z.nativeEnum(AudioGenre),
  mood: z.string().describe("Ambiance souhaitée"),
  duration: z.number().min(5).max(600).describe("Durée en secondes"),
  intensity: z.nativeEnum(AudioIntensity).describe("Intensité musicale"),
  instruments: z.array(z.string()).optional().describe("Instruments préférés")
});

export const ContentOptimizationSchema = z.object({
  originalText: z.string().describe("Texte original à optimiser"),
  targetDuration: z.number().min(5).max(3600).describe("Durée cible en secondes"),
  style: z.string().describe("Style souhaité"),
  constraints: z.array(z.string()).optional().describe("Contraintes spécifiques")
});

// ========== INTERFACES ==========

export interface VoiceProfile {
  id: string;
  name: string;
  displayName: string;
  gender: VoiceGender;
  age: VoiceAge;
  language: string;
  accent?: string;
  description: string;
  emotions: string[];
  sampleUrl?: string;
  tags: string[];
  popularity: number;
  quality: 'basic' | 'premium' | 'professional';
}

export interface VoiceAnalysisParams {
  content: string;
  targetAudience: string;
  emotion: string;
  gender?: VoiceGender;
  age?: VoiceAge;
}

export interface VoiceRecommendation {
  voiceName: string;
  voiceProfile: VoiceProfile;
  reasoning: string;
  alternatives: VoiceProfile[];
  previewUrl?: string;
  confidenceScore: number;
}

export interface ScriptGenerationParams {
  topic: string;
  duration: number;
  style: AudioStyle;
  targetAudience: string;
  objectives: string[];
}

export interface ScriptResult {
  content: string;
  structure: ScriptStructure;
  estimatedTiming: TimingInfo;
  improvementSuggestions: string[];
  metadata: ScriptMetadata;
}

export interface ScriptStructure {
  introduction: string;
  mainContent: string[];
  conclusion: string;
  callToAction?: string;
  transitions: string[];
}

export interface TimingInfo {
  totalDuration: number;
  sections: SectionTiming[];
  wordsPerMinute: number;
  pauseRecommendations: PauseRecommendation[];
}

export interface SectionTiming {
  section: string;
  startTime: number;
  endTime: number;
  wordCount: number;
}

export interface PauseRecommendation {
  position: number;
  duration: number;
  reason: string;
}

export interface ScriptMetadata {
  wordCount: number;
  readabilityScore: number;
  emotionalTone: string;
  keyTopics: string[];
  suggestedVoices: string[];
}

export interface AudienceAnalysisParams {
  content: string;
  context: string;
  platform?: AudioPlatform;
}

export interface AudienceAnalysisResult {
  primary: AudienceSegment;
  secondary: AudienceSegment[];
  demographics: Demographics;
  preferences: AudioPreferences;
  recommendations: AudienceRecommendations;
}

export interface AudienceSegment {
  name: string;
  description: string;
  size: 'small' | 'medium' | 'large';
  characteristics: string[];
  preferredContent: string[];
}

export interface Demographics {
  ageRange: string;
  gender: string;
  interests: string[];
  platforms: string[];
  consumptionHabits: string[];
}

export interface AudioPreferences {
  voiceStyle: string[];
  musicGenres: string[];
  contentLength: string;
  emotionalTone: string[];
  pace: 'slow' | 'medium' | 'fast';
}

export interface AudienceRecommendations {
  voiceRecommendations: string[];
  styleRecommendations: string[];
  contentRecommendations: string[];
  platformOptimizations: string[];
}

export interface AudioGenerationParams {
  text: string;
  voiceName: string;
  emotion?: string;
  speed?: number;
  effects?: string[];
}

export interface AudioResult {
  url: string;
  duration: number;
  quality: 'low' | 'medium' | 'high' | 'premium';
  fileSize: number;
  downloadUrl: string;
  metadata: AudioMetadata;
}

export interface AudioMetadata {
  format: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  generatedAt: Date;
  processingTime: number;
}

export interface MusicGenerationParams {
  genre: AudioGenre;
  mood: string;
  duration: number;
  intensity: AudioIntensity;
  instruments?: string[];
}

export interface MusicResult {
  url: string;
  detectedGenre: string;
  bpm: number;
  key: string;
  structure: MusicStructure;
  metadata: MusicMetadata;
}

export interface MusicStructure {
  intro: number;
  verse: number;
  chorus?: number;
  bridge?: number;
  outro: number;
  totalSections: number;
}

export interface MusicMetadata {
  format: string;
  quality: string;
  generatedAt: Date;
  instruments: string[];
  energyLevel: number;
}

export interface ContentOptimizationParams {
  originalText: string;
  targetDuration: number;
  style: string;
  constraints?: string[];
}

export interface OptimizationResult {
  text: string;
  changes: OptimizationChange[];
  duration: number;
  readability: ReadabilityMetrics;
  suggestions: string[];
}

export interface OptimizationChange {
  type: 'addition' | 'deletion' | 'modification';
  original: string;
  optimized: string;
  reason: string;
  position: number;
}

export interface ReadabilityMetrics {
  score: number;
  grade: string;
  avgSentenceLength: number;
  avgWordLength: number;
  complexWords: number;
}

// ========== AGENT SPECIFIC TYPES ==========

export interface AudioAgentContext {
  userId: string;
  sessionId: string;
  preferences: UserAudioPreferences;
  history: AudioGenerationHistory[];
}

export interface UserAudioPreferences {
  preferredVoices: string[];
  defaultStyle: AudioStyle;
  qualityLevel: 'basic' | 'premium';
  languagePreference: string;
  customSettings: Record<string, any>;
}

export interface AudioGenerationHistory {
  id: string;
  timestamp: Date;
  request: any;
  result: AudioResult;
  rating?: number;
  feedback?: string;
}

export interface AudioAgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  suggestions?: string[];
  nextSteps?: string[];
}

export interface AudioProjectRequest {
  title: string;
  description: string;
  requirements: ProjectRequirements;
  constraints?: ProjectConstraints;
}

export interface ProjectRequirements {
  duration: number;
  style: AudioStyle;
  targetAudience: string;
  platform: AudioPlatform;
  objectives: string[];
  content?: string;
}

export interface ProjectConstraints {
  budget?: number;
  deadline?: Date;
  technicalSpecs?: TechnicalSpecs;
  brandGuidelines?: BrandGuidelines;
}

export interface TechnicalSpecs {
  format: string;
  quality: string;
  channels: number;
  sampleRate: number;
}

export interface BrandGuidelines {
  voicePersonality: string;
  toneOfVoice: string;
  musicStyle?: string;
  doNotUse: string[];
}

// ========== TYPE INFERENCE ==========

export type VoiceSelectionInput = z.infer<typeof VoiceSelectionSchema>;
export type ScriptGenerationInput = z.infer<typeof ScriptGenerationSchema>;
export type AudienceAnalysisInput = z.infer<typeof AudienceAnalysisSchema>;
export type AudioGenerationInput = z.infer<typeof AudioGenerationSchema>;
export type MusicGenerationInput = z.infer<typeof MusicGenerationSchema>;
export type ContentOptimizationInput = z.infer<typeof ContentOptimizationSchema>;

// ========== CONSTANTS ==========

export const AVAILABLE_VOICES = [
  "Sadachbia", "Aoede", "Astra", "Thalia", "Nova", "Echo", "Zara", "Atlas"
] as const;

export const VOICE_EMOTIONS = [
  "neutral", "happy", "sad", "excited", "calm", "dramatic", "professional", "friendly"
] as const;

export const AUDIO_EFFECTS = [
  "reverb", "echo", "normalize", "compress", "eq", "noise_reduction"
] as const;

export const MUSIC_INSTRUMENTS = [
  "piano", "guitar", "strings", "brass", "woodwinds", "percussion", "synthesizer", "bass"
] as const;
