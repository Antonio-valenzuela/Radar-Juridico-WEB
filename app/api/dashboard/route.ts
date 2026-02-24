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

  const data = await getDashboardData({ q, source, impacto, tipo, tema });

  return NextResponse.json(data);
}