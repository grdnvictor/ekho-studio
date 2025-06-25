import { Request } from "express";

export interface ValidatedRequest<T> extends Request {
  body: T;
}

export interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

export interface AudioGenerationRequest {
  text: string;
  apiKey: string;
}

export interface AudioChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
  text?: string;
}