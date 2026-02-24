import { NextResponse } from "next/server";
import { ingestSjf } from "@/lib/ingest/sjf";

export const dynamic = "force-dynamic";

// Permitir hasta 5 minutos de ejecución (Vercel/Nextjs limit)
export const maxDuration = 300;

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        // Default startId: Un ID reciente de la Undécima Época.
        // Los registros digitales actuales (2024-2025) están en el rango 2,028,000 - 2,030,000.
        const startIdParam = searchParams.get("startId");
        const countParam = searchParams.get("count");

        const startId = startIdParam ? parseInt(startIdParam) : 2029500;
        const count = countParam ? parseInt(countParam) : 10; // Reducido default por seguridad anti-bot

        const result = await ingestSjf(startId, count);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message || String(error) },
            { status: 500 }
        );
    }
}

