"use client";

import { useState, useEffect, useCallback } from "react";

interface Source {
    id: string;
    nombre: string;
    url: string;
    tipo: string;
    metodo_extraccion: string;
    activo: boolean;
    frecuencia_minutos: number;
    ultima_revision: string | null;
    error_count: number;
    last_error: string | null;
    ingestRuns?: {
        startedAt: string;
        status: string;
        inserted: number;
    }[];
}

export default function FuentesPage() {
    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const [form, setForm] = useState({
        nombre: "",
        url: "",
        tipo: "federal",
        metodo_extraccion: "html",
        frecuencia_minutos: 60,
    });

    const fetchSources = useCallback(async () => {
        try {
            const res = await fetch("/api/sources");
            const data = await res.json();
            if (data.ok) setSources(data.data);
        } catch (err) {
            console.error("Error fetching sources:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSources();
        const interval = setInterval(fetchSources, 30000);
        return () => clearInterval(interval);
    }, [fetchSources]);

    const handleAdd = async () => {
        setIsActionLoading("create");
        try {
            const res = await fetch("/api/sources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.ok) {
                setShowModal(false);
                setForm({ nombre: "", url: "", tipo: "federal", metodo_extraccion: "html", frecuencia_minutos: 60 });
                fetchSources();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert("Error al conectar con el servidor.");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleToggle = async (id: string, activo: boolean) => {
        setIsActionLoading(id);
        try {
            const res = await fetch(`/api/sources/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !activo }),
            });
            const data = await res.json();
            if (data.ok) fetchSources();
        } catch (err) {
            alert("Error al actualizar fuente.");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta fuente?")) return;
        setIsActionLoading(id);
        try {
            const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.ok) fetchSources();
        } catch (err) {
            alert("Error al eliminar fuente.");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleForceIngest = async (source: string) => {
        setIsActionLoading(`ingest-${source}`);
        try {
            const res = await fetch("/api/ingest/run", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-token": "secreto123",
                },
                body: JSON.stringify({ source }),
            });
            const data = await res.json();
            if (data.ok) {
                alert(`Ingesta finalizada: ${data.inserted} nuevos items.`);
                fetchSources();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch {
            alert("Error ejecutando ingesta.");
        } finally {
            setIsActionLoading(null);
        }
    };

    const formatDate = (d: string | null) => {
        if (!d) return "Nunca";
        return new Intl.DateTimeFormat("es-MX", {
            timeZone: "America/Mexico_City",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(d));
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Fuentes de Datos</h1>
                    <p className="subtitle">Gestión dinámica de conectores y scrapers</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => handleForceIngest("ALL")} disabled={!!isActionLoading}>
                        ⚡ Ingestar Todo
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        + Agregar Fuente
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : sources.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">🔗</div>
                    <p>No hay fuentes configuradas en la base de datos.</p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
                        + Agregar Primera Fuente
                    </button>
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Estado</th>
                                <th>Nombre / URL</th>
                                <th>Configuración</th>
                                <th>Última Ingesta</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sources.map((s) => (
                                <tr key={s.id}>
                                    <td>
                                        <span className={`status-dot ${isActionLoading === s.id ? "scanning" : s.activo ? "online" : "offline"}`} />
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{s.nombre}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.url}</div>
                                        {s.last_error && (
                                            <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 4 }}>
                                                ⚠ Error: {s.last_error.slice(0, 80)}...
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                            <span className="badge badge-nuevo">{s.tipo}</span>
                                            <span className="badge" style={{ background: "rgba(255,255,255,0.05)" }}>{s.metodo_extraccion.toUpperCase()}</span>
                                            <span className="badge" style={{ background: "rgba(255,255,255,0.05)" }}>{s.frecuencia_minutos}m</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 12 }}>{formatDate(s.ultima_revision)}</div>
                                        {s.ingestRuns?.[0] && (
                                            <div style={{ fontSize: 10, color: s.ingestRuns[0].status === "completed" ? "var(--success)" : "var(--warning)" }}>
                                                {s.ingestRuns[0].status === "completed" ? `✅ +${s.ingestRuns[0].inserted}` : "⚠️ Falló"}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleForceIngest(s.id)} disabled={!!isActionLoading} title="Ingestar ahora">
                                                ⚡
                                            </button>
                                            <button className={`btn btn-sm ${s.activo ? "btn-secondary" : "btn-primary"}`} onClick={() => handleToggle(s.id, s.activo)} disabled={!!isActionLoading}>
                                                {s.activo ? "⏸" : "▶"}
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)} disabled={!!isActionLoading}>
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Agregar Nueva Fuente</h2>
                        <div className="form-group">
                            <label>Nombre</label>
                            <input className="form-input" placeholder="ej. DOF - Diario Oficial" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>URL Base</label>
                            <input className="form-input" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                            <div className="form-group">
                                <label>Tipo</label>
                                <select className="form-select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                                    <option value="federal">Federal</option>
                                    <option value="estatal">Estatal</option>
                                    <option value="reglamento">Reglamento</option>
                                    <option value="tribunal">Tribunal</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Método</label>
                                <select className="form-select" value={form.metodo_extraccion} onChange={(e) => setForm({ ...form, metodo_extraccion: e.target.value })}>
                                    <option value="html">HTML</option>
                                    <option value="pdf">PDF</option>
                                    <option value="rss">RSS</option>
                                    <option value="api">API</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Frecuencia (minutos)</label>
                            <input className="form-input" type="number" value={form.frecuencia_minutos} onChange={(e) => setForm({ ...form, frecuencia_minutos: Number(e.target.value) })} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleAdd} disabled={isActionLoading === "create"}>
                                {isActionLoading === "create" ? "Guardando..." : "Crear Fuente"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
