import { splitLegalText, type ArticleBlock } from "@/lib/normas/articles";

export type ArticleChange = {
  articleId: string;
  title: string;
  changeType: "added" | "removed" | "modified";
  beforePreview: string | null;
  afterPreview: string | null;
};

export function diffLegalTexts(fromText: string | null, toText: string) {
  const before = fromText ? splitLegalText(fromText) : [];
  const after = splitLegalText(toText);
  const beforeMap = new Map(before.map((block) => [block.id, block]));
  const afterMap = new Map(after.map((block) => [block.id, block]));
  const changed: ArticleChange[] = [];

  for (const block of after) {
    const prev = beforeMap.get(block.id);
    if (!prev) {
      changed.push(toChange(block, null, "added"));
      continue;
    }
    if (similarityFingerprint(prev.text) !== similarityFingerprint(block.text)) {
      changed.push(toChange(block, prev, "modified"));
    }
  }

  for (const block of before) {
    if (!afterMap.has(block.id)) changed.push(toChange(block, block, "removed"));
  }

  const summaryBullets = summarizeChanges(changed);
  return { changedArticles: changed, summaryBullets };
}

function toChange(after: ArticleBlock, before: ArticleBlock | null, changeType: ArticleChange["changeType"]): ArticleChange {
  return {
    articleId: after.id,
    title: after.title,
    changeType,
    beforePreview: before ? preview(before.text) : null,
    afterPreview: changeType === "removed" ? null : preview(after.text),
  };
}

function preview(text: string) {
  return text.length > 420 ? `${text.slice(0, 420)}...` : text;
}

function similarityFingerprint(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function summarizeChanges(changed: ArticleChange[]) {
  if (changed.length === 0) return ["No se detectaron cambios por articulo en el texto extraido."];

  const added = changed.filter((c) => c.changeType === "added").length;
  const modified = changed.filter((c) => c.changeType === "modified").length;
  const removed = changed.filter((c) => c.changeType === "removed").length;
  const bullets: string[] = [];

  if (modified) bullets.push(`Se modificaron ${modified} articulo(s).`);
  if (added) bullets.push(`Se agregaron ${added} articulo(s) o secciones.`);
  if (removed) bullets.push(`Se eliminaron ${removed} articulo(s) o secciones.`);

  const sample = changed.slice(0, 3).map((c) => c.title).join(", ");
  if (sample) bullets.push(`Primeros articulos afectados: ${sample}.`);
  return bullets.slice(0, 5);
}
