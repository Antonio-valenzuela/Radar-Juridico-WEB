import { NextResponse } from "next/server";
import { ingestScjnComunicados } from "@/lib/ingest/scjn";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const start = parseInt(searchParams.get("from") || "8200"); // Marzo 2025 aprox
    const count = parseInt(searchParams.get("last") || "30");

    const result = await ingestScjnComunicados(start, count);
    return NextResponse.json(result);
}
