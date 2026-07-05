import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyNormalizedItem } from "@/lib/ingest/classify";
import type { NormalizedItem } from "@/lib/ingest/normalize";
import { processItemNormaDiff } from "@/lib/normas/process";

export function makeItemHash(item: Pick<NormalizedItem, "source" | "title" | "published" | "canonicalUrl">) {
  const payload = [
    item.source,
    item.title.normalize("NFC").toLowerCase(),
    item.published.toISOString().slice(0, 10),
    item.canonicalUrl.toLowerCase(),
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function mirrorItemToDocument(
  item: NormalizedItem,
  dbItem: { id: string },
  hash: string,
  classification: ReturnType<typeof classifyNormalizedItem>
) {
  try {
    const rawText = [
      item.title,
      item.summary,
      typeof item.raw?.text === "string" ? item.raw.text : "",
      `URL oficial: ${item.canonicalUrl}`,
    ].filter(Boolean).join("\n\n");
    const contentHash = crypto.createHash("sha256").update(rawText || hash).digest("hex");

    const existingDocument = await prisma.document.findFirst({
      where: {
        OR: [
          { canonicalUrl: item.canonicalUrl },
          { canonicalKey: hash },
        ],
      },
    });

    const documentData = {
      source: item.source,
      jurisdiction: "MX",
      documentType: classification.tipo || item.tipo || "DOCUMENTO",
      title: item.title,
      canonicalKey: hash,
      canonicalUrl: item.canonicalUrl,
      status: "active",
      summary: item.summary,
      hasVersions: true,
      latestVersionHash: contentHash,
    };

    const document = existingDocument
      ? await prisma.document.update({ where: { id: existingDocument.id }, data: documentData })
      : await prisma.document.create({ data: documentData });

    const existingVersion = await prisma.documentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { createdAt: "desc" },
    });

    const versionData = {
      versionLabel: item.published.toISOString().slice(0, 10),
      publishedAt: item.published,
      contentHash,
      rawRef: item.canonicalUrl,
      rawText,
      originalText: rawText,
      sourceItemId: dbItem.id,
    };

    if (existingVersion) {
      await prisma.documentVersion.update({
        where: { id: existingVersion.id },
        data: versionData,
      });
    } else {
      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          ...versionData,
        },
      });
    }
  } catch (error) {
    console.warn("[ingest-dedupe] document mirror failed", item.source, item.sourceId, error instanceof Error ? error.message : String(error));
  }
}

export async function saveDedupedItem(item: NormalizedItem) {
  const hash = makeItemHash(item);
  const classification = classifyNormalizedItem(item);
  const keywordsHit = classification.keywordsHit.length
    ? classification.keywordsHit.join(",")
    : null;

  const duplicate = await prisma.item.findFirst({
    where: {
      OR: [
        { hash },
        { canonicalUrl: item.canonicalUrl },
        { source: item.source, sourceId: item.sourceId },
        { url: item.url },
      ],
    },
  });

  const data: Prisma.ItemUncheckedCreateInput = {
    source: item.source,
    sourceId: item.sourceId,
    title: item.title,
    url: item.url,
    canonicalUrl: item.canonicalUrl,
    hash,
    published: item.published,
    retrievedAt: item.retrievedAt,
    summary: item.summary,
    impacto: classification.impacto,
    tipo: classification.tipo,
    tema: classification.tema,
    category: classification.category,
    keywordsHit,
    rawRef: item.rawRef,
    raw: item.raw as Prisma.InputJsonValue | undefined,
  };

  if (duplicate) {
    const updated = await prisma.item.update({
      where: { id: duplicate.id },
      data,
    });
    await mirrorItemToDocument(item, updated, hash, classification);
    void processItemNormaDiff(updated.id).catch((error) => {
      console.warn("[norma-diff] duplicate processing failed", updated.id, error);
    });
    return { created: false, id: duplicate.id, hash };
  }

  const created = await prisma.item.create({ data });
  await mirrorItemToDocument(item, created, hash, classification);
  void processItemNormaDiff(created.id).catch((error) => {
    console.warn("[norma-diff] processing failed", created.id, error);
  });
  return { created: true, id: created.id, hash };
}
