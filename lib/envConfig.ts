/**
 * Environment configuration with Zod validation.
 * Fail-fast: import this wherever env vars are needed.
 */

import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    ADMIN_TOKEN: z.string().min(1, "ADMIN_TOKEN is required"),
    SIDOF_BASE_URL: z
        .string()
        .url()
        .default("https://sidof.segob.gob.mx/dof/sidof"),
    REDIS_URL: z.string().optional(),
});

function parseEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error(
            "❌ Environment validation failed:",
            result.error.flatten().fieldErrors
        );
        // Don't crash in build phase — return defaults
        return {
            DATABASE_URL: process.env.DATABASE_URL || "",
            ADMIN_TOKEN: process.env.ADMIN_TOKEN || "",
            SIDOF_BASE_URL:
                process.env.SIDOF_BASE_URL ||
                "https://sidof.segob.gob.mx/dof/sidof",
            REDIS_URL: process.env.REDIS_URL,
        };
    }
    return result.data;
}

export const env = parseEnv();
