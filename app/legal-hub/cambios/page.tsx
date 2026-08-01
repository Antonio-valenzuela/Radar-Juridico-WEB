'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface LegalDiff {
  id: string;
  normaId: string | null;
  normaNombre: string;
  sigla: string | null;
  fuente: string;
  temas: string[];
  fechaCambio: string;
  summaryBullets: string[];
  changedArticles: unknown[];
  executiveSummary: string | null;
  practicalImpact: string | null;
  recommendedAction: string | null;
  url: string | null;
}

const MATTERS = [
  "constitucional",
  "civil",
  "familiar",
  "penal",
  "mercantil",
  "laboral",
  "fiscal",
  "aduanal",
  "administrativo",
];

export default function CambiosNormativosPage() {
  const [diffs, setDiffs] = useState<LegalDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatter, setSelectedMatter] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    async function loadDiffs() {
      try {
        setLoading(true);
        const searchParams = new URLSearchParams(window.location.search);
        const normaFilter = (searchParams.get("norma") || "").trim();
        if (normaFilter) setQuery(normaFilter);
        const endpoint = normaFilter
          ? `/api/legal/diffs?norma=${encodeURIComponent(normaFilter)}`
          : "/api/legal/diffs";
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Error al obtener cambios normativos");
        const data = await res.json();
        setDiffs(data.diffs || []);
      } catch (err: any) {
        setError(err.message || "Error al cargar la información");
      } finally {
        setLoading(false);
      }
    }
    loadDiffs();
  }, []);

  const filteredDiffs = useMemo(() => {
    return diffs.filter((item) => {
      const matchesMatter =
        !selectedMatter || item.temas.some((t) => t.toLowerCase() === selectedMatter.toLowerCase());
      const matchesQuery =
        !query ||
        item.normaNombre.toLowerCase().includes(query.toLowerCase()) ||
        (item.sigla || "").toLowerCase().includes(query.toLowerCase()) ||
        item.summaryBullets.some((b) => b.toLowerCase().includes(query.toLowerCase()));
      return matchesMatter && matchesQuery;
    });
  }, [diffs, selectedMatter, query]);

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell" style={{ padding: "2rem 1.5rem" }}>
        <nav className="document-nav" style={{ marginBottom: "1.5rem" }}>
          <Link href="/legal-hub" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            &larr; Volver al Centro Jurídico
          </Link>
          <Link href="/monitoreo" style={{ color: "var(--text-muted)", textDecoration: "none", marginLeft: "1.5rem" }}>
            Vigilancia documental
          </Link>
          <Link href="/search" style={{ color: "var(--text-muted)", textDecoration: "none", marginLeft: "1.5rem" }}>
            Búsqueda Avanzada
          </Link>
        </nav>

        <section className="legal-hub-hero" style={{ marginBottom: "2rem" }}>
          <span className="badge">Control de Cambios Normativos</span>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: "0.5rem 0" }}>
            Cambios Reales por Materia y Resumen con IA
          </h1>
          <p className="subtitle" style={{ color: "var(--text-muted)", margin: 0 }}>
            Visualización de reformas comparadas (NormaDiff) con análisis ejecutivo anclado en artículos modificados.
          </p>
        </section>

        {/* Toolbar de Filtros */}
        <section className="glass-card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Buscar por ley, sigla o contenido del cambio..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 2,
                minWidth: "240px",
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "1px solid var(--card-border)",
                background: "#0f172a",
                color: "white",
              }}
            />
            <select
              value={selectedMatter}
              onChange={(e) => setSelectedMatter(e.target.value)}
              style={{
                flex: 1,
                minWidth: "180px",
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "1px solid var(--card-border)",
                background: "#0f172a",
                color: "white",
              }}
            >
              <option value="">Todas las materias</option>
              {MATTERS.map((m) => (
                <option key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Estado de Carga o Error */}
        {loading && (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--text-muted)" }}>Cargando reformas y análisis normativos...</p>
          </div>
        )}

        {error && (
          <div className="glass-card" style={{ padding: "1.5rem", borderLeft: "4px solid #ef4444", marginBottom: "2rem" }}>
            <p style={{ color: "#ef4444", margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Lista de Tarjetas de Cambios */}
        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {filteredDiffs.length === 0 ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "3rem" }}>
                <p style={{ color: "var(--text-muted)", margin: 0 }}>
                  No hay reformas normativas registradas para los criterios seleccionados.
                </p>
              </div>
            ) : (
              filteredDiffs.map((diff) => (
                <article
                  key={diff.id}
                  className="glass-card"
                  style={{
                    padding: "1.75rem",
                    border: "1px solid var(--card-border)",
                    borderRadius: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                  }}
                >
                  {/* Encabezado de la Tarjeta */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                        {diff.temas.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "0.2rem 0.6rem",
                              borderRadius: "6px",
                              background: "rgba(99, 102, 241, 0.15)",
                              color: "#818cf8",
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "white" }}>
                        {diff.sigla ? `${diff.sigla} — ${diff.normaNombre}` : diff.normaNombre}
                      </h2>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        Fuente: {diff.fuente} · Fecha de modificación: {new Date(diff.fechaCambio).toLocaleDateString("es-MX")}
                      </span>
                    </div>

                    {diff.url && (
                      <a
                        href={diff.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.85rem",
                          background: "#334155",
                          color: "white",
                          borderRadius: "6px",
                          textDecoration: "none",
                        }}
                      >
                        Ver fuente oficial &rarr;
                      </a>
                    )}
                  </div>

                  {/* Puntos Cambiados por el Motor de Diff */}
                  {diff.summaryBullets.length > 0 && (
                    <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1rem 1.25rem", borderRadius: "8px", borderLeft: "3px solid var(--accent)" }}>
                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "var(--accent)" }}>
                        📝 Modificaciones Detectadas (Motor de Diff)
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem", color: "#cbd5e1" }}>
                        {diff.summaryBullets.map((bullet, idx) => (
                          <li key={idx} style={{ marginBottom: "0.25rem" }}>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resumen Anclado con IA en 3 Secciones */}
                  {(diff.executiveSummary || diff.practicalImpact || diff.recommendedAction) && (
                    <div
                      style={{
                        background: "linear-gradient(135deg, rgba(30, 27, 75, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%)",
                        padding: "1.25rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(129, 140, 248, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.85rem",
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        🤖 Análisis Legal Anclado con IA
                      </span>

                      {diff.executiveSummary && (
                        <div>
                          <strong style={{ color: "#e2e8f0", fontSize: "0.9rem" }}>1. Resumen Ejecutivo:</strong>
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5 }}>
                            {diff.executiveSummary}
                          </p>
                        </div>
                      )}

                      {diff.practicalImpact && (
                        <div>
                          <strong style={{ color: "#e2e8f0", fontSize: "0.9rem" }}>2. Impacto Práctico:</strong>
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5 }}>
                            {diff.practicalImpact}
                          </p>
                        </div>
                      )}

                      {diff.recommendedAction && (
                        <div>
                          <strong style={{ color: "#e2e8f0", fontSize: "0.9rem" }}>3. Acción Recomendada:</strong>
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5 }}>
                            {diff.recommendedAction}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        )}
      </main>
    </>
  );
}
