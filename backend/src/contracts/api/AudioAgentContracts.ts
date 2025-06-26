import { z } from "zod";
import { ContractSkeletonType } from "@/contracts";

// Contrat pour le chat avec l'agent
type AudioAgentChatContract = {
  message: string;
  sessionId?: string;
  context?: {
    targetAudience?: string;
    style?: string;
    duration?: number;
    emotion?: string;
  };
}

export const AudioAgentChatContract: ContractSkeletonType<AudioAgentChatContract> =
  z.object({
    body: z.object({
      message: z.string().min(1, "Le message ne peut pas être vide"),
      sessionId: z.string().optional(),
      context: z.object({
        targetAudience: z.string().optional(),
        style: z.string().optional(),
        duration: z.number().min(5).max(3600).optional(),
        emotion: z.string().optional(),
      }).optional(),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
  });

// Contrat pour la génération complète d'un projet audio
type AudioProjectContract = {
  title: string;
  description: string;
  requirements: {
    duration: number;
    style: string;
    targetAudience: string;
    objectives: string[];
    content?: string;
  };
  constraints?: {
    deadline?: string;
    budget?: number;
    technicalSpecs?: {
      format: string;
      quality: string;
    };
  };
}

export const AudioProjectContract: ContractSkeletonType<AudioProjectContract> =
  z.object({
    body: z.object({
      title: z.string().min(1, "Le titre est requis"),
      description: z.string().min(1, "La description est requise"),
      requirements: z.object({
        duration: z.number().min(5).max(3600),
        style: z.string().min(1),
        targetAudience: z.string().min(1),
        objectives: z.array(z.string()).min(1),
        content: z.string().optional(),
      }),
      constraints: z.object({
        deadline: z.string().optional(),
        budget: z.number().optional(),
        technicalSpecs: z.object({
          format: z.string(),
          quality: z.string(),
        }).optional(),
      }).optional(),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
  });

export type AudioAgentChatContractType = typeof AudioAgentChatContract;
export type AudioProjectContractType = typeof AudioProjectContract;