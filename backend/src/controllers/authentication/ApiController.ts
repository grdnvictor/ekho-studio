import { Request, Response } from "express";
import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import { writeFile } from 'fs';

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

interface AudioGenerationRequest {
  text: string;
  apiKey: string;
}

interface AudioChunk {
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

export class ApiController {

  private static saveBinaryFile(fileName: string, content: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      writeFile(fileName, content, { encoding: 'binary' }, (err) => {
        if (err) {
          console.error(`Error writing file ${fileName}:`, err);
          reject(err);
          return;
        }
        console.log(`File ${fileName} saved to file system.`);
        resolve();
      });
    });
  }

  private static convertToWav(rawData: string, mimeType: string): Buffer {
    const options = ApiController.parseMimeType(mimeType);
    const wavHeader = ApiController.createWavHeader(rawData.length, options);
    const buffer = Buffer.from(rawData, 'base64');
    return Buffer.concat([wavHeader, buffer]);
  }

  private static parseMimeType(mimeType: string): WavConversionOptions {
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [, format] = fileType.split('/');

    const options: Partial<WavConversionOptions> = {
      numChannels: 1,
    };

    if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key === 'rate') {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return options as WavConversionOptions;
  }

  private static createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;

    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
  }

  private static async processResponse(response: AsyncIterable<AudioChunk>): Promise<void> {
    let fileIndex = 0;
    for await (const chunk of response) {
      console.log('Chunk reçu:', chunk);
      if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
        console.log('Pas de candidats valides dans ce chunk');
        continue;
      }
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        console.log('Données audio trouvées, création du fichier...');
        const fileName = `audio_output_${fileIndex++}`;
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        let fileExtension = mime.getExtension(inlineData.mimeType || '') || 'wav';
        let buffer = Buffer.from(inlineData.data || '', 'base64');
        if (fileExtension === 'wav') {
          buffer = ApiController.convertToWav(inlineData.data || '', inlineData.mimeType || '');
        }
        await ApiController.saveBinaryFile(`${fileName}.${fileExtension}`, buffer);
      } else {
        console.log('Texte reçu:', chunk.text);
      }
    }
  }

  static async generateAudio(request: Request<{}, any, AudioGenerationRequest>, response: Response): Promise<void> {
    try {
      const { text, apiKey }: AudioGenerationRequest = request.body;

      if (!text || !apiKey) {
        response.status(400).json({
          error: "Text and apiKey are required"
        });
        return;
      }

      const maxRetries: number = 3;
      const retryDelay: number = 30000; // 30 secondes

      const ai = new GoogleGenAI({
        apiKey: apiKey
      });

      const config: GenerateContentStreamConfig = {
        temperature: 2,
        responseModalities: ['audio'] as const,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Zephyr',
            }
          }
        },
      };

      const model: string = 'gemini-2.5-flash-preview-tts';
      const contents = [
        {
          role: 'user' as const,
          parts: [{
            text: `
            Parle méchamment en mode soulé. 
            Voici le texte à dire : 
            ${text}
            `,
          }],
        },
      ];

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const genResponse = await ai.models.generateContentStream({
            model,
            config,
            contents,
          });

          await ApiController.processResponse(genResponse);

          response.status(200).json({
            message: "Audio generated successfully"
          });
          break;
        } catch (error) {
          const generateError = error as GenerateContentStreamError;
          if (generateError.status === 429 && attempt < maxRetries - 1) {
            console.log(`Limite de quota atteinte, nouvelle tentative dans ${retryDelay/1000}s...`);
            await new Promise<void>(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          console.error('Erreur finale:', error);
          throw error;
        }
      }
    } catch (error: unknown) {
      console.error('Error in generateAudio:', error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
}