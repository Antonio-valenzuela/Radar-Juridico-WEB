"use client";

import { useState, useEffect, useCallback } from "react";

interface Change {
    id: string;
    texto_anterior: string | null;
    texto_nuevo: string | null;
    tipo_diferencia: string;
    palabras_clave_detectadas: string | null;
    createdAt: string;
    documentVersion: {
        tipo_cambio: string;
        fecha_detectado: string;
        document: {
            id: string;
            titulo: string;
            impacto: string | null;
            source: { nombre: string };
        };
    };
}

export default function ReformasPage() {
    const [changes, setChanges] = useState<Change[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchChanges = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/changes?page=${page}&limit=20`);
            const data = await res.json();
            if (data.ok) {
                setChanges(data.data);
                setTotal(data.meta?.total || 0);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchChanges();
    }, [fetchChanges]);

    const formatDate = (d: string) =>
        new Intl.DateTimeFormat("es-MX", {
            timeZone: "America/Mexico_City",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(d));

    const totalPages = Math.ceil(total / 20);

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Reformas Detectadas</h1>
                    <p className="subtitle">
                        {total} cambio{total !== 1 ? "s" : ""} detectado{total !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : changes.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">⚖️</div>
                    <p>No se han detectado reformas aún. El sistema comparará versiones automáticamente cuando escanee las fuentes.</p>
                </div>
            ) : (
                <>
                    {changes.map((change) => {
                        const dv = change.documentVersion;
                        const doc = dv.document;
                        const isExpanded = expandedId === change.id;

                        return (
                            <div key={change.id} className="card" style={{ cursor: "pointer" }}>
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : change.id)}
                                    style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                            <span className={`badge badge-${dv.tipo_cambio}`}>{dv.tipo_cambio}</span>
                                            <span className={`badge badge-${doc.impacto || "bajo"}`}>{doc.impacto || "—"}</span>
                                            <span className="badge" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                                                {doc.source.nombre}
                                            </span>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>
                                            {doc.titulo.slice(0, 120)}
                                            {doc.titulo.length > 120 ? "…" : ""}
                                        </div>
                                        {change.palabras_clave_detectadas && (
                                            <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                {change.palabras_clave_detectadas.split(", ").map((kw) => (
                                                    <span key={kw} style={{
                                                        padding: "2px 8px",
                                                        borderRadius: 4,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        background: "var(--warning-bg)",
                                                        color: "var(--warning)",
                                                    }}>
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                            {formatDate(dv.fecha_detectado)}
                                        </div>
                                        <div style={{ fontSize: 18, marginTop: 4, color: "var(--text-muted)" }}>
                                            {isExpanded ? "▲" : "▼"}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Diff View */}
                                {isExpanded && (
                                    <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", marginBottom: 8, textTransform: "uppercase" }}>
                                                    Texto Anterior
                                                </div>
                                                <div className="diff-viewer" style={{ maxHeight: 400, overflowY: "auto" }}>
                                                    {change.texto_anterior
                                                        ? change.texto_anterior.slice(0, 5000)
                                                        : "(sin contenido previo)"}
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 8, textTransform: "uppercase" }}>
                                                    Texto Nuevo
                                                </div>
                                                <div className="diff-viewer" style={{ maxHeight: 400, overflowY: "auto" }}>
                                                    {change.texto_nuevo
                                                        ? change.texto_nuevo.slice(0, 5000)
                                                        : "(sin contenido nuevo)"}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="btn btn-secondary btn-sm">📋 Copiar Diff</button>
                                            <button className="btn btn-secondary btn-sm">📄 Exportar PDF</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
                            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                ← Anterior
                            </button>
                            <span style={{ padding: "6px 12px", fontSize: 13, color: "var(--text-secondary)" }}>
                                Página {page} de {totalPages}
                            </span>
                            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                Siguiente →
                            </button>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
