import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "200");

    const items = await prisma.item.findMany({
      where: { tema: null },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    let updatedCount = 0;

    for (const item of items) {
      const { impacto, tipo, tema, keywordsHit } = classifyItem(item.title, item.summary || "");

      const dataToUpdate: Record<string, unknown> = {};
      if (tema) dataToUpdate.tema = tema;
      if (!item.tipo || item.tipo === "NOTA") dataToUpdate.tipo = tipo;
      if (!item.impacto) dataToUpdate.impacto = impacto;
      dataToUpdate.keywordsHit = keywordsHit.length > 0 ? keywordsHit.join(",") : null;

      if (Object.keys(dataToUpdate).length > 0) {
        await prisma.item.update({ where: { id: item.id }, data: dataToUpdate });
        updatedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      processed: items.length,
      updated: updatedCount,
      message: `Reclasificados ${updatedCount} de ${items.length} items (tema=null)`,
    });
  } catch (err: any) {
    console.error("Reclassify error", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

