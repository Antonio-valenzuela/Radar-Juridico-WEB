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

export async function fetchOfficialUrl(
  url: string,
  init: RequestInit,
  dependencies: OfficialFetchDependencies = {}
) {
  const fetchImpl = dependencies.fetch || fetch;

  try {
    return { response: await fetchImpl(url, init), tlsRelaxed: false };
  } catch (error) {
    if (!canUseOfficialTlsFallback(url, error)) throw error;

    const relaxedFetch = dependencies.relaxedFetch || fetch;
    const relaxedInit = { ...init, dispatcher: relaxedTlsAgent } as RequestInit & { dispatcher: Agent };
    return { response: await relaxedFetch(url, relaxedInit), tlsRelaxed: true };
  }
}
