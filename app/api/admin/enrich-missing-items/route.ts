import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { enrichItem } from "@/lib/enrichment/enrichItem";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    let limit = 20;
    try {
      const body = await req.json();
      if (body && typeof body.limit === "number") {
        limit = Math.min(Math.max(1, body.limit), 50);
      }
    } catch {
      // Body might be empty or invalid, fallback to default
    }

    // Find items without enrichment
    const missingItems = await prisma.item.findMany({
      where: {
        aiEnrichment: null,
      },
      take: limit,
      select: { id: true },
      orderBy: { published: "desc" },
    });

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const item of missingItems) {
      const res = await enrichItem(item.id);
      if (res.ok) {
        successCount++;
        results.push({ itemId: item.id, ok: true });
      } else {
        failedCount++;
        results.push({ itemId: item.id, ok: false, error: res.error });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: missingItems.length,
      successCount,
      failedCount,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

