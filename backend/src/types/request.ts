import {z, ZodType} from "zod";
import { Request } from "express";
import { Prisma } from "@/prisma";

export type ValidatedRequest<T extends ZodType> = Request & {
    validated: z.infer<T>;
};

export type AuthenticatedRequest = Request & {
    user: Prisma.UserGetPayload<{
        include: {
            roles: {
                select: {
                    role: {
                        select: {
                            name: true;
                        };
                    };
                };
            };
            temporaryCodes: {
                select: {
                    type: true,
                    code: true,
                    expiresAt: true,
                },
            };
        };
    }>;
};

export type AuthenticatedValidatedRequest<T extends ZodType> = ValidatedRequest<T> & AuthenticatedRequest;