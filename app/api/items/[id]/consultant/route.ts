import { NextRequest, NextResponse } from "next/server";
import { getOrCreateConsultantInsight } from "@/lib/consultant/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";
  const insight = await getOrCreateConsultantInsight(id, force);

  if (!insight) {
    return NextResponse.json({ ok: false, error: "Item no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, insight });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const insight = await getOrCreateConsultantInsight(id, true);

  if (!insight) {
    return NextResponse.json({ ok: false, error: "Item no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, insight });
}
