import { validateUrlSafety } from "@/lib/security/urlValidation";
import { fetchOfficialUrl } from "@/lib/sources/officialFetch";

export type SourceAdapter =
  | "SIDOF"
  | "DOF"
  | "DIPUTADOS"
  | "SCJN_LEG"
  | "SJF"
  | "GENERIC_HTML";

export type SourceHealthStatus =
  | "OK"
  | "REDIRECT_BLOCKED"
  | "BLOCKED_BY_PROVIDER"
  | "NOT_FOUND"
  | "FETCH_ERROR"
  | "BROWSER_REQUIRED"
  | "WARNING_ACCESSIBLE_WITH_LIMITATIONS";

export type SourceHealthInput = {
  adapter?: string | null;
  slug?: string | null;
  type?: string | null;
  baseUrl: string;
  healthUrl?: string | null;
  healthPath?: string | null;
  requiresBrowser?: boolean;
  expectedStatus?: number | number[];
};

export type SourceHealthError = {
  name: string;
  message: string;
  causeCode?: string;
  causeMessage?: string;
  causeHostname?: string;
};

export type SourceHealthResult = {
  ok: boolean;
  accessible: boolean;
  status: SourceHealthStatus;
  message: string;
  durationMs: number;
  statusCode?: number;
  finalUrl?: string;
  redirectsFollowed: number;
  adapter: SourceAdapter;
  error?: SourceHealthError;
};

type AdapterProfile = {
  healthUrl?: string;
  healthPath: string;
  expectedStatus: number | number[];
  requiresBrowser: boolean;
};

type HealthDependencies = {
  fetch?: typeof fetch;
  relaxedFetch?: typeof fetch;
  validate?: typeof validateUrlSafety;
  timeoutMs?: number;
};

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
};

const OFFICIAL_HTTP_REWRITE_HOSTS = new Set([
  "diputados.gob.mx",
  "www.diputados.gob.mx",
  "sidof.segob.gob.mx",
  "dof.gob.mx",
  "www.dof.gob.mx",
  "legislacion.scjn.gob.mx",
  "sjf2.scjn.gob.mx",
]);

const ADAPTER_PROFILES: Record<SourceAdapter, AdapterProfile> = {
  SIDOF: {
    healthUrl: "https://sidof.segob.gob.mx/apiStatus",
    healthPath: "/apiStatus",
    expectedStatus: 200,
    requiresBrowser: false,
  },
  DOF: {
    healthUrl: "https://www.dof.gob.mx/",
    healthPath: "/",
    expectedStatus: 200,
    requiresBrowser: false,
  },
  DIPUTADOS: {
    healthUrl: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
    healthPath: "/LeyesBiblio/index.htm",
    expectedStatus: 200,
    requiresBrowser: false,
  },
  SCJN_LEG: {
    healthUrl: "https://legislacion.scjn.gob.mx/buscador/paginas/buscar.aspx",
    healthPath: "/buscador/paginas/buscar.aspx",
    expectedStatus: [200, 403],
    requiresBrowser: true,
  },
  SJF: {
    healthUrl: "https://sjf2.scjn.gob.mx/",
    healthPath: "/",
    expectedStatus: [200, 403],
    requiresBrowser: true,
  },
  GENERIC_HTML: {
    healthPath: "/",
    expectedStatus: 200,
    requiresBrowser: false,
  },
};

export function resolveSourceAdapter(source: Pick<SourceHealthInput, "adapter" | "slug" | "type">): SourceAdapter {
  const values = [source.adapter, source.slug, source.type]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toUpperCase().replace(/-/g, "_"));

  for (const value of values) {
    if (value === "SIDOF") return "SIDOF";
    if (value === "DOF" || value === "DOF_WEB") return "DOF";
    if (value === "DIPUTADOS") return "DIPUTADOS";
    if (value === "SCJN_LEG" || value === "SCJN" || value === "SCJN_LEGISLACION") return "SCJN_LEG";
    if (value === "SJF" || value === "SCJN_SJF") return "SJF";
  }

  return "GENERIC_HTML";
}

export function resolveSourceHealthUrl(source: SourceHealthInput, adapter = resolveSourceAdapter(source)) {
  if (source.healthUrl?.trim()) return new URL(source.healthUrl.trim()).toString();

  const profile = ADAPTER_PROFILES[adapter];
  if (profile.healthUrl) return profile.healthUrl;

  return new URL(source.healthPath?.trim() || profile.healthPath, source.baseUrl).toString();
}

function serializeError(error: unknown): SourceHealthError {
  const value = error instanceof Error ? error : new Error(String(error));
  const cause = (value as Error & { cause?: Record<string, unknown> }).cause;

  return {
    name: value.name,
    message: value.message,
    causeCode: typeof cause?.code === "string" ? cause.code : undefined,
    causeMessage: typeof cause?.message === "string" ? cause.message : undefined,
    causeHostname: typeof cause?.hostname === "string" ? cause.hostname : undefined,
  };
}

function result(
  startTime: number,
  adapter: SourceAdapter,
  status: SourceHealthStatus,
  values: Omit<SourceHealthResult, "status" | "durationMs" | "adapter">
): SourceHealthResult {
  return {
    ...values,
    status,
    durationMs: Date.now() - startTime,
    adapter,
  };
}

function isExpected(status: number, expected: number | number[]) {
  if (Array.isArray(expected)) return expected.includes(status);
  if (expected === 200) return status >= 200 && status <= 299;
  return status === expected;
}

function rewriteOfficialHttpRedirect(target: URL, previous: URL): URL | null {
  if (target.protocol === "https:") return target;
  if (target.protocol !== "http:") return null;
  if (target.hostname.toLowerCase() !== previous.hostname.toLowerCase()) return null;
  if (!OFFICIAL_HTTP_REWRITE_HOSTS.has(target.hostname.toLowerCase())) return null;

  target.protocol = "https:";
  return target;
}

export async function checkSourceHealth(
  source: SourceHealthInput,
  dependencies: HealthDependencies = {}
): Promise<SourceHealthResult> {
  const startTime = Date.now();
  const adapter = resolveSourceAdapter(source);
  const profile = ADAPTER_PROFILES[adapter];
  const fetchImpl = dependencies.fetch || fetch;
  const validate = dependencies.validate || validateUrlSafety;
  const timeoutMs = dependencies.timeoutMs ?? 15_000;
  const expectedStatus = source.expectedStatus ?? profile.expectedStatus;
  const requiresBrowser = source.requiresBrowser ?? profile.requiresBrowser;
  let currentUrl = resolveSourceHealthUrl(source, adapter);
  let redirectsFollowed = 0;
  let tlsRelaxed = false;

  try {
    while (true) {
      const safety = await validate(currentUrl);
      if (!safety.safe) {
        return result(startTime, adapter, "REDIRECT_BLOCKED", {
          ok: false,
          accessible: redirectsFollowed > 0,
          message: `Redirección insegura bloqueada: ${safety.error || "URL no permitida"}`,
          finalUrl: currentUrl,
          redirectsFollowed,
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        const fetched = await fetchOfficialUrl(currentUrl, {
          method: "GET",
          headers: DEFAULT_HEADERS,
          redirect: "manual",
          cache: "no-store",
          signal: controller.signal,
        }, {
          fetch: fetchImpl,
          relaxedFetch: dependencies.relaxedFetch,
        });
        response = fetched.response;
        tlsRelaxed ||= fetched.tlsRelaxed;
      } finally {
        clearTimeout(timer);
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirectsFollowed >= 3) {
          return result(startTime, adapter, "REDIRECT_BLOCKED", {
            ok: false,
            accessible: true,
            message: location ? "Redirección insegura bloqueada: límite de 3 saltos" : "Redirección sin destino",
            statusCode: response.status,
            finalUrl: currentUrl,
            redirectsFollowed,
          });
        }

        const previous = new URL(currentUrl);
        const redirectTarget = rewriteOfficialHttpRedirect(new URL(location, previous), previous);
        if (!redirectTarget) {
          return result(startTime, adapter, "REDIRECT_BLOCKED", {
            ok: false,
            accessible: true,
            message: "Redirección insegura bloqueada",
            statusCode: response.status,
            finalUrl: new URL(location, previous).toString(),
            redirectsFollowed,
          });
        }

        redirectsFollowed++;
        currentUrl = redirectTarget.toString();
        continue;
      }

      if (response.status === 404) {
        return result(startTime, adapter, "NOT_FOUND", {
          ok: false,
          accessible: true,
          message: "Ruta configurada incorrecta",
          statusCode: response.status,
          finalUrl: currentUrl,
          redirectsFollowed,
        });
      }

      if (response.status === 403 && (adapter === "SCJN_LEG" || adapter === "SJF")) {
        return result(startTime, adapter, "BLOCKED_BY_PROVIDER", {
          ok: true,
          accessible: true,
          message: "Bloqueado por proveedor externo, requiere navegador/Playwright",
          statusCode: response.status,
          finalUrl: currentUrl,
          redirectsFollowed,
        });
      }

      if (!isExpected(response.status, expectedStatus)) {
        return result(startTime, adapter, "WARNING_ACCESSIBLE_WITH_LIMITATIONS", {
          ok: true,
          accessible: true,
          message: `Fuente accesible con estatus HTTP ${response.status}`,
          statusCode: response.status,
          finalUrl: currentUrl,
          redirectsFollowed,
        });
      }

      if (adapter === "SJF") {
        const body = await response.text();
        if (/you must enable javascript to view this page/i.test(body)) {
          return result(startTime, adapter, "BROWSER_REQUIRED", {
            ok: true,
            accessible: true,
            message: "Bloqueado por proveedor externo, requiere navegador/Playwright",
            statusCode: response.status,
            finalUrl: currentUrl,
            redirectsFollowed,
          });
        }
      }

      if (requiresBrowser) {
        return result(startTime, adapter, "WARNING_ACCESSIBLE_WITH_LIMITATIONS", {
          ok: true,
          accessible: true,
          message: "Fuente viva, pero requiere navegador para una ingesta completa",
          statusCode: response.status,
          finalUrl: currentUrl,
          redirectsFollowed,
        });
      }

      if (tlsRelaxed) {
        return result(startTime, adapter, "WARNING_ACCESSIBLE_WITH_LIMITATIONS", {
          ok: true,
          accessible: true,
          message: "Accesible con limitaciones: el certificado TLS del proveedor no pudo validarse",
          statusCode: response.status,
          finalUrl: currentUrl,
          redirectsFollowed,
        });
      }

      return result(startTime, adapter, "OK", {
        ok: true,
        accessible: true,
        message: "Accesible",
        statusCode: response.status,
        finalUrl: currentUrl,
        redirectsFollowed,
      });
    }
  } catch (error) {
    const serialized = serializeError(error);
    return result(startTime, adapter, "FETCH_ERROR", {
      ok: false,
      accessible: false,
      message: `Error de red/TLS/DNS: ${serialized.causeCode || serialized.name}`,
      finalUrl: currentUrl,
      redirectsFollowed,
      error: serialized,
    });
  }
}
