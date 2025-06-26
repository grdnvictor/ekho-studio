import { z } from "zod";
import { ContractSkeletonType } from "@/contracts";

// Contrat pour la génération d'audio simple
type GenerateAudioContract = {
  text: string;
  voiceName?: string;
  emotion?: string;
  speed?: number;
}

export const GenerateAudioContract: ContractSkeletonType<GenerateAudioContract> =
  z.object({
    body: z.object({
      text: z.string().min(1, "Le texte ne peut pas être vide"),
      voiceName: z.string().optional().default("Aoede"),
      emotion: z.string().optional(),
      speed: z.number().min(0.5).max(2).optional().default(1),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
  });

export type GenerateAudioContractType = typeof GenerateAudioContract;