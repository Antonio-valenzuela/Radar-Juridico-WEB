"use client";

import { useState, useEffect, useCallback } from "react";

interface MonitorStatus {
    activeSources: number;
    totalDocuments: number;
    todayChanges: number;
    weekChanges: number;
    unreadNotifications: number;
    sources: Array<{
        id: string;
        nombre: string;
        ultima_revision: string | null;
        error_count: number;
        last_error: string | null;
        frecuencia_minutos: number;
    }>;
}

export default function ConfiguracionPage() {
    const [status, setStatus] = useState<MonitorStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [scanningAll, setScanningAll] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/monitor/status");
            const data = await res.json();
            if (data.ok) setStatus(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 15000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleScanAll = async () => {
        setScanningAll(true);
        try {
            await fetch("/api/monitor/force-scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            setTimeout(() => {
                setScanningAll(false);
                fetchStatus();
            }, 5000);
        } catch {
            setScanningAll(false);
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
                    <h1>Configuración</h1>
                    <p className="subtitle">Estado del sistema y herramientas de monitoreo</p>
                </div>
                <button
                    className="btn btn-primary"
                    disabled={scanningAll}
                    onClick={handleScanAll}
                >
                    {scanningAll ? (
                        <>
                            <span className="spinner" /> Escaneando...
                        </>
                    ) : (
                        "🔄 Forzar Revisión General"
                    )}
                </button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : status ? (
                <>
                    {/* System Stats */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="label">Fuentes Activas</div>
                            <div className="value accent">{status.activeSources}</div>
                        </div>
                        <div className="stat-card">
                            <div className="label">Documentos</div>
                            <div className="value">{status.totalDocuments}</div>
                        </div>
                        <div className="stat-card">
                            <div className="label">Cambios Hoy</div>
                            <div className="value success">{status.todayChanges}</div>
                        </div>
                        <div className="stat-card">
                            <div className="label">Sin Leer</div>
                            <div className="value danger">{status.unreadNotifications}</div>
                        </div>
                    </div>

                    {/* Source Status */}
                    <div className="card">
                        <div className="card-header">
                            <h2>Estado de Fuentes</h2>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                Auto-refresh cada 15s
                            </div>
                        </div>

                        {status.sources.length === 0 ? (
                            <div className="empty-state">
                                <p>No hay fuentes configuradas.</p>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Estado</th>
                                        <th>Fuente</th>
                                        <th>Última Revisión</th>
                                        <th>Frecuencia</th>
                                        <th>Errores</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {status.sources.map((s) => (
                                        <tr key={s.id}>
                                            <td>
                                                <span
                                                    className={`status-dot ${s.error_count > 0 ? "error" : "online"
                                                        }`}
                                                />
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{s.nombre}</td>
                                            <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                                                {formatDate(s.ultima_revision)}
                                            </td>
                                            <td style={{ color: "var(--text-secondary)" }}>
                                                Cada {s.frecuencia_minutos} min
                                            </td>
                                            <td>
                                                {s.error_count > 0 ? (
                                                    <div>
                                                        <span className="badge badge-error">{s.error_count} errores</span>
                                                        {s.last_error && (
                                                            <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 4 }}>
                                                                {s.last_error.slice(0, 50)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--success)", fontSize: 12 }}>✓ OK</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* System Info */}
                    <div className="card">
                        <div className="card-header">
                            <h2>Información del Sistema</h2>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                                <div className="filter-label">Arquitectura</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    Next.js + Prisma + BullMQ Worker
                                </div>
                            </div>
                            <div>
                                <div className="filter-label">Base de Datos</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    PostgreSQL
                                </div>
                            </div>
                            <div>
                                <div className="filter-label">Cola de Trabajos</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    Redis + BullMQ
                                </div>
                            </div>
                            <div>
                                <div className="filter-label">Escaneo Automático</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    Cada 30 minutos (configurable por fuente)
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="empty-state">
                    <div className="icon">⚠️</div>
                    <p>No se pudo conectar al servidor de monitoreo.</p>
                </div>
            )}
        </>
    );
}
