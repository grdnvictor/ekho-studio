import { writeFile } from "fs";
import mime from "mime";
import { WavConversionOptions, AudioChunk } from "./types";
import { DEFAULT_WAV_OPTIONS } from "./constants";

export class AudioUtils {
  static saveBinaryFile(fileName: string, content: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      writeFile(fileName, content, { encoding: "binary" }, (err) => {
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

  static convertToWav(rawData: string, mimeType: string): Buffer {
    const options = AudioUtils.parseMimeType(mimeType);
    const wavHeader = AudioUtils.createWavHeader(rawData.length, options);
    const buffer = Buffer.from(rawData, "base64");
    return Buffer.concat([wavHeader, buffer]);
  }

  static parseMimeType(mimeType: string): WavConversionOptions {
    const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
    const [, format] = fileType.split("/");

    const options: Partial<WavConversionOptions> = {
      ...DEFAULT_WAV_OPTIONS,
    };

    if (format && format.startsWith("L")) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split("=").map((s) => s.trim());
      if (key === "rate") {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return options as WavConversionOptions;
  }

  static createWavHeader(
    dataLength: number,
    options: WavConversionOptions,
  ): Buffer {
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

  static async processResponse(
    response: AsyncIterable<AudioChunk>,
  ): Promise<void> {
    let fileIndex = 0;
    for await (const chunk of response) {
      console.log("Chunk reçu:", chunk);
      if (
        !chunk.candidates ||
        !chunk.candidates[0].content ||
        !chunk.candidates[0].content.parts
      ) {
        console.log("Pas de candidats valides dans ce chunk");
        continue;
      }
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        console.log("Données audio trouvées, création du fichier...");
        const fileName = `audio_output_${fileIndex++}`;
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        let fileExtension =
          mime.getExtension(inlineData.mimeType || "") || "wav";
        let buffer = Buffer.from(inlineData.data || "", "base64");
        if (fileExtension === "wav") {
          buffer = AudioUtils.convertToWav(
            inlineData.data || "",
            inlineData.mimeType || "",
          );
        }
        await AudioUtils.saveBinaryFile(
          `${fileName}.${fileExtension}`,
          buffer,
        );
      } else {
        console.log("Texte reçu:", chunk.text);
      }
    }
  }
}