"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminFetch, getAdminToken, setAdminToken as persistAdminToken } from "@/lib/client/adminToken";

const POLL_INTERVAL_MS = 15000;
const REQUEST_TIMEOUT_MS = 8_000;

type SourceState = "never_checked" | "healthy" | "degraded" | "failed" | "inactive";

type DashboardMetrics = {
  ok: boolean;
  status: "ok" | "degraded";
  generatedAt: string;
  documentsProcessed: number;
  dashboardClients: number;
  activeWorkers: number;
  averageProcessingTimeSeconds: number;
  jobs: {
    total: number;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    deadLetter: number;
  };
  sources: Array<{
    id: string;
    name: string;
    type: string;
    state: SourceState;
    lastCheckedAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    errorCategory: string | null;
  }>;
  warnings: string[];
};

type LoadState = "loading" | "refreshing" | "ready" | "degraded" | "error" | "auth-required";

function formatTime(value: string | null | undefined) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function relativeUpdate(value: string | null | undefined) {
  if (!value) return "sin actualización";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  return seconds < 5 ? "hace unos segundos" : `hace ${seconds} segundos`;
}

function sourceLabel(state: SourceState) {
  switch (state) {
    case "healthy":
      return "Operativa";
    case "degraded":
      return "Degradada";
    case "failed":
      return "Con error";
    case "inactive":
      return "Inactiva";
    default:
      return "Sin revisión";
  }
}

function sourceColor(state: SourceState) {
  switch (state) {
    case "healthy":
      return "#4ade80";
    case "degraded":
      return "#fbbf24";
    case "failed":
      return "#f87171";
    case "inactive":
      return "#94a3b8";
    default:
      return "#93c5fd";
  }
}

export default function DashboardPage() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [history, setHistory] = useState<Array<{ time: string; Procesados: number; Activos: number; Fallidos: number }>>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const suspendedRef = useRef(false);

  useEffect(() => {
    const savedToken = getAdminToken();
    setAdminToken(savedToken);
    setTokenInput(savedToken);
  }, []);

  const fetchTelemetry = useCallback(async (manual = false) => {
    if (adminToken === null) return;
    if (!manual && document.visibilityState === "hidden") return;
    if (requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setLoadState((current) => (current === "ready" || current === "degraded" ? "refreshing" : "loading"));
    setLastError(null);

    try {
      const response = await adminFetch("/api/admin/telemetry", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.status === 401) {
        setLoadState("auth-required");
        setLastError("Necesitas un token administrativo válido para consultar la telemetría.");
        return;
      }
      if (!response.ok) {
        throw new Error("No se pudo consultar la telemetría operativa.");
      }

      const data = (await response.json()) as DashboardMetrics;
      setMetrics(data);
      setLastUpdatedAt(data.generatedAt);
      setLoadState(data.status === "degraded" ? "degraded" : "ready");
      const time = formatTime(data.generatedAt);
      setHistory((previous) => [
        ...previous,
        {
          time,
          Procesados: data.documentsProcessed,
          Activos: data.jobs.active,
          Fallidos: data.jobs.failed,
        },
      ].slice(-20));
    } catch (error) {
      if (suspendedRef.current && error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (error instanceof Error && error.message === "ADMIN_TOKEN_REQUIRED") {
        setLoadState("auth-required");
        setLastError("Necesitas un token administrativo válido para consultar la telemetría.");
        return;
      }
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "La consulta tardó demasiado. Intenta actualizar de nuevo."
        : "No se pudo consultar la telemetría operativa.";
      setLoadState("error");
      setLastError(message);
    } finally {
      window.clearTimeout(timeoutId);
      requestRef.current = null;
    }
  }, [adminToken]);

  useEffect(() => {
    if (adminToken === null) return;

    void fetchTelemetry();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchTelemetry();
    }, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        suspendedRef.current = true;
        requestRef.current?.abort();
      } else {
        suspendedRef.current = false;
        void fetchTelemetry(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      suspendedRef.current = true;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [adminToken, fetchTelemetry]);

  function saveToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = tokenInput.trim();
    persistAdminToken(value);
    setAdminToken(value);
  }

  const statusText = {
    loading: "Consultando…",
    refreshing: "Actualizando…",
    ready: "Actualizado",
    degraded: "Datos parciales",
    error: "Sin conexión",
    "auth-required": "Token requerido",
  }[loadState];

  return (
    <>
      <div className="bg-gradient" style={{ opacity: 0.12 }} />
      <main className="container" style={{ marginTop: "2rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
          <div>
            <span className="badge">Operación</span>
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", margin: "0.4rem 0 0.5rem" }}>Telemetría operativa</h1>
            <p style={{ color: "var(--text-muted)", maxWidth: "680px", margin: 0 }}>
              Estado de trabajos, workers y fuentes oficiales. Se actualiza cada 15 segundos mientras la pestaña está visible.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", minHeight: "44px", padding: "0.5rem 0.85rem", borderRadius: "999px", background: "rgba(148,163,184,0.1)", color: loadState === "error" ? "#fca5a5" : loadState === "degraded" ? "#fde68a" : "#bbf7d0", fontWeight: 700 }}>
              <span aria-hidden="true">●</span>{statusText}
            </span>
            <button type="button" className="btn-doc-secondary" onClick={() => void fetchTelemetry(true)} disabled={loadState === "loading" || loadState === "refreshing"}>
              Actualizar
            </button>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }} aria-live="polite">{relativeUpdate(lastUpdatedAt)}</span>
          </div>
        </header>

        {(adminToken === "" || loadState === "auth-required") && (
          <form onSubmit={saveToken} className="glass-card" style={{ display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap", marginBottom: "1.5rem", padding: "1rem" }}>
            <label style={{ display: "grid", gap: "0.35rem", flex: "1 1 280px", color: "var(--text-main)", fontWeight: 700 }}>
              Token administrativo
              <input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="x-admin-token" autoComplete="off" style={{ minHeight: "44px", borderRadius: "8px", border: "1px solid var(--card-border)", background: "rgba(2,6,23,0.65)", color: "white", padding: "0.65rem 0.8rem", font: "inherit" }} />
            </label>
            <button type="submit" className="btn-doc-primary">Guardar y consultar</button>
          </form>
        )}

        {lastError && (
          <div role="alert" className="legal-warning" style={{ marginBottom: "1.5rem" }}>{lastError}</div>
        )}

        {metrics ? (
          <>
            <section aria-label="Indicadores de telemetría" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              {[
                ["Documentos registrados", metrics.documentsProcessed.toLocaleString(), "#f8fafc"],
                ["Jobs pendientes", metrics.jobs.pending.toLocaleString(), "#93c5fd"],
                ["Jobs activos", metrics.jobs.active.toLocaleString(), "#c4b5fd"],
                ["Jobs fallidos", metrics.jobs.failed.toLocaleString(), metrics.jobs.failed > 0 ? "#fca5a5" : "#f8fafc"],
                ["Workers activos", metrics.activeWorkers.toLocaleString(), "#86efac"],
                ["Clientes dashboard", metrics.dashboardClients.toLocaleString(), "#fde68a"],
              ].map(([label, value, color]) => (
                <article key={label} className="glass-card" style={{ padding: "1.1rem" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                  <strong style={{ display: "block", marginTop: "0.35rem", color, fontSize: "clamp(1.8rem, 4vw, 2.4rem)", lineHeight: 1.1 }}>{value}</strong>
                </article>
              ))}
            </section>

            {metrics.status === "degraded" && (
              <p role="status" style={{ color: "#fde68a", margin: "0 0 1.5rem" }}>
                La telemetría está degradada; no se pudieron consultar: {metrics.warnings.join(", ")}.
              </p>
            )}

            <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 1fr)", gap: "1rem", alignItems: "start" }}>
              <article className="glass-card" style={{ padding: "1.25rem", minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap", marginBottom: "1rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Actividad reciente</h2>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Promedio: {metrics.averageProcessingTimeSeconds.toFixed(2)} s</span>
                </div>
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={history.length ? history : [{ time: formatTime(metrics.generatedAt), Procesados: metrics.documentsProcessed, Activos: metrics.jobs.active, Fallidos: metrics.jobs.failed }]}>
                      <defs>
                        <linearGradient id="telemetryProcessed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "8px" }} />
                      <Area type="monotone" dataKey="Procesados" stroke="#93c5fd" fill="url(#telemetryProcessed)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Activos" stroke="#c4b5fd" fill="transparent" strokeWidth={2} />
                      <Area type="monotone" dataKey="Fallidos" stroke="#fca5a5" fill="transparent" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="glass-card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", marginBottom: "1rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Fuentes oficiales</h2>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{metrics.sources.length} registradas</span>
                </div>
                <div style={{ display: "grid", gap: "0.7rem" }}>
                  {metrics.sources.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", margin: 0 }}>No hay fuentes oficiales registradas.</p>
                  ) : metrics.sources.map((source) => (
                    <div key={source.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", paddingBottom: "0.7rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{source.name}</strong>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Última revisión: {formatTime(source.lastCheckedAt)}</span>
                      </div>
                      <span style={{ color: sourceColor(source.state), fontSize: "0.78rem", fontWeight: 800, whiteSpace: "nowrap" }}>{sourceLabel(source.state)}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : !lastError ? (
          <div className="glass-card" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>Consultando el estado operativo…</p>
          </div>
        ) : null}
      </main>
    </>
  );
}
