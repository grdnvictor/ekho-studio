import { z } from "zod";
import { ContractSkeletonType } from "@/contracts";

type GenerateAudioContract = {
  text: string,
}

export const GenerateAudioContract: ContractSkeletonType<GenerateAudioContract> =
  z.object({
    body: z.object({
      text: z.string(),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
  });

export type GenerateAudioContractType = typeof GenerateAudioContract;
