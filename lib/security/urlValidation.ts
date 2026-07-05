import dns from "dns";
import { isIP } from "node:net";
import { promisify } from "util";
import { fetchOfficialUrl } from "@/lib/sources/officialFetch";
import { INGEST_FETCH_MS } from "@/lib/config/timeouts";

const lookup = promisify(dns.lookup);

export type UrlValidationResult =
  | { ok: true; url: string; parsed: URL }
  | { ok: false; reason: string };

const FORBIDDEN_PORTS = [
  // Base de datos
  3306,  // MySQL
  5432,  // PostgreSQL
  27017, // MongoDB
  6379,  // Redis
  
  // Servicios internos
  8080, 8081, 8443,
  9000, 9090,
  
  // Administración
  27, 23, 25, // Telnet, SMTP sin autenticación
];

const FORBIDDEN_HOSTS = [
  'localhost',
  '127.0.0.1',
  '[::1]',
  '0.0.0.0',
];

const PRIVATE_IP_RANGES = [
  { min: '10.0.0.0', max: '10.255.255.255' },        // 10.0.0.0/8
  { min: '172.16.0.0', max: '172.31.255.255' },      // 172.16.0.0/12
  { min: '192.168.0.0', max: '192.168.255.255' },    // 192.168.0.0/16
  { min: '169.254.0.0', max: '169.254.255.255' },    // Link-local (169.254.x.x)
  { min: '127.0.0.0', max: '127.255.255.255' },      // Loopback
];

const CLOUD_METADATA_IPS = [
  '169.254.169.254', // AWS metadata
];

const MANUAL_BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
]);

function isManualPrivateIpv4(host: string) {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isManualPrivateIpv6(host: string) {
  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function validatePublicHttpUrl(rawUrl: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    return { ok: false, reason: "URL inválida" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, reason: "protocolo no permitido; usa http o https" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URL con credenciales no permitida" };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname) return { ok: false, reason: "host vacío" };
  if (MANUAL_BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
    return { ok: false, reason: "host localhost o metadata cloud bloqueado" };
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isManualPrivateIpv4(hostname)) {
    return { ok: false, reason: "IP privada o reservada bloqueada" };
  }
  if (ipVersion === 6 && isManualPrivateIpv6(hostname)) {
    return { ok: false, reason: "IP privada o loopback bloqueada" };
  }

  parsed.hostname = hostname;
  return { ok: true, url: parsed.toString(), parsed };
}

export function validateRedirectTarget(currentUrl: string, location: string | null): UrlValidationResult {
  if (!location) return { ok: false, reason: "redirect sin Location" };
  try {
    const next = new URL(location, currentUrl);
    return validatePublicHttpUrl(next.toString());
  } catch {
    return { ok: false, reason: "redirect inválido" };
  }
}

export async function validateUrlSecurity(urlString: string): Promise<{
  valid: boolean;
  error?: string;
  timeout?: number;
}> {
  try {
    const url = new URL(urlString);

    // 1. Validar protocolo
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Solo HTTP/HTTPS permitidos' };
    }

    // 2. Validar hostname
    const hostname = url.hostname;
    if (FORBIDDEN_HOSTS.includes(hostname.toLowerCase())) {
      return { valid: false, error: 'Host prohibido (localhost)' };
    }

    // 3. Validar puerto
    const port = parseInt(url.port || (url.protocol === 'https:' ? '443' : '80'));
    if (FORBIDDEN_PORTS.includes(port)) {
      return { valid: false, error: `Puerto prohibido: ${port}` };
    }

    // 4. Validar IPs privadas / metadata cloud
    if (CLOUD_METADATA_IPS.includes(hostname)) {
      return { valid: false, error: 'Acceso a metadata cloud prohibido' };
    }

    // 5. Resolver DNS y validar IP resultante
    try {
      const addresses = await dns.promises.resolve4(hostname);
      for (const ip of addresses) {
        if (isPrivateIP(ip)) {
          return { valid: false, error: `IP privada detectada: ${ip}` };
        }
      }
    } catch (e) {
      return { valid: false, error: 'No se pudo resolver hostname' };
    }

    // 6. Timeout máximo de 30 segundos (por variable de entorno)
    return {
      valid: true,
      timeout: parseInt(process.env.CRAWLER_TIMEOUT_MS || '30000'),
    };
  } catch (e) {
    return { valid: false, error: 'URL inválida' };
  }
}

export function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;

  for (const range of PRIVATE_IP_RANGES) {
    const minParts = range.min.split('.').map(Number);
    const maxParts = range.max.split('.').map(Number);
    
    let inRange = true;
    for (let i = 0; i < 4; i++) {
      if (parts[i] < minParts[i] || parts[i] > maxParts[i]) {
        inRange = false;
        break;
      }
    }
    if (inRange) return true;
  }
  return false;
}

export function normalizeUserAgent(): string {
  return 'JuridicoRadar/1.0 (Regulatoria; +https://juridico-radar.app)';
}

function isPrivateIp(ip: string): boolean {
  // IPv4 loopback, broadcast, private, link-local, testnet
  if (/^(10\.|192\.168\.|127\.|169\.254\.|0\.)/.test(ip)) {
    return true;
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);
    if (first === 172 && second >= 16 && second <= 31) {
      return true;
    }
  }

  // IPv6 loopback, unique local, link-local, private
  const ipLower = ip.toLowerCase().trim();
  if (
    ipLower === "::1" ||
    ipLower.startsWith("fe80:") ||
    ipLower.startsWith("fc00:") ||
    ipLower.startsWith("fd00:")
  ) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (ipLower.startsWith("::ffff:")) {
    const mappedIpv4 = ipLower.replace("::ffff:", "");
    return isPrivateIp(mappedIpv4);
  }

  return false;
}

export async function validateUrlSafety(urlStr: string): Promise<{ safe: boolean; error?: string; ip?: string }> {
  try {
    const parsed = new URL(urlStr);
    
    // Protocol checks
    if (parsed.protocol !== "https:") {
      const isDev = process.env.NODE_ENV !== "production";
      const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (isDev && parsed.protocol === "http:" && isLocal) {
        // Allow in development
        return { safe: true, ip: "127.0.0.1" };
      }
      return { safe: false, error: "El protocolo debe ser HTTPS" };
    }

    // Hostname checks
    const hostname = parsed.hostname.toLowerCase();
    if (["localhost", "0.0.0.0", "127.0.0.1", "169.254.169.254"].includes(hostname)) {
      return { safe: false, error: "Dominio/dirección IP privada o local no permitida" };
    }

    // DNS Lookup
    const result = await lookup(parsed.hostname).catch((err) => {
      throw new Error(`Error en resolución DNS: ${err.message}`);
    });

    const ip = result.address;
    if (isPrivateIp(ip)) {
      return { safe: false, error: `La dirección IP resuelta (${ip}) es privada o local` };
    }

    return { safe: true, ip };
  } catch (err: any) {
    return { safe: false, error: err.message || "URL inválida" };
  }
}

/**
 * Perform a safe fetch with SSRF mitigation.
 * Limits response size, redirects, and sets a custom timeout.
 * Bypasses unauthorized TLS certificates locally to support Mexican government websites.
 */
export async function safeFetch(urlStr: string, options: RequestInit = {}): Promise<Response> {
  const safety = await validateUrlSafety(urlStr);
  if (!safety.safe) {
    throw new Error(`Intento SSRF bloqueado: ${safety.error}`);
  }

  const timeoutMs = INGEST_FETCH_MS; // Use configured fetch timeout
  const maxBytes = 5 * 1024 * 1024; // 5MB limit
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { response } = await fetchOfficialUrl(urlStr, {
      ...options,
      signal: controller.signal,
      redirect: "manual", // handle redirects manually to enforce validation on each step
    });

    clearTimeout(id);

    // Enforce redirect limits (max 3)
    let currentResponse = response;
    let redirectCount = 0;
    let currentUrl = urlStr;
    
    while ([301, 302, 307, 308].includes(currentResponse.status) && redirectCount < 3) {
      const location = currentResponse.headers.get("location");
      if (!location) break;

      // Resolve relative redirect URL
      const redirectUrl = new URL(location, currentUrl).toString();
      
      // Validate the redirected URL safety
      const redirectSafety = await validateUrlSafety(redirectUrl);
      if (!redirectSafety.safe) {
        throw new Error(`Redirección SSRF bloqueada: ${redirectSafety.error}`);
      }

      redirectCount++;
      currentUrl = redirectUrl;
      const redirectId = setTimeout(() => controller.abort(), timeoutMs);
      
      const redirected = await fetchOfficialUrl(redirectUrl, {
        ...options,
        signal: controller.signal,
        redirect: "manual",
      });
      currentResponse = redirected.response;
      clearTimeout(redirectId);
    }

    if (redirectCount >= 3) {
      throw new Error("Demasiadas redirecciones (límite 3)");
    }

    // Limit response size
    const contentLength = currentResponse.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      throw new Error("El tamaño de la respuesta excede el límite de 5MB");
    }

    // Wrap the response text method to check size on actual download
    const originalText = currentResponse.text.bind(currentResponse);
    currentResponse.text = async () => {
      const text = await originalText();
      if (Buffer.byteLength(text, "utf8") > maxBytes) {
        throw new Error("El tamaño de la respuesta descargada excede el límite de 5MB");
      }
      return text;
    };

    return currentResponse;
  } catch (err: any) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Validates, tests and diagnoses an official source connection based on its crawlMode.
 */
export async function testOfficialSourceConnection(source: { baseUrl: string; name: string; crawlMode: string }): Promise<any> {
  const startTime = Date.now();
  const diagnostic = {
    dnsResolved: false,
    ssrfPassed: false,
    redirectsFollowed: 0,
    blockedReason: null as string | null
  };

  try {
    // 1. SSRF check before requesting
    const safety = await validateUrlSafety(source.baseUrl);
    diagnostic.dnsResolved = safety.safe || safety.error?.includes("IP") === false;
    diagnostic.ssrfPassed = safety.safe;
    
    if (!safety.safe) {
      return {
        ok: false,
        status: null,
        durationMs: Date.now() - startTime,
        errorCategory: "blocked_by_ssrf",
        message: `Bloqueado por políticas SSRF: ${safety.error}`,
        technicalHint: safety.error || "SSRF validation failed",
        safeDetails: { hostname: new URL(source.baseUrl).hostname, methodAttempted: "HEAD/GET" },
        diagnostic
      };
    }

    // 2. Hostname details
    const parsed = new URL(source.baseUrl);
    const hostname = parsed.hostname;

    // 3. Special handling for search_only
    if (source.crawlMode === "search_only") {
      return {
        ok: true,
        status: 200,
        finalUrl: source.baseUrl,
        contentType: "text/html",
        durationMs: Date.now() - startTime,
        methodUsed: "NONE",
        message: "Fuente válida para búsqueda externa restringida; no se ingesta automáticamente.",
        safeDetails: { hostname, methodAttempted: "NONE" },
        diagnostic: { ...diagnostic, dnsResolved: true, ssrfPassed: true }
      };
    }

    const timeoutMs = 8000;
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    let methodUsed = "HEAD";
    let response: Response;

    const headers = {
      "User-Agent": "JuridicoRadarBot/1.0 (+admin-configured-source-test)",
      "Accept": "*/*"
    };

    const originalReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    try {
      // 1. Try HEAD request
      response = await fetch(source.baseUrl, {
        method: "HEAD",
        headers,
        signal: controller.signal,
        redirect: "manual"
      });

      // If HEAD returns error status, retry with GET
      if (!response.ok || [405, 403, 400].includes(response.status)) {
        methodUsed = "GET";
        const getController = new AbortController();
        const getTimer = setTimeout(() => getController.abort(), timeoutMs);
        response = await fetch(source.baseUrl, {
          method: "GET",
          headers,
          signal: getController.signal,
          redirect: "manual"
        });
        clearTimeout(getTimer);
      }
    } catch (fetchErr: any) {
      // If HEAD fails due to network/method, retry with GET
      try {
        methodUsed = "GET";
        const getController = new AbortController();
        const getTimer = setTimeout(() => getController.abort(), timeoutMs);
        response = await fetch(source.baseUrl, {
          method: "GET",
          headers,
          signal: getController.signal,
          redirect: "manual"
        });
        clearTimeout(getTimer);
      } catch (getErr: any) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
        clearTimeout(timerId);

        let errorCategory = "network_error";
        let techHint = getErr.message || String(getErr);
        if (getErr.name === "AbortError" || getErr.message?.includes("timeout") || getErr.message?.includes("aborted")) {
          errorCategory = "timeout";
        } else if (getErr.message?.includes("cert") || getErr.message?.includes("TLS") || getErr.message?.includes("signature") || getErr.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
          errorCategory = "tls_error";
        } else if (getErr.message?.includes("ENOTFOUND") || getErr.message?.includes("dns")) {
          errorCategory = "dns_error";
        }

        return {
          ok: false,
          status: null,
          durationMs: Date.now() - startTime,
          errorCategory,
          message: "No se pudo conectar con la fuente oficial.",
          technicalHint: techHint,
          safeDetails: { hostname, methodAttempted: "GET" },
          diagnostic
        };
      }
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
    clearTimeout(timerId);

    // Follow redirects manually with SSRF checks
    let currentResponse = response;
    let redirectCount = 0;
    let currentUrl = source.baseUrl;

    while ([301, 302, 307, 308].includes(currentResponse.status) && redirectCount < 3) {
      const location = currentResponse.headers.get("location");
      if (!location) break;

      const redirectUrl = new URL(location, currentUrl).toString();
      const redirectSafety = await validateUrlSafety(redirectUrl);
      if (!redirectSafety.safe) {
        return {
          ok: false,
          status: currentResponse.status,
          durationMs: Date.now() - startTime,
          errorCategory: "blocked_by_ssrf",
          message: `Redirección bloqueada por políticas SSRF: ${redirectSafety.error}`,
          technicalHint: redirectSafety.error,
          safeDetails: { hostname: new URL(redirectUrl).hostname, methodAttempted: methodUsed },
          diagnostic: { ...diagnostic, redirectsFollowed: redirectCount }
        };
      }

      redirectCount++;
      currentUrl = redirectUrl;

      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      const redirectController = new AbortController();
      const redirectTimer = setTimeout(() => redirectController.abort(), timeoutMs);

      try {
        currentResponse = await fetch(redirectUrl, {
          method: "GET",
          headers,
          signal: redirectController.signal,
          redirect: "manual"
        });
      } catch (err: any) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
        clearTimeout(redirectTimer);
        return {
          ok: false,
          status: null,
          durationMs: Date.now() - startTime,
          errorCategory: err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ? "tls_error" : "network_error",
          message: `Error al conectar con la redirección: ${currentUrl}`,
          technicalHint: err.message,
          safeDetails: { hostname: new URL(currentUrl).hostname, methodAttempted: "GET" },
          diagnostic: { ...diagnostic, redirectsFollowed: redirectCount }
        };
      }

      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
      clearTimeout(redirectTimer);
    }

    diagnostic.redirectsFollowed = redirectCount;

    if (redirectCount >= 3) {
      return {
        ok: false,
        status: currentResponse.status,
        durationMs: Date.now() - startTime,
        errorCategory: "timeout",
        message: "Demasiadas redirecciones (límite 3)",
        technicalHint: "Max redirects reached",
        safeDetails: { hostname: new URL(currentUrl).hostname, methodAttempted: methodUsed },
        diagnostic
      };
    }

    // Check status
    if (!currentResponse.ok) {
      return {
        ok: false,
        status: currentResponse.status,
        durationMs: Date.now() - startTime,
        errorCategory: currentResponse.status === 403 || currentResponse.status === 401 ? "forbidden" : "bad_status",
        message: `La fuente respondió con estatus de error: ${currentResponse.status} ${currentResponse.statusText}`,
        technicalHint: `HTTP Status ${currentResponse.status}`,
        safeDetails: { hostname: new URL(currentUrl).hostname, methodAttempted: methodUsed },
        diagnostic
      };
    }

    const contentType = currentResponse.headers.get("content-type") || "";

    // Validate crawlMode match
    if (source.crawlMode === "rss" && !contentType.includes("xml") && !contentType.includes("rss") && !contentType.includes("atom")) {
      return {
        ok: false,
        status: currentResponse.status,
        durationMs: Date.now() - startTime,
        errorCategory: "unsupported_crawl_mode",
        message: `El tipo de contenido (${contentType}) no corresponde a un feed XML/RSS válido.`,
        technicalHint: `Expected XML/RSS, got ${contentType}`,
        safeDetails: { hostname: new URL(currentUrl).hostname, methodAttempted: methodUsed },
        diagnostic
      };
    }

    // Warn if manual_url is set with homepage URL
    if (source.crawlMode === "manual_url" && (parsed.pathname === "/" || parsed.pathname === "")) {
      return {
        ok: true,
        status: currentResponse.status,
        finalUrl: currentUrl,
        contentType,
        durationMs: Date.now() - startTime,
        methodUsed,
        message: "Conexión exitosa. Advertencia: Se configuró como 'manual_url' pero apunta a una página de inicio (homepage) en lugar de una publicación específica.",
        safeDetails: { hostname: new URL(currentUrl).hostname, methodAttempted: methodUsed },
        diagnostic
      };
    }

    return {
      ok: true,
      status: currentResponse.status,
      finalUrl: currentUrl,
      contentType,
      durationMs: Date.now() - startTime,
      methodUsed,
      message: `Conexión exitosa a '${source.name}' (${currentResponse.status} ${currentResponse.statusText}) en ${Date.now() - startTime}ms.`,
      safeDetails: { hostname: new URL(currentUrl).hostname, methodAttempted: methodUsed },
      diagnostic
    };

  } catch (err: any) {
    return {
      ok: false,
      status: null,
      durationMs: Date.now() - startTime,
      errorCategory: "network_error",
      message: "Error interno al probar la conexión.",
      technicalHint: err.message || String(err),
      safeDetails: { hostname: new URL(source.baseUrl).hostname, methodAttempted: "GET" },
      diagnostic
    };
  }
}
