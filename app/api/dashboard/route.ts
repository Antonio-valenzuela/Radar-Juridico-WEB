import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

/**
 * API Route: /api/dashboard
 * Centraliza la lógica de búsqueda con expansión de query.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const source = url.searchParams.get("source") || undefined;
  const impacto = url.searchParams.get("impacto") || undefined;
  const tipo = url.searchParams.get("tipo") || undefined;
  const tema = url.searchParams.get("tema") || undefined;
  const rangeParam = url.searchParams.get("range");
  const range = rangeParam === "today" || rangeParam === "week" || rangeParam === "all"
    ? rangeParam
    : undefined;
  const includeNoise = url.searchParams.get("includeNoise") === "true";

  const data = await getDashboardData({ q, source, impacto, tipo, tema, range, includeNoise });

  return NextResponse.json(data);
}
