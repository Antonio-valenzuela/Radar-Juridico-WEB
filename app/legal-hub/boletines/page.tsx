"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLegalWorkspaceContext } from '@/context/LegalWorkspaceContext';

type OfficialSource = {
  id: string;
  name: string;
  slug: string;
  jurisdiction: string;
  state: string;
  matter?: string;
  baseUrl?: string;
};

type BulletinSubscription = {
  id: string;
  organizationId: string;
  sourceId: string;
  expediente?: string | null;
  actor?: string | null;
  demandado?: string | null;
  juzgado?: string | null;
  abogado?: string | null;
  keywords?: string[] | null;
  frequency: "diario" | "cada_6_horas" | "cada_12_horas" | "semanal";
  status: "active" | "paused" | "error";
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastQueryStatus?: string | null;
  lastErrorMessage?: string | null;
  createdAt: string;
  source?: OfficialSource;
  _count?: { matches: number };
};

type BulletinMatch = {
  id: string;
  subscriptionId: string;
  publicationTitle?: string | null;
  publicationExtract?: string | null;
  publicationUrl?: string | null;
  publicationDate?: string | null;
  court?: string | null;
  expediente?: string | null;
  matchReason: string;
  matchedFields?: any;
  score: number;
  seenAt: string;
  reviewed: boolean;
};

export default function BulletinTrackingPage() {
  const [sources, setSources] = useState<OfficialSource[]>([]);
  const [subscriptions, setSubscriptions] = useState<BulletinSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [expediente, setExpediente] = useState("");
  const [actor, setActor] = useState("");
  const [demandado, setDemandado] = useState("");
  const [juzgado, setJuzgado] = useState("");
  const [abogado, setAbogado] = useState("");
  const [keywords, setKeywords] = useState("");
  const [frequency, setFrequency] = useState<"diario" | "cada_6_horas" | "cada_12_horas" | "semanal">("diario");
  const [submitting, setSubmitting] = useState(false);

  const { setActiveBulletin, clearActiveBulletin, setContextMode, setPageTitle } = useLegalWorkspaceContext();

  // Execution & Matches Modal State
  const [runningId, setRunningId] = useState<string | null>(null);
  const [selectedSubForMatches, setSelectedSubForMatches] = useState<BulletinSubscription | null>(null);
  const [matches, setMatches] = useState<BulletinMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [sourcesRes, subsRes] = await Promise.all([
        fetch("/api/bulletins/sources"),
        fetch("/api/bulletins/subscriptions"),
      ]);

      const sourcesData = await sourcesRes.json();
      const subsData = await subsRes.json();

      if (sourcesData.ok) {
        setSources(sourcesData.sources);
        if (sourcesData.sources.length > 0 && !sourceId) {
          setSourceId(sourcesData.sources[0].id);
        }
      }

      if (subsData.ok) {
        setSubscriptions(subsData.subscriptions);
      } else {
        setError(subsData.error || "No se pudieron cargar los seguimientos.");
      }
    } catch {
      setError("Error de conexión al cargar datos de boletines.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setExpediente("");
    setActor("");
    setDemandado("");
    setJuzgado("");
    setAbogado("");
    setKeywords("");
    setFrequency("diario");
    if (sources.length > 0) setSourceId(sources[0].id);
  }

  function startEdit(sub: BulletinSubscription) {
    setEditingId(sub.id);
    setSourceId(sub.sourceId);
    setExpediente(sub.expediente || "");
    setActor(sub.actor || "");
    setDemandado(sub.demandado || "");
    setJuzgado(sub.juzgado || "");
    setAbogado(sub.abogado || "");
    setKeywords(Array.isArray(sub.keywords) ? sub.keywords.join(", ") : "");
    setFrequency(sub.frequency || "diario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId) {
      setError("Por favor selecciona una fuente de boletín.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    const payload = {
      sourceId,
      expediente,
      actor,
      demandado,
      juzgado,
      abogado,
      keywords,
      frequency,
    };

    try {
      const url = editingId ? `/api/bulletins/subscriptions/${editingId}` : "/api/bulletins/subscriptions";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al guardar el seguimiento.");
      } else {
        setSuccessMsg(editingId ? "Seguimiento actualizado correctamente." : "Seguimiento creado con éxito.");
        resetForm();
        await loadData();
      }
    } catch {
      setError("Error al comunicarse con el servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePause(sub: BulletinSubscription) {
    const newStatus = sub.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/bulletins/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(`Seguimiento ${newStatus === "paused" ? "pausado" : "reactivado"}.`);
        loadData();
      }
    } catch {
      setError("Error al cambiar estado del seguimiento.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de que deseas eliminar este seguimiento de boletín?")) return;
    try {
      const res = await fetch(`/api/bulletins/subscriptions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg("Seguimiento eliminado.");
        loadData();
      }
    } catch {
      setError("Error al eliminar el seguimiento.");
    }
  }

  async function handleRunNow(sub: BulletinSubscription) {
    setRunningId(sub.id);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/bulletins/subscriptions/${sub.id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(data.message || "Revisión completada.");
        await loadData();
      } else {
        setError(data.error || "Fallo en la revisión manual.");
      }
    } catch {
      setError("Error de conexión durante la revisión manual.");
    } finally {
      setRunningId(null);
    }
  }

  async function handleViewMatches(sub: BulletinSubscription) {
    setSelectedSubForMatches(sub);
    setActiveBulletin({
      subscriptionId: sub.id,
      expediente: sub.expediente || '',
      sourceId: sub.sourceId,
      sourceName: sub.source?.name || '',
    });
    setContextMode('current_bulletin');
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/bulletins/subscriptions/${sub.id}/results`);
      const data = await res.json();
      if (data.ok) {
        setMatches(data.matches || []);
      }
    } catch {
      setError("Error al consultar coincidencias.");
    } finally {
      setMatchesLoading(false);
    }
  }

  // Cerrar modal con Escape
  useEffect(() => {
    setPageTitle('Boletines Judiciales');
  }, [setPageTitle]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedSubForMatches(null);
    }
    if (selectedSubForMatches) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [selectedSubForMatches]);

  async function handleMarkAllReviewed() {
    if (!selectedSubForMatches) return;
    try {
      const res = await fetch(`/api/bulletins/subscriptions/${selectedSubForMatches.id}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setMatches(data.matches || []);
        loadData();
      }
    } catch {
      setError("Error al marcar como revisadas.");
    }
  }

  return (
    <>
      <div className="bg-gradient"></div>

      <main className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <header style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Link href="/legal-hub" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.9rem" }}>
              ← Volver al Centro Jurídico
            </Link>
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📡 Seguimiento Automatizado de Boletines Judiciales</h1>
          <p className="text-muted">
            Configura parámetros de búsqueda permanente por expediente, actor, demandado, juzgado y palabras clave. Puedes probar el flujo con datos de ejemplo y revisar el resultado sin depender de una publicación externa inmediata.
          </p>
        </header>

        {error && (
          <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "8px", color: "#f87171", marginBottom: "1.5rem" }}>
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: "1rem", background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", borderRadius: "8px", color: "#34d399", marginBottom: "1.5rem" }}>
            ✅ {successMsg}
          </div>
        )}

        <section className="jr-card" style={{ marginBottom: "1rem", padding: "1rem 1.25rem", border: "1px solid rgba(96, 165, 250, 0.35)" }}>
          <strong style={{ display: "block", marginBottom: "0.35rem" }}>Prueba rápida</strong>
          <p className="text-muted" style={{ margin: 0, fontSize: "0.95rem" }}>
            Puedes usar datos de ejemplo como expediente <strong>1234/2026</strong>, actor <strong>Juan Pérez</strong>, demandado <strong>Acme S.A.</strong> y juzgado <strong>Juzgado Segundo Civil</strong> para probar el flujo completo.
          </p>
        </section>

        {/* Formulario de Creación / Edición */}
        <section className="jr-card" style={{ marginBottom: "2.5rem", padding: "1.5rem" }}>
          <h2 style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{editingId ? "✏️ Editar Seguimiento de Boletín" : "➕ Crear Nuevo Seguimiento de Boletín"}</span>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "0.25rem 0.75rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>
                Cancelar edición
              </button>
            )}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Fuente Judicial *</label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
                required
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.jurisdiction} - {s.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Número de Expediente</label>
              <input
                type="text"
                placeholder="Ej: 1234/2024 o 567/2023"
                value={expediente}
                onChange={(e) => setExpediente(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Actor / Parte Quejosa</label>
              <input
                type="text"
                placeholder="Nombre de la parte actora"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Demandado / Parte Demandada</label>
              <input
                type="text"
                placeholder="Nombre de la parte demandada"
                value={demandado}
                onChange={(e) => setDemandado(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Juzgado / Órgano Jurisdiccional</label>
              <input
                type="text"
                placeholder="Ej: Juzgado Segundo Civil de Guadalajara"
                value={juzgado}
                onChange={(e) => setJuzgado(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Abogado Autorizado</label>
              <input
                type="text"
                placeholder="Nombre del abogado patrono o autorizado"
                value={abogado}
                onChange={(e) => setAbogado(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Palabras Clave (separadas por coma)</label>
              <input
                type="text"
                placeholder="Ej: embargo, sentencia, reposición, amparo"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", fontSize: "0.9rem" }}>Frecuencia de Revisión</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", background: "#0f172a", color: "white", border: "1px solid var(--card-border)" }}
              >
                <option value="diario">Diaria (1 vez al día)</option>
                <option value="cada_6_horas">Cada 6 horas</option>
                <option value="cada_12_horas">Cada 12 horas</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="submit" className="jr-button-primary" disabled={submitting}>
                {submitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear seguimiento"}
              </button>
            </div>
          </form>
        </section>

        {/* Lista de Seguimientos Configurados */}
        <section className="jr-card" style={{ padding: "1.5rem", marginBottom: "2.5rem" }}>
          <h2 style={{ marginBottom: "1.5rem" }}>📋 Seguimientos Activos ({subscriptions.length})</h2>

          {loading ? (
            <p className="text-muted">Cargando seguimientos...</p>
          ) : subscriptions.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
              <h3>No tienes seguimientos de boletín aún.</h3>
              <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                Usa el formulario superior para registrar el primer número de expediente o conjunto de partes a monitorear.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "8px",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: sub.status === "active" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)", color: sub.status === "active" ? "#34d399" : "#fbbf24", fontWeight: "bold" }}>
                        {sub.status === "active" ? "ACTIVO" : "PAUSADO"}
                      </span>
                      <h3 style={{ margin: "0.4rem 0 0.2rem 0", fontSize: "1.2rem" }}>
                        {sub.expediente ? `Expediente: ${sub.expediente}` : "Seguimiento por Partes / Criterios"}
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        Fuente: <strong>{sub.source?.name || "Boletín Judicial"}</strong> ({sub.frequency})
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleRunNow(sub)}
                        disabled={runningId === sub.id}
                        style={{ padding: "0.4rem 0.8rem", borderRadius: "4px", background: "#3b82f6", color: "white", border: "none", cursor: "pointer", fontSize: "0.85rem" }}
                      >
                        {runningId === sub.id ? "Revisando..." : "Ejecutar ahora"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleViewMatches(sub)}
                        style={{ padding: "0.4rem 0.8rem", borderRadius: "4px", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "0.85rem" }}
                      >
                        Ver resultados ({sub._count?.matches || 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePause(sub)}
                        style={{ padding: "0.4rem 0.8rem", borderRadius: "4px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", cursor: "pointer", fontSize: "0.85rem" }}
                      >
                        {sub.status === "active" ? "Pausar" : "Reactivar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(sub)}
                        style={{ padding: "0.4rem 0.8rem", borderRadius: "4px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", cursor: "pointer", fontSize: "0.85rem" }}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(sub.id)}
                        style={{ padding: "0.4rem 0.8rem", borderRadius: "4px", background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid #ef4444", cursor: "pointer", fontSize: "0.85rem" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", fontSize: "0.85rem", background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "6px" }}>
                    <div><strong>Actor:</strong> {sub.actor || "N/A"}</div>
                    <div><strong>Demandado:</strong> {sub.demandado || "N/A"}</div>
                    <div><strong>Juzgado:</strong> {sub.juzgado || "N/A"}</div>
                    <div><strong>Abogado:</strong> {sub.abogado || "N/A"}</div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <strong>Palabras clave:</strong> {Array.isArray(sub.keywords) && sub.keywords.length > 0 ? sub.keywords.join(", ") : "Sin especificar"}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.5rem" }}>
                    <span>Última revisión: {sub.lastRunAt ? new Date(sub.lastRunAt).toLocaleString() : "Pendiente"}</span>
                    <span>Próxima revisión: {sub.nextRunAt ? new Date(sub.nextRunAt).toLocaleString() : "Programada"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Modal / Panel de Coincidencias */}
        {selectedSubForMatches && (
          <div
            onClick={() => {
              setSelectedSubForMatches(null);
              clearActiveBulletin();
              setContextMode('none');
            }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: "1rem" }}
          >
            <div
              className="jr-card"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              style={{ width: "100%", maxWidth: "800px", maxHeight: "85vh", overflowY: "auto", padding: "1.5rem", position: "relative" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.75rem" }}>
                <div>
                  <h2 style={{ margin: 0 }}>📊 Coincidencias de Boletín</h2>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {selectedSubForMatches.expediente ? `Expediente ${selectedSubForMatches.expediente}` : "Seguimiento por partes"} - {selectedSubForMatches.source?.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubForMatches(null);
                    clearActiveBulletin();
                    setContextMode('none');
                  }}
                  aria-label="Cerrar coincidencias"
                  title="Cerrar"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-primary)",
                    fontSize: "1.25rem",
                    cursor: "pointer",
                    padding: "0.25rem",
                    borderRadius: "6px",
                    transition: "background-color 0.12s",
                  }}
                >
                  ✕
                </button>
              </div>

              {matchesLoading ? (
                <p className="text-muted">Cargando publicaciones encontradas...</p>
              ) : matches.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <p className="text-muted">No se han registrado coincidencias para este seguimiento aún.</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                    <button
                      type="button"
                      onClick={handleMarkAllReviewed}
                      style={{ padding: "0.4rem 0.8rem", borderRadius: "4px", background: "#10b981", color: "white", border: "none", cursor: "pointer", fontSize: "0.85rem" }}
                    >
                      ✓ Marcar todas como revisadas
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {matches.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          background: m.reviewed ? "rgba(255,255,255,0.03)" : "rgba(59,130,246,0.1)",
                          border: `1px solid ${m.reviewed ? "rgba(255,255,255,0.1)" : "#3b82f6"}`,
                          borderRadius: "6px",
                          padding: "1rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: "bold" }}>
                            {m.court || "Órgano Judicial"} — Expediente: {m.expediente || "N/A"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {m.publicationDate ? new Date(m.publicationDate).toLocaleDateString() : new Date(m.seenAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 style={{ margin: "0 0 0.5rem 0" }}>{m.publicationTitle || "Publicación de acuerdo judicial"}</h4>
                        <p style={{ fontSize: "0.85rem", color: "#cbd5e1", whiteSpace: "pre-line", marginBottom: "0.75rem" }}>
                          {m.publicationExtract}
                        </p>

                        <div style={{ fontSize: "0.8rem", background: "rgba(0,0,0,0.2)", padding: "0.5rem", borderRadius: "4px", marginBottom: "0.75rem" }}>
                          <strong>Razones de coincidencia:</strong> {m.matchReason}
                        </div>

                        {m.publicationUrl && (
                          <a
                            href={m.publicationUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: "0.85rem", color: "#60a5fa", textDecoration: "underline" }}
                          >
                            Ver comprobante / evidencia oficial →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Respaldo: Consulta Manual en Fuentes Oficiales */}
        <section className="jr-card" style={{ padding: "1.5rem", marginTop: "3rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>🔗 Consulta Manual en Fuente Oficial (Respaldo)</h3>
          <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
            Si requieres consultar directamente el portal oficial para trámites con FIREL, e.firma o CAPTCHA activo:
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="https://ciudadano.cjj.gob.mx/boletin_judicial/consultar" target="_blank" rel="noreferrer" className="btn-doc-secondary" style={{ textDecoration: "none" }}>
              Boletín CJJ Jalisco (Oficial) ↗
            </a>
            <a href="https://sise.cjf.gob.mx/SiseInternet/default.aspx" target="_blank" rel="noreferrer" className="btn-doc-secondary" style={{ textDecoration: "none" }}>
              PJF SISE / Acuerdos Federales ↗
            </a>
            <a href="https://www.cjf.gob.mx/consultas.htm" target="_blank" rel="noreferrer" className="btn-doc-secondary" style={{ textDecoration: "none" }}>
              Portal Consultas CJF ↗
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
