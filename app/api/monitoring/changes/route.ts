import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function safeLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

function safeDays(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 30;
  return Math.min(parsed, 365);
}

function serializeChange(change: {
  id: string;
  changeType: string;
  changeDescription: string;
  sourceUrl: string | null;
  detectedAt: Date;
  previousHash: string | null;
  newHash: string | null;
  priority: string;
  reviewStatus: string;
  matter: string | null;
  jurisdiction: string | null;
  createdAt: Date;
  documentVersion: {
    id: string;
    contentHash: string;
    createdAt: Date;
    etag: string | null;
    lastModified: Date | null;
    fileSize: bigint | null;
    sourceUrl: string | null;
    document: {
      id: string;
      title: string;
      shortCode: string | null;
      officialUrl: string | null;
      monitoringStatus: string | null;
    };
  };
}) {
  return {
    id: change.id,
    changeType: change.changeType,
    changeDescription: change.changeDescription,
    sourceUrl: change.sourceUrl,
    detectedAt: change.detectedAt.toISOString(),
    previousHash: change.previousHash,
    newHash: change.newHash,
    priority: change.priority,
    reviewStatus: change.reviewStatus,
    matter: change.matter,
    jurisdiction: change.jurisdiction,
    createdAt: change.createdAt.toISOString(),
    documentVersion: {
      id: change.documentVersion.id,
      contentHash: change.documentVersion.contentHash,
      createdAt: change.documentVersion.createdAt.toISOString(),
      etag: change.documentVersion.etag,
      lastModified: change.documentVersion.lastModified?.toISOString() ?? null,
      fileSize: change.documentVersion.fileSize?.toString() ?? null,
      sourceUrl: change.documentVersion.sourceUrl,
    },
    document: change.documentVersion.document,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const matter = searchParams.get("matter")?.trim() || "";
    const status = searchParams.get("reviewStatus")?.trim() || "";
    const days = safeDays(searchParams.get("days"));
    const limit = safeLimit(searchParams.get("limit"));
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - days);

    const where: Prisma.DocumentChangeWhereInput = {
      detectedAt: { gte: startDate },
    };

    if (query) {
      where.OR = [
        { changeDescription: { contains: query, mode: "insensitive" } },
        { matter: { contains: query, mode: "insensitive" } },
        {
          documentVersion: {
            document: {
              title: { contains: query, mode: "insensitive" },
            },
          },
        },
      ];
    }

    if (matter) {
      where.matter = { contains: matter, mode: "insensitive" };
    }

    if (status) {
      where.reviewStatus = status;
    }

    const changes = await prisma.documentChange.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: limit,
      select: {
        id: true,
        changeType: true,
        changeDescription: true,
        sourceUrl: true,
        detectedAt: true,
        previousHash: true,
        newHash: true,
        priority: true,
        reviewStatus: true,
        matter: true,
        jurisdiction: true,
        createdAt: true,
        documentVersion: {
          select: {
            id: true,
            contentHash: true,
            createdAt: true,
            etag: true,
            lastModified: true,
            fileSize: true,
            sourceUrl: true,
            document: {
              select: {
                id: true,
                title: true,
                shortCode: true,
                officialUrl: true,
                monitoringStatus: true,
              },
            },
          },
        },
      },
    });

    const serialized = changes.map(serializeChange);

    return NextResponse.json({
      ok: true,
      range: {
        days,
        startDate: startDate.toISOString(),
      },
      summary: {
        total: serialized.length,
        pendingReview: serialized.filter((change) => change.reviewStatus === "nueva").length,
      },
      changes: serialized,
      message: serialized.length === 0 ? "No hay cambios indexados para el periodo consultado." : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (_error) {
    console.error("[monitoring-changes] GET error:", _error);
    return NextResponse.json(
      {
        ok: false,
        message: "No se pudieron consultar los cambios detectados. Intenta de nuevo en unos momentos.",
        changes: [],
      },
      { status: 503 },
    );
  }
}
