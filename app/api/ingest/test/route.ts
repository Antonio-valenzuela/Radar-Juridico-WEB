import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const url = "https://example.com/" + Date.now();

  const row = await prisma.item.create({
    data: {
      source: "TEST",
      title: "Test insert",
      url,
      published: new Date(),
      summary: "Insert de prueba",
      impacto: null,
      tema: null,
      tipo: null,
    },
  });

  return NextResponse.json({ ok: true, id: row.id, url: row.url });
}