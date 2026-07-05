import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractTextFromUrl, hashText } from "@/lib/normas/text";
import { detectOrCreateNorma } from "@/lib/normas/detect";
import { diffLegalTexts } from "@/lib/normas/diff";

const LEGAL_TYPES = new Set(["LEY", "CODIGO", "REGLAMENTO", "DECRETO"]);

export async function processItemNormaDiff(itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item || !item.tipo || !LEGAL_TYPES.has(item.tipo)) {
    return { ok: true, skipped: true, reason: "tipo no procesable" };
  }

  const existingVersion = await prisma.normaVersion.findUnique({ where: { sourceItemId: item.id } });
  if (existingVersion) return { ok: true, skipped: true, reason: "version ya existe", versionId: existingVersion.id };

  const extracted = await extractTextFromUrl(item.canonicalUrl || item.url);
  if (!extracted.ok || !extracted.text || extracted.text.length < 500) {
    return {
      ok: false,
      skipped: true,
      reason: extracted.error || "texto completo no disponible",
    };
  }

  const norma = await detectOrCreateNorma(item, extracted.text);
  if (!norma) return { ok: false, skipped: true, reason: "ordenamiento no detectado" };

  const hash = hashText(extracted.text);
  const previous = await prisma.normaVersion.findFirst({
    where: { normaId: norma.id, publishedAt: { lt: item.published } },
    orderBy: { publishedAt: "desc" },
  });

  const version = await prisma.normaVersion.upsert({
    where: { normaId_hash: { normaId: norma.id, hash } },
    update: { sourceItemId: item.id },
    create: {
      normaId: norma.id,
      publishedAt: item.published,
      hash,
      text: extracted.text,
      sourceItemId: item.id,
    },
  });

  const diff = diffLegalTexts(previous?.text || null, extracted.text);
  const savedDiff = await prisma.normaDiff.upsert({
    where: { toVersionId: version.id },
    update: {
      fromVersionId: previous?.id || null,
      changedArticles: diff.changedArticles as unknown as Prisma.InputJsonValue,
      summaryBullets: diff.summaryBullets as unknown as Prisma.InputJsonValue,
    },
    create: {
      fromVersionId: previous?.id || null,
      toVersionId: version.id,
      changedArticles: diff.changedArticles as unknown as Prisma.InputJsonValue,
      summaryBullets: diff.summaryBullets as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    skipped: false,
    normaId: norma.id,
    versionId: version.id,
    diffId: savedDiff.id,
    changedArticles: diff.changedArticles.length,
  };
}
