import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/security/adminAuth";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
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

