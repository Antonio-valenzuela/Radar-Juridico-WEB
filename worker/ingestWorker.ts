/**
 * worker/ingestWorker.ts
 * Multi-source monitoring worker with retry, structured logging, and scheduling.
 */

import IORedis from "ioredis";
import { Worker, Queue } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

// Prisma singleton for worker process
const prisma = new PrismaClient();

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const ingestQueue = new Queue("ingest", { connection });

// ─── Structured Logger ───

function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, any>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── Text Processing ───

function normalizeText(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .split("\n").map(l => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(br|p|div|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function computeHash(text: string): string {
  return createHash("sha256").update(normalizeText(text), "utf8").digest("hex");
}

// ─── Legal Keywords ───

const LEGAL_KEYWORDS = [
  "reforma", "reforman", "deroga", "adiciona", "modifica",
  "sustituye", "transitorio", "abroga", "expide",
];

function detectKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return LEGAL_KEYWORDS.filter(kw => lower.includes(kw));
}

function classifyImpact(text: string, changeSize: number): string {
  const lower = text.toLowerCase();
  const highKw = ["reforma constitucional", "nueva ley", "se expide", "abrogación"];
  if (highKw.some(k => lower.includes(k)) || changeSize > 20) return "alto";

  const medKw = ["reforma", "adiciona", "deroga", "modificación"];
  if (medKw.some(k => lower.includes(k)) || changeSize > 5) return "medio";

  return "bajo";
}

function classifyChangeType(hasOld: boolean, hasNew: boolean, keywords: string[]): string {
  if (!hasOld && hasNew) return "nuevo";
  if (hasOld && !hasNew) return "eliminacion";
  if (keywords.some(k => ["reforma", "reforman", "deroga", "adiciona", "modifica"].includes(k))) {
    return "reforma";
  }
  return "modificacion_menor";
}

// ─── Fetch with Retry ───

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string | null> {
  const delays = [5000, 15000, 30000];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JuridicoRadar/2.0)",
          Accept: "text/html, application/json, */*",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.text();
    } catch (err: any) {
      log("warn", `Fetch attempt ${attempt + 1}/${maxRetries} failed`, {
        url, error: err.message,
      });

      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delays[attempt]));
      }
    }
  }

  return null;
}

// ─── Source Processing ───

async function processSource(source: { id: string; nombre: string; url: string; metodo_extraccion: string }) {
  log("info", `Processing source: ${source.nombre}`, { sourceId: source.id });

  const content = await fetchWithRetry(source.url);

  if (!content) {
    log("error", `Failed to fetch source after retries`, { sourceId: source.id });

    await prisma.source.update({
      where: { id: source.id },
      data: {
        error_count: { increment: 1 },
        last_error: "Failed to fetch after 3 retries",
        ultima_revision: new Date(),
      },
    });
    return { ok: false, sourceId: source.id };
  }

  // Extract text based on method
  let plainText: string;
  if (source.metodo_extraccion === "html") {
    plainText = normalizeText(stripHtml(content));
  } else {
    plainText = normalizeText(content);
  }

  const newHash = computeHash(plainText);

  // Find or create document for this source URL
  let doc = await prisma.document.findUnique({ where: { url: source.url } });

  if (!doc) {
    // New document — create it
    doc = await prisma.document.create({
      data: {
        sourceId: source.id,
        titulo: source.nombre,
        url: source.url,
        contenido_actual: plainText.slice(0, 50000),
        hash_actual: newHash,
        fecha_publicacion: new Date(),
        impacto: "bajo",
      },
    });

    // Create initial version
    await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        contenido: plainText.slice(0, 50000),
        hash: newHash,
        tipo_cambio: "nuevo",
      },
    });

    // Notification
    await prisma.notification.create({
      data: {
        documentId: doc.id,
        tipo: "nueva_publicacion",
        descripcion: `Nueva publicación detectada: ${source.nombre}`,
      },
    });

    log("info", `New document created`, { sourceId: source.id, docId: doc.id });

    // Reset error count on success
    await prisma.source.update({
      where: { id: source.id },
      data: { error_count: 0, last_error: null, ultima_revision: new Date() },
    });

    return { ok: true, sourceId: source.id, action: "created", docId: doc.id };
  }

  // Existing document — compare hashes
  if (doc.hash_actual === newHash) {
    log("info", `No changes detected`, { sourceId: source.id, docId: doc.id });

    await prisma.source.update({
      where: { id: source.id },
      data: { error_count: 0, last_error: null, ultima_revision: new Date() },
    });

    return { ok: true, sourceId: source.id, action: "unchanged", docId: doc.id };
  }

  // Content changed! Save previous version and create new one
  log("info", `Change detected!`, { sourceId: source.id, docId: doc.id });

  const oldContent = doc.contenido_actual || "";
  const keywords = detectKeywords(plainText);
  const changeType = classifyChangeType(!!oldContent, true, keywords);
  const impact = classifyImpact(plainText, keywords.length);

  // Create new version
  const version = await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      contenido: plainText.slice(0, 50000),
      hash: newHash,
      tipo_cambio: changeType,
    },
  });

  // Create change record with diff details
  await prisma.change.create({
    data: {
      documentVersionId: version.id,
      texto_anterior: oldContent.slice(0, 20000),
      texto_nuevo: plainText.slice(0, 20000),
      tipo_diferencia: changeType === "nuevo" ? "agregado" : "articulo_modificado",
      palabras_clave_detectadas: keywords.join(", ") || null,
    },
  });

  // Update document with new content
  await prisma.document.update({
    where: { id: doc.id },
    data: {
      contenido_actual: plainText.slice(0, 50000),
      hash_actual: newHash,
      impacto: impact,
      updatedAt: new Date(),
    },
  });

  // Create notification
  await prisma.notification.create({
    data: {
      documentId: doc.id,
      tipo: "cambio_detectado",
      descripcion: `Cambio detectado en ${source.nombre}: ${changeType}. Keywords: ${keywords.join(", ") || "ninguna"}`,
    },
  });

  // Reset error count on success
  await prisma.source.update({
    where: { id: source.id },
    data: { error_count: 0, last_error: null, ultima_revision: new Date() },
  });

  return { ok: true, sourceId: source.id, action: "changed", docId: doc.id, changeType };
}

// ─── Worker ───

const worker = new Worker(
  "ingest",
  async (job) => {
    log("info", `Job received: ${job.name}`, { jobId: job.id });

    switch (job.name) {
      case "scan-all": {
        const sources = await prisma.source.findMany({
          where: { activo: true },
        });

        log("info", `Scanning ${sources.length} active sources`);

        const results = [];
        for (const source of sources) {
          try {
            const result = await processSource(source);
            results.push(result);
          } catch (err: any) {
            log("error", `Source processing failed`, {
              sourceId: source.id,
              error: err.message,
            });
            results.push({ ok: false, sourceId: source.id, error: err.message });
          }

          // Throttle between sources
          await new Promise(r => setTimeout(r, 2000));
        }

        return { ok: true, scanned: sources.length, results };
      }

      case "scan-source": {
        const sourceId = job.data?.sourceId;
        if (!sourceId) return { ok: false, error: "sourceId required" };

        const source = await prisma.source.findUnique({ where: { id: sourceId } });
        if (!source) return { ok: false, error: "Source not found" };

        return await processSource(source);
      }

      // Legacy jobs (backward compatibility)
      case "sidof-today":
      case "sidof-week":
      case "scjn-today":
      case "dof-web-today": {
        log("info", `Legacy job: ${job.name} — running scan-all instead`);
        const sources = await prisma.source.findMany({ where: { activo: true } });
        const results = [];
        for (const source of sources) {
          try {
            results.push(await processSource(source));
          } catch (err: any) {
            results.push({ ok: false, sourceId: source.id, error: err.message });
          }
          await new Promise(r => setTimeout(r, 2000));
        }
        return { ok: true, scanned: sources.length, results };
      }

      default:
        log("warn", `Unknown job: ${job.name}`);
        return { ok: false, error: `Unknown job: ${job.name}` };
    }
  },
  {
    connection,
    concurrency: 1,
    limiter: { max: 1, duration: 5000 },
  }
);

worker.on("completed", (job) => {
  log("info", `Job completed: ${job.name}`, { jobId: job.id });
});

worker.on("failed", (job, err) => {
  log("error", `Job failed: ${job?.name}`, { jobId: job?.id, error: err.message });
});

// ─── Setup Repeatable Jobs (Cron) ───

async function setupSchedule() {
  // Clean old repeatable jobs
  const existing = await ingestQueue.getRepeatableJobs();
  for (const job of existing) {
    await ingestQueue.removeRepeatableByKey(job.key);
  }

  // Schedule scan-all every 30 minutes
  await ingestQueue.add("scan-all", {}, {
    repeat: { every: 30 * 60 * 1000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  });

  log("info", "Scheduled repeatable job: scan-all every 30 minutes");
}

setupSchedule().catch((err) => {
  log("error", "Failed to setup schedule", { error: err.message });
});

log("info", "⚡ Worker v2 running — multi-source monitoring active");

// ─── Graceful Shutdown ───

async function shutdown() {
  log("info", "Shutting down worker...");
  await worker.close();
  await prisma.$disconnect();
  connection.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
