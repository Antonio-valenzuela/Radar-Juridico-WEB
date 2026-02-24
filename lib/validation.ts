import { z } from "zod";

// ─── Source ───

export const SourceCreateSchema = z.object({
    nombre: z.string().min(1, "Nombre es requerido").max(200),
    url: z.string().url("URL inválida"),
    tipo: z.enum(["federal", "estatal", "reglamento", "tribunal"]),
    metodo_extraccion: z.enum(["html", "pdf", "rss"]).default("html"),
    activo: z.boolean().default(true),
    frecuencia_minutos: z.number().int().min(5).max(1440).default(60),
});

export const SourceUpdateSchema = SourceCreateSchema.partial();

export type SourceCreate = z.infer<typeof SourceCreateSchema>;
export type SourceUpdate = z.infer<typeof SourceUpdateSchema>;

// ─── Document Filters ───

export const DocumentFilterSchema = z.object({
    q: z.string().optional(),
    materia: z.string().optional(),
    nivel: z.string().optional(),
    impacto: z.enum(["alto", "medio", "bajo"]).optional(),
    sourceId: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type DocumentFilter = z.infer<typeof DocumentFilterSchema>;

// ─── Notification ───

export const NotificationMarkReadSchema = z.object({
    ids: z.array(z.string()).min(1).optional(),
    all: z.boolean().optional(),
});

// ─── Force Scan ───

export const ForceScanSchema = z.object({
    sourceId: z.string().optional(), // omit = scan all
});

// ─── Generic API response ───

export type ApiResponse<T = unknown> = {
    ok: boolean;
    data?: T;
    error?: string;
    meta?: {
        page: number;
        limit: number;
        total: number;
    };
};
