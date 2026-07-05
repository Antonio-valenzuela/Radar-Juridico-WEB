import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeSources = await prisma.officialSource.findMany({
      where: { isActive: true },
      select: {
        name: true,
        type: true,
        jurisdiction: true,
        country: true,
        state: true,
        matter: true,
        isOfficial: true,
        trustLevel: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, sources: activeSources });
  } catch (error: any) {
    console.error("[api/sources] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "No se pudo obtener el catálogo de fuentes oficiales." },
      { status: 500 }
    );
  }
}
