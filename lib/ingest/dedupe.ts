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
    void processItemNormaDiff(updated.id).catch((error) => {
      console.warn("[norma-diff] duplicate processing failed", updated.id, error);
    });
    return { created: false, id: duplicate.id, hash };
  }

  const created = await prisma.item.create({ data });
  void processItemNormaDiff(created.id).catch((error) => {
    console.warn("[norma-diff] processing failed", created.id, error);
  });
  return { created: true, id: created.id, hash };
}
