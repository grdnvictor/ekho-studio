import {z, ZodType} from "zod";
import { Request } from "express";
import { Prisma } from "@/prisma";

export type ValidatedRequest<T extends ZodType> = Request & {
    validated: z.infer<T>;
};