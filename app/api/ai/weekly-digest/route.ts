import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWeeklyDigest } from "../../../../lib/ai/router";
import { requireAdmin } from "../../../../lib/security/adminAuth";
import { checkRateLimit, extractIp } from "../../../../lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const adminCheck = requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const ip = extractIp(request);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429, headers: rateLimit.headers });
  }

  const days = parseDays(request.nextUrl.searchParams.get("days"));
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodEnd.getDate() - days);

  const items = await prisma.item.findMany({
    where: {
      published: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    orderBy: { published: "desc" },
    take: 500,
    select: {
      title: true,
      summary: true,
      tema: true,
      impacto: true,
      source: true,
      published: true,
    },
  });

  const digest = await generateWeeklyDigest({
    periodStart,
    periodEnd,
    documents: items.map((item) => ({
      title: item.title,
      summary: item.summary,
      matter: item.tema,
      impactLevel: item.impacto,
      source: item.source,
      publishedAt: item.published,
    })),
  });

  return NextResponse.json({ ok: true, digest });
}

function parseDays(value: string | null) {
  const parsed = Number(value || process.env.AI_WEEKLY_DIGEST_DAYS || 7);
  if (!Number.isFinite(parsed) || parsed < 1) return 7;
  return Math.min(30, Math.floor(parsed));
}
