import { Agent } from "undici";

type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type OfficialFetchDependencies = {
  fetch?: FetchFunction;
  relaxedFetch?: FetchFunction;
};

const TLS_FALLBACK_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
]);

const TLS_FALLBACK_HOSTS = new Set([
  "dof.gob.mx",
  "www.dof.gob.mx",
  "diputados.gob.mx",
  "www.diputados.gob.mx",
  "sidof.segob.gob.mx",
  "legislacion.scjn.gob.mx",
  "sjf2.scjn.gob.mx",
]);

const relaxedTlsAgent = new Agent({ connect: { rejectUnauthorized: false } });

/** Default timeout for official source fetches (10 seconds). */
const FETCH_TIMEOUT_MS = 10_000;

/** Maximum number of retry attempts on timeout or transient errors. */
const MAX_RETRIES = 1;

function getCauseCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return undefined;
  const nested = (cause as { code?: unknown }).code;
  return typeof nested === "string" ? nested : undefined;
}

export function canUseOfficialTlsFallback(url: string, error: unknown) {
  const code = getCauseCode(error);
  if (!code || !TLS_FALLBACK_CODES.has(code)) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && TLS_FALLBACK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Classifies a fetch error into a human-readable category string
 * suitable for logging in OfficialSourceFetchLog.errorCategory.
 */
export function classifyFetchError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }

  const causeCode = getCauseCode(error);
  if (causeCode === "ECONNREFUSED") return "connection_refused";
  if (causeCode === "ENOTFOUND") return "dns_not_found";
  if (causeCode === "ECONNRESET") return "connection_reset";
  if (causeCode === "ETIMEDOUT") return "network_timeout";
  if (causeCode === "UND_ERR_CONNECT_TIMEOUT") return "connect_timeout";
  if (causeCode && TLS_FALLBACK_CODES.has(causeCode)) return "tls_error";

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "network_error";
  }

  return "unknown_fetch_error";
}

/**
 * Builds a descriptive error message that distinguishes timeout, HTTP errors,
 * and network failures.
 */
export function describeFetchError(error: unknown, url: string): string {
  const category = classifyFetchError(error);

  switch (category) {
    case "timeout":
      return `Timeout: la solicitud a ${url} excedió el límite de ${FETCH_TIMEOUT_MS / 1000}s`;
    case "connection_refused":
      return `Conexión rechazada por el servidor: ${url}`;
    case "dns_not_found":
      return `No se pudo resolver el dominio: ${url}`;
    case "connection_reset":
      return `La conexión fue cerrada por el servidor: ${url}`;
    case "network_timeout":
    case "connect_timeout":
      return `Timeout de red al conectar con: ${url}`;
    case "tls_error":
      return `Error de certificado TLS al conectar con: ${url}`;
    case "network_error":
      return `Error de red al intentar obtener: ${url}`;
    default:
      return `Error desconocido al obtener ${url}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Fetches an official URL with:
 *  - AbortController with 10s timeout
 *  - 1 automatic retry on timeout or transient network errors
 *  - TLS fallback for known .gob.mx sites with certificate issues
 *  - Descriptive error messages distinguishing timeout / HTTP / network failures
 */
export async function fetchOfficialUrl(
  url: string,
  init: RequestInit,
  dependencies: OfficialFetchDependencies = {}
) {
  const fetchImpl = dependencies.fetch || fetch;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const initWithSignal: RequestInit = {
      ...init,
      signal: controller.signal,
    };

    try {
      const response = await fetchImpl(url, initWithSignal);
      clearTimeout(timeoutId);
      return { response, tlsRelaxed: false };
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Try TLS fallback on first attempt only
      if (attempt === 0 && canUseOfficialTlsFallback(url, error)) {
        const relaxedFetch = dependencies.relaxedFetch || fetch;
        const relaxedController = new AbortController();
        const relaxedTimeoutId = setTimeout(() => relaxedController.abort(), FETCH_TIMEOUT_MS);

        try {
          const relaxedInit = {
            ...init,
            signal: relaxedController.signal,
            dispatcher: relaxedTlsAgent,
          } as RequestInit & { dispatcher: Agent };
          const response = await relaxedFetch(url, relaxedInit);
          clearTimeout(relaxedTimeoutId);
          return { response, tlsRelaxed: true };
        } catch (relaxedError) {
          clearTimeout(relaxedTimeoutId);
          lastError = relaxedError;
          // Fall through to retry logic
        }
      }

      // Only retry on timeout or transient network errors
      const category = classifyFetchError(error);
      const isRetryable = [
        "timeout",
        "network_timeout",
        "connect_timeout",
        "connection_reset",
        "network_error",
      ].includes(category);

      if (!isRetryable || attempt >= MAX_RETRIES) {
        const description = describeFetchError(error, url);
        const enrichedError = new Error(description);
        (enrichedError as any).originalError = error;
        (enrichedError as any).errorCategory = category;
        (enrichedError as any).url = url;
        throw enrichedError;
      }

      // Wait briefly before retry (500ms)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Should not reach here, but just in case
  const description = describeFetchError(lastError, url);
  const enrichedError = new Error(description);
  (enrichedError as any).originalError = lastError;
  (enrichedError as any).errorCategory = classifyFetchError(lastError);
  throw enrichedError;
}
