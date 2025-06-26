export const AUDIO_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 30000, // 30 secondes
  MODEL: "gemini-2.5-flash-preview-tts",
  TEMPERATURE: 0.3,
  VOICE_NAME: "Sadachbia", // Nom de la voix préconfigurée
} as const;

export const DEFAULT_WAV_OPTIONS = {
  numChannels: 1,
} as const;