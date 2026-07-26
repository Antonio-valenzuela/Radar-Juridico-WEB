import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { processItemNormaDiff } from "@/lib/normas/process";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ ok: false, error: "Item no encontrado" }, { status: 404 });

  const raw = item.raw && typeof item.raw === "object" && !Array.isArray(item.raw)
    ? { ...(item.raw as Record<string, unknown>) }
    : {};
  raw.normaOverride = {
    nombre: body?.nombre,
    sigla: body?.sigla || null,
    fuente: body?.fuente || item.source,
    urlBase: body?.urlBase || item.canonicalUrl || item.url,
  };

  await prisma.item.update({
    where: { id },
    data: { raw: raw as Prisma.InputJsonValue },
  });

  const result = await processItemNormaDiff(id);
  return NextResponse.json({ ok: true, result });
}
