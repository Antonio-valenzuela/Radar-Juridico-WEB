import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const deleted = await prisma.item.deleteMany({
    where: {
      OR: [
        { url: { startsWith: "https://example.com/" } },
        { title: { startsWith: "Demo:" } },
        { title: { contains: "Bienvenido al Sistema de Información", mode: "insensitive" } },
        { title: { contains: "Diario Oficial de la Federación || Bienvenido", mode: "insensitive" } },
      ],
    },
  });

  return NextResponse.json({ ok: true, deleted: deleted.count });
}
