"use client";

import { useState, useEffect, useCallback } from "react";

interface Notification {
    id: string;
    tipo: string;
    descripcion: string;
    leido: boolean;
    createdAt: string;
    document: {
        id: string;
        titulo: string;
        source: { nombre: string };
    };
}

export default function NotificacionesPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (showUnreadOnly) params.set("unread", "true");
            params.set("limit", "50");

            const res = await fetch(`/api/notifications?${params}`);
            const data = await res.json();
            if (data.ok) {
                setNotifications(data.data);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [showUnreadOnly]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAsRead = async (ids: string[]) => {
        await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
        });
        fetchNotifications();
    };

    const markAllRead = async () => {
        await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true }),
        });
        fetchNotifications();
    };

    const formatDate = (d: string) =>
        new Intl.DateTimeFormat("es-MX", {
            timeZone: "America/Mexico_City",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(d));

    const getIcon = (tipo: string) => {
        if (tipo === "cambio_detectado") return "🔄";
        if (tipo === "nueva_publicacion") return "📄";
        if (tipo === "fuente_error") return "⚠️";
        return "🔔";
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Notificaciones</h1>
                    <p className="subtitle">
                        {unreadCount > 0
                            ? `${unreadCount} sin leer`
                            : "Todas las notificaciones leídas"}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        className={`btn btn-sm ${showUnreadOnly ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                    >
                        {showUnreadOnly ? "Ver todas" : "Solo sin leer"}
                    </button>
                    {unreadCount > 0 && (
                        <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
                            ✓ Marcar todas como leídas
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : notifications.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">🔔</div>
                    <p>
                        {showUnreadOnly
                            ? "No hay notificaciones sin leer."
                            : "No hay notificaciones aún."}
                    </p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            className={`notification-item${!n.leido ? " unread" : ""}`}
                            onClick={() => { if (!n.leido) markAsRead([n.id]); }}
                        >
                            {!n.leido && <span className="notification-dot" />}
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                                    <span style={{ fontSize: 16 }}>{getIcon(n.tipo)}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        {n.tipo.replace(/_/g, " ")}
                                    </span>
                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                        · {n.document?.source?.nombre || ""}
                                    </span>
                                </div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                    {n.descripcion}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                    {n.document?.titulo?.slice(0, 80) || ""}
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                                {formatDate(n.createdAt)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
