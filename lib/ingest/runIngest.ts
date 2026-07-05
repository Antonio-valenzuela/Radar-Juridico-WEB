import { prisma } from "@/lib/prisma";
import { getCheckpoint, updateCheckpoint } from "@/lib/ingest/checkpoints";
import { normalizeRawItem } from "@/lib/ingest/normalize";
import { saveDedupedItem } from "@/lib/ingest/dedupe";
import { parseSources, sourceRegistry } from "@/lib/sources";
import type { RawSourceItem, SourceName } from "@/lib/sources/types";
import { validateUrlSafety, safeFetch } from "@/lib/security/urlValidation";
import { cleanText, stripHtml } from "@/lib/ingest/normalize";
import { resolveIngestPolicy } from "@/lib/sources/ingestPolicy";
import { ingestDofWeb } from "@/lib/ingest/dofWeb";

export type RunIngestOptions = {
  sources?: Array<SourceName | string>;
  days?: number;
  limit?: number;
  includePriority2?: boolean;
};

export type IngestSourceRunResult = {
  source: SourceName | string;
  ok: boolean;
  found: number;
  saved: number;
  duplicates: number;
  errors: string[];
  warnings?: string[];
  checkpoint: string | null;
  sample: Array<{ title: string; url: string; published: string }>;
};

export type IngestAllResult = {
  ok: boolean;
  sources: Array<SourceName | string>;
  found: number;
  saved: number;
  duplicates: number;
  errors: number;
  results: IngestSourceRunResult[];
};

export function sourceNamesFromQuery(value?: string | null, includePriority2 = false) {
  return parseSources(value, includePriority2);
}

export async function fetchRawSourceItems(source: SourceName, opts: RunIngestOptions = {}) {
  const mod = sourceRegistry[source];
  const checkpoint = await getCheckpoint(source);
  return await mod.fetchItems({
    source,
    days: opts.days,
    limit: opts.limit,
    checkpoint,
  });
}

function parseRssXml(xmlText: string): Array<{ title: string; url: string; published: Date; summary: string }> {
  const items: Array<{ title: string; url: string; published: Date; summary: string }> = [];
  const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  
  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title>(<!\[CDATA\[)?([\s\S]*?)(]]>)?<\/title>/i);
    const linkMatch = itemXml.match(/<link>(<!\[CDATA\[)?([\s\S]*?)(]]>)?<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const descMatch = itemXml.match(/<description>(<!\[CDATA\[)?([\s\S]*?)(]]>)?<\/description>/i);
    
    const title = titleMatch ? cleanText(stripHtml(titleMatch[2] || titleMatch[0] || "")) : "";
    const link = linkMatch ? cleanText(stripHtml(linkMatch[2] || linkMatch[0] || "")) : "";
    const pubDateStr = pubDateMatch ? pubDateMatch[1] : "";
    const description = descMatch ? cleanText(stripHtml(descMatch[2] || descMatch[0] || "")) : "";
    
    if (title && link) {
      const published = pubDateStr ? new Date(pubDateStr) : new Date();
      items.push({
        title,
        url: link,
        published: isNaN(published.getTime()) ? new Date() : published,
        summary: description ? description.slice(0, 1000) : "",
      });
    }
  }
  return items;
}

function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? cleanText(stripHtml(match[1])) : "";
}

async function fetchRssItems(source: any, opts: any): Promise<{ found: number; items: any[]; errors: string[]; ok: boolean }> {
  const errors: string[] = [];
  const items: any[] = [];
  try {
    const res = await safeFetch(source.baseUrl);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }
    const xml = await res.text();
    const rssItems = parseRssXml(xml);
    
    const limitDate = opts.days
      ? new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)
      : null;
      
    for (const rss of rssItems) {
      if (limitDate && rss.published < limitDate) continue;
      items.push({
        source: source.slug.toUpperCase(),
        sourceId: rss.url,
        title: rss.title,
        url: rss.url,
        published: rss.published,
        summary: rss.summary,
        rawRef: rss.url,
        raw: { rss },
      });
    }
    
    return { ok: true, found: items.length, items, errors };
  } catch (error: any) {
    return { ok: false, found: 0, items: [], errors: [error.message] };
  }
}

async function fetchManualUrlItems(source: any, _opts: any): Promise<{ found: number; items: any[]; errors: string[]; ok: boolean }> {
  try {
    const res = await safeFetch(source.baseUrl);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }
    const html = await res.text();
    const title = extractTitleFromHtml(html) || source.name;
    const summary = stripHtml(html).slice(0, 1500);
    
    return {
      ok: true,
      found: 1,
      items: [{
        source: source.slug.toUpperCase(),
        sourceId: source.slug + "_manual",
        title,
        url: source.baseUrl,
        published: new Date(),
        summary,
        rawRef: source.baseUrl,
        raw: { html: summary },
      }],
      errors: [],
    };
  } catch (error: any) {
    return { ok: false, found: 0, items: [], errors: [error.message] };
  }
}

export async function getActiveOfficialSources() {
  return await prisma.officialSource.findMany({ where: { isActive: true } });
}

export async function runSourceIngest(
  source: SourceName | string,
  opts: RunIngestOptions = {}
): Promise<IngestSourceRunResult> {
  const startTime = Date.now();
  
  const dbSource = await prisma.officialSource.findFirst({
    where: {
      OR: [
        { slug: { equals: String(source), mode: "insensitive" } },
        { type: { equals: String(source), mode: "insensitive" } },
        { adapter: { equals: String(source), mode: "insensitive" } }
      ]
    }
  });

  const run = await prisma.ingestRun.create({
    data: { source: source as string, startedAt: new Date() },
  });

  let found = 0;
  let saved = 0;
  let duplicates = 0;
  const errors: string[] = [];
  const sample: IngestSourceRunResult["sample"] = [];

  const saveFetchLog = async (status: "success" | "failed", errCat: string | null) => {
    if (dbSource) {
      const duration = Date.now() - startTime;
      await prisma.officialSourceFetchLog.create({
        data: {
          sourceId: dbSource.id,
          status,
          foundItems: found,
          savedItems: saved,
          duplicateItems: duplicates,
          errorCategory: errCat,
          durationMs: duration
        }
      });

      await prisma.officialSource.update({
        where: { id: dbSource.id },
        data: {
          lastCheckedAt: new Date(),
          lastSuccessAt: status === "success" ? new Date() : undefined,
          lastFailureAt: status === "failed" ? new Date() : undefined,
          lastErrorCategory: errCat
        }
      });
    }
  };

  if (dbSource && !dbSource.isActive) {
    const msg = `La fuente ${source} está inactiva en la base de datos.`;
    errors.push(msg);
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: msg }
    });
    return { source, ok: false, found: 0, saved: 0, duplicates: 0, errors, checkpoint: null, sample };
  }

  try {
    let fetched: any;

    if (dbSource) {
      const safety = await validateUrlSafety(dbSource.baseUrl);
      if (!safety.safe) {
        const msg = `Fallo de seguridad SSRF al validar URL: ${safety.error}`;
        errors.push(msg);
        await prisma.ingestRun.update({
          where: { id: run.id },
          data: { finishedAt: new Date(), ok: false, error: msg }
        });
        await saveFetchLog("failed", "ssrf_blocked");
        return { source, ok: false, found: 0, saved: 0, duplicates: 0, errors, checkpoint: null, sample };
      }

      const ingestPolicy = resolveIngestPolicy(dbSource);
      if (ingestPolicy.handler === "warning") {
        await prisma.ingestRun.update({
          where: { id: run.id },
          data: { finishedAt: new Date(), ok: true, error: null, errorsCount: 0 }
        });
        await saveFetchLog("success", ingestPolicy.warningCode);
        return {
          source,
          ok: true,
          found: 0,
          saved: 0,
          duplicates: 0,
          errors: [],
          warnings: [ingestPolicy.message],
          checkpoint: null,
          sample,
        };
      }

      if (dbSource.crawlMode === "search_only") {
        const msg = "Esta fuente solo se usa para búsqueda externa/RAG, no para ingesta programada.";
        await prisma.ingestRun.update({
          where: { id: run.id },
          data: { finishedAt: new Date(), ok: false, error: msg }
        });
        await saveFetchLog("failed", "search_only_not_ingestable");
        return { source, ok: false, found: 0, saved: 0, duplicates: 0, errors: [msg], checkpoint: null, sample };
      } else if (ingestPolicy.handler === "registry") {
        const checkpoint = await getCheckpoint(ingestPolicy.registryKey);
        fetched = await sourceRegistry[ingestPolicy.registryKey].fetchItems({
          source: ingestPolicy.registryKey,
          days: opts.days,
          limit: opts.limit,
          checkpoint,
        });
      } else if (ingestPolicy.handler === "dof-web") {
        const dofResult = await ingestDofWeb();
        fetched = {
          ok: dofResult.ok,
          found: dofResult.found,
          items: [],
          errors: dofResult.ok ? [] : ["DOF Web respondió con error"],
          savedAlready: dofResult.saved,
          sampleAlready: dofResult.sample,
        };
      } else if (dbSource.crawlMode === "rss") {
        fetched = await fetchRssItems(dbSource, opts);
      } else if (dbSource.crawlMode === "manual_url") {
        fetched = await fetchManualUrlItems(dbSource, opts);
      } else {
        const nativeKey = Object.keys(sourceRegistry).find(
          (k) => k.toLowerCase() === dbSource.type.toLowerCase() || k.toLowerCase() === dbSource.slug.toLowerCase()
        ) as SourceName;

        if (nativeKey && sourceRegistry[nativeKey]) {
          const checkpoint = await getCheckpoint(nativeKey);
          fetched = await sourceRegistry[nativeKey].fetchItems({
            source: nativeKey,
            days: opts.days,
            limit: opts.limit,
            checkpoint,
          });
        } else {
          const msg = "Esta fuente está registrada, pero aún no tiene adaptador de ingesta.";
          errors.push(msg);
          await prisma.ingestRun.update({
            where: { id: run.id },
            data: { finishedAt: new Date(), ok: false, error: msg }
          });
          await saveFetchLog("failed", "unsupported_adapter");
          return { source, ok: false, found: 0, saved: 0, duplicates: 0, errors, checkpoint: null, sample };
        }
      }
    } else {
      const checkpoint = await getCheckpoint(source as SourceName);
      if (sourceRegistry[source as SourceName]) {
        fetched = await sourceRegistry[source as SourceName].fetchItems({
          source: source as SourceName,
          days: opts.days,
          limit: opts.limit,
          checkpoint,
        });
      } else {
        throw new Error(`Fuente no registrada: ${source}`);
      }
    }

    found = fetched.found;
    saved += fetched.savedAlready || 0;
    if (Array.isArray(fetched.sampleAlready)) {
      sample.push(...fetched.sampleAlready.slice(0, 5).map((item: { title: string; url: string }) => ({
        title: item.title,
        url: item.url,
        published: new Date().toISOString(),
      })));
    }
    errors.push(...fetched.errors);

    let newest = dbSource?.lastCheckedAt || null;
    for (const raw of fetched.items) {
      try {
        const normalized = normalizeRawItem(raw);
        const result = await saveDedupedItem(normalized);
        if (result.created) {
          saved++;
          if (sample.length < 5) {
            sample.push({
              title: normalized.title,
              url: normalized.url,
              published: normalized.published.toISOString(),
            });
          }
        } else {
          duplicates++;
        }
        if (!newest || normalized.published > newest) newest = normalized.published;
      } catch (error) {
        errors.push(
          `${raw.sourceId || raw.url}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const checkpointSource = dbSource ? (Object.keys(sourceRegistry).find(k => k.toLowerCase() === dbSource.type.toLowerCase() || k.toLowerCase() === dbSource.slug.toLowerCase()) || source) as SourceName : (source as SourceName);
    const updatedCheckpoint = await updateCheckpoint({
      source: checkpointSource,
      cursor: fetched.cursor ?? newest?.toISOString() ?? null,
      lastPublishedAt: newest instanceof Date ? newest : null,
    });

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: fetched.ok && errors.length === 0,
        itemsFound: found,
        itemsSaved: saved,
        duplicates,
        errorsCount: errors.length,
        error: errors.length ? errors.slice(0, 5).join(" | ") : null,
      },
    });

    await saveFetchLog(
      fetched.ok && errors.length === 0 ? "success" : "failed",
      errors.length ? "fetch_error" : null
    );

    logSourceResult({ source: source as SourceName, found, saved, duplicates, errors });

    return {
      source,
      ok: fetched.ok && errors.length === 0,
      found: saved === 0 && duplicates > 0 ? 0 : found,
      saved,
      duplicates,
      errors,
      checkpoint: updatedCheckpoint.lastPublishedAt?.toISOString() || updatedCheckpoint.cursor,
      sample,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: false,
        itemsFound: found,
        itemsSaved: saved,
        duplicates,
        errorsCount: errors.length,
        error: message,
      },
    });
    await saveFetchLog("failed", "runtime_error");
    logSourceResult({ source: source as SourceName, found, saved, duplicates, errors });
    return { source, ok: false, found, saved, duplicates, errors, checkpoint: null, sample };
  }
}

export async function runIngest(opts: RunIngestOptions = {}): Promise<IngestAllResult> {
  const sources = opts.sources?.length
    ? opts.sources
    : parseSources(null, opts.includePriority2 || false);

  const results: IngestSourceRunResult[] = [];
  for (const source of sources) {
    results.push(await runSourceIngest(source, opts));
  }

  return {
    ok: results.some((r) => r.ok),
    sources,
    found: results.reduce((sum, r) => sum + r.found, 0),
    saved: results.reduce((sum, r) => sum + r.saved, 0),
    duplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
    errors: results.reduce((sum, r) => sum + r.errors.length, 0),
    results,
  };
}

export async function getIngestStatus() {
  const [checkpoints, runs] = await Promise.all([
    prisma.ingestCheckpoint.findMany({ orderBy: { source: "asc" } }),
    prisma.ingestRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  const latestBySource = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestBySource.has(run.source)) latestBySource.set(run.source, run);
  }

  return {
    ok: true,
    checkpoints: checkpoints.map((c) => ({
      source: c.source,
      cursor: c.cursor,
      lastPublishedAt: c.lastPublishedAt?.toISOString() || null,
      updatedAt: c.updatedAt.toISOString(),
    })),
    latestRuns: Array.from(latestBySource.values()).map((run) => ({
      id: run.id,
      source: run.source,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() || null,
      ok: run.ok,
      found: run.itemsFound,
      saved: run.itemsSaved,
      duplicates: run.duplicates,
      errors: run.errorsCount,
      error: run.error,
    })),
  };
}

export function serializeRawItems(items: RawSourceItem[]) {
  return items.map((item) => ({
    ...item,
    published: item.published.toISOString(),
  }));
}

function logSourceResult(result: {
  source: SourceName;
  found: number;
  saved: number;
  duplicates: number;
  errors: string[];
}) {
  console.log(
    JSON.stringify({
      event: "ingest.source.done",
      source: result.source,
      found: result.found,
      saved: result.saved,
      duplicates: result.duplicates,
      errors: result.errors.length,
      ok: result.errors.length === 0,
    })
  );
}
