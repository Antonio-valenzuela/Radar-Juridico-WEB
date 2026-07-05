import { prisma } from "@/lib/prisma";
import { hybridSearch } from "@/lib/search/hybridSearch";
import { generateLlmCompletion } from "@/lib/ai-provider";
import { cacheConnection } from "@/lib/cacheConnection";

// Local timeout helper for Redis commands
function withRedisTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Redis Timeout")), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise
  ]).catch(() => fallback);
}

// Allowed official domains
export const ALLOWED_DOMAINS = [
  "dof.gob.mx",
  "sidof.segob.gob.mx",
  "scjn.gob.mx",
  "cjf.gob.mx",
  "diputados.gob.mx",
  "senado.gob.mx",
  "conamer.gob.mx"
];

// Helper to validate official domains
export function isOfficialDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith("." + domain));
  } catch {
    return false;
  }
}

// Helpers to identify source/type from URL
export function getSourceFromUrl(url: string): string {
  if (url.includes("dof.gob.mx") || url.includes("sidof.segob.gob.mx")) return "Diario Oficial de la Federación";
  if (url.includes("scjn.gob.mx")) return "Suprema Corte de Justicia";
  if (url.includes("cjf.gob.mx")) return "Consejo de la Judicatura";
  if (url.includes("diputados.gob.mx")) return "Cámara de Diputados";
  if (url.includes("senado.gob.mx")) return "Senado de la República";
  if (url.includes("conamer.gob.mx")) return "CONAMER";
  return "Fuente Oficial";
}

export function getTypeFromUrl(url: string): string {
  if (url.includes("leyes") || url.includes("LeyesBiblio")) return "ley";
  if (url.includes("jurisprudencia") || url.includes("sjf")) return "jurisprudencia";
  if (url.includes("decreto")) return "decreto";
  return "publicación oficial";
}

// Helper to count word occurrences and find a text snippet
export function findExcerptAndMatches(text: string, term: string): { excerpt: string; matches: number } {
  if (!text || !term) return { excerpt: "", matches: 0 };
  const regex = new RegExp(term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
  const matches = (text.match(regex) || []).length;
  
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) {
    return { excerpt: text.slice(0, 150) + "...", matches };
  }
  
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + term.length + 60);
  let excerpt = text.slice(start, end);
  if (start > 0) excerpt = "..." + excerpt;
  if (end < text.length) excerpt = excerpt + "...";
  
  return { excerpt, matches };
}

// Increment Redis attempts tracker
export async function getAndIncrementAttempts(): Promise<{ limit: number, used: number, remaining: number }> {
  const limit = 20;
  let used = 3;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const redisKey = `rag:attempts:${todayStr}`;
    
    // Wrap connection.incr in a 1.5s timeout
    const val = await withRedisTimeout(cacheConnection.incr(redisKey), 1500, null);
    
    if (val === null) {
      throw new Error("Redis command failed or timed out");
    }

    if (val === 1) {
      await withRedisTimeout(cacheConnection.expire(redisKey, 86400), 1000, null);
    }
    used = Number(val);
  } catch (err) {
    const globalVal = (globalThis as any);
    globalVal.ragAttemptsMemory ??= 2;
    globalVal.ragAttemptsMemory++;
    used = globalVal.ragAttemptsMemory;
  }
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining };
}

// Read Redis attempts tracker without incrementing
export async function getAttemptsWithoutIncrementing(): Promise<{ limit: number, used: number, remaining: number }> {
  const limit = 20;
  let used = 0;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const redisKey = `rag:attempts:${todayStr}`;
    
    // Wrap connection.get in a 1.5s timeout
    const val = await withRedisTimeout(cacheConnection.get(redisKey), 1500, null);
    
    used = val ? Number(val) : 0;
  } catch (err) {
    const globalVal = (globalThis as any);
    used = globalVal.ragAttemptsMemory || 0;
  }
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining };
}

// Format date as DD-MM-YYYY for SIDOF API
export function toSidofDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
