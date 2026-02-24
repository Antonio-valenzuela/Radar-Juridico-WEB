"use client";

import { useState } from "react";

export default function RefreshButton() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [msg, setMsg] = useState("");

    const handleRefresh = async () => {
        setLoading(true);
        setStatus("idle");
        setMsg("");

        try {
            const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
            if (!token) {
                throw new Error("Falta NEXT_PUBLIC_ADMIN_TOKEN");
            }

            const res = await fetch("/api/admin/refresh", {
                method: "POST",
                headers: {
                    "x-admin-token": token,
                },
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error desconocido");

            setStatus("success");
            setMsg("Ingesta completada. Recarga la página.");

            // Opcional: auto-recargar
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (e: any) {
            setStatus("error");
            setMsg(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {status === "success" && (
                <span style={{ fontSize: 12, color: "green", fontWeight: 700 }}>{msg}</span>
            )}
            {status === "error" && (
                <span style={{ fontSize: 12, color: "red", fontWeight: 700 }}>{msg}</span>
            )}

            <button
                onClick={handleRefresh}
                disabled={loading}
                style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: loading ? "#f0f0f0" : "#fff",
                    color: loading ? "#999" : "#111",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 12,
                }}
            >
                {loading ? "Cargando..." : "Recargar información"}
            </button>
        </div>
    );
}
