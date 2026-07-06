import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function safeLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

function serializeDocument(document: {
  id: string;
  title: string;
  shortCode: string | null;
  matter: string | null;
  jurisdiction: string;
  documentType: string;
  officialUrl: string | null;
  officialSourceUrl: string | null;
  monitoringStatus: string | null;
  changeSummary: string | null;
  currentHash: string | null;
  etag: string | null;
  lastModified: Date | null;
  fileSize: bigint | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  officialSource: { name: string; slug: string; baseUrl: string } | null;
  versions: Array<{
    id: string;
    contentHash: string;
    createdAt: Date;
    etag: string | null;
    lastModified: Date | null;
    fileSize: bigint | null;
    sourceUrl: string | null;
  }>;
}) {
  const latestVersion = document.versions[0] ?? null;

  return {
    id: document.id,
    title: document.title,
    shortCode: document.shortCode,
    matter: document.matter,
    jurisdiction: document.jurisdiction,
    documentType: document.documentType,
    officialUrl: document.officialUrl,
    officialSourceUrl: document.officialSourceUrl,
    officialSource: document.officialSource,
    monitoringStatus: document.monitoringStatus,
    changeSummary: document.changeSummary,
    currentHash: document.currentHash,
    etag: document.etag,
    lastModified: document.lastModified?.toISOString() ?? null,
    fileSize: document.fileSize?.toString() ?? null,
    lastCheckedAt: document.lastCheckedAt?.toISOString() ?? null,
    lastError: document.lastError,
    latestVersion: latestVersion
      ? {
          id: latestVersion.id,
          contentHash: latestVersion.contentHash,
          createdAt: latestVersion.createdAt.toISOString(),
          etag: latestVersion.etag,
          lastModified: latestVersion.lastModified?.toISOString() ?? null,
          fileSize: latestVersion.fileSize?.toString() ?? null,
          sourceUrl: latestVersion.sourceUrl,
        }
      : null,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const matter = searchParams.get("matter")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const limit = safeLimit(searchParams.get("limit"));

    const where: Prisma.DocumentWhereInput = {
      officialUrl: { not: null },
      shortCode: { not: null },
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { shortCode: { contains: query, mode: "insensitive" } },
        { matter: { contains: query, mode: "insensitive" } },
      ];
    }

    if (matter) {
      where.matter = { contains: matter, mode: "insensitive" };
    }

    if (status) {
      where.monitoringStatus = status;
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: [{ lastCheckedAt: "desc" }, { shortCode: "asc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        shortCode: true,
        matter: true,
        jurisdiction: true,
        documentType: true,
        officialUrl: true,
        officialSourceUrl: true,
        monitoringStatus: true,
        changeSummary: true,
        currentHash: true,
        etag: true,
        lastModified: true,
        fileSize: true,
        lastCheckedAt: true,
        lastError: true,
        officialSource: {
          select: {
            name: true,
            slug: true,
            baseUrl: true,
          },
        },
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            contentHash: true,
            createdAt: true,
            etag: true,
            lastModified: true,
            fileSize: true,
            sourceUrl: true,
          },
        },
      },
    });

    const serialized = documents.map(serializeDocument);
    const byStatus = serialized.reduce<Record<string, number>>((acc, document) => {
      const key = document.monitoringStatus || "sin_revision";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      summary: {
        total: serialized.length,
        byStatus,
      },
      documents: serialized,
      message: serialized.length === 0 ? "No hay documentos monitoreados registrados todavia." : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (_error) {
    console.error("[monitoring-documents] GET error:", _error);
    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo consultar el monitoreo de documentos. Intenta de nuevo en unos momentos.",
        documents: [],
      },
      { status: 503 },
    );
  }
}
