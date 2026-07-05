const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 2;

export const DEFAULT_HEADERS = {
  "User-Agent":
    "JuridicoRadar/1.0 (+https://github.com/juridico-radar; contacto: responsable scraping legal)",
  Accept: "text/html,application/json,text/plain,*/*",
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = init.retries ?? DEFAULT_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { response: res } = await fetchOfficialUrl(url, {
        ...init,
        cache: "no-store",
        headers: { ...DEFAULT_HEADERS, ...(init.headers || {}) },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok || res.status < 500 || attempt === retries) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === retries) break;
    }

    await sleep(400 * Math.pow(2, attempt));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchText(url: string, init?: RequestInit) {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return await res.text();
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 160).replace(/\s+/g, " ");
    if (/^\s*</.test(text) || contentType.includes("text/html")) {
      throw new Error(`El proveedor devolvió HTML en vez de JSON para ${url}. Puede tratarse de cambio de endpoint, bloqueo o mantenimiento del portal. Preview: ${preview}`);
    }
    throw new Error(`El proveedor no devolvió JSON válido para ${url}. Content-Type: ${contentType || "desconocido"}. Preview: ${preview}`);
  }
}
import { fetchOfficialUrl } from "@/lib/sources/officialFetch";
