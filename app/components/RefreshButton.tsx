"use client";

import { useState } from "react";
import { adminFetch, getAdminToken } from "@/lib/client/adminToken";
import { AdminTokenGate } from "@/components/shared/AdminTokenGate";

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [showTokenGate, setShowTokenGate] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setStatus("idle");
    setMsg("");
    setShowTokenGate(false);

    try {
      let token = getAdminToken();
      if (!token) {
        setShowTokenGate(true);
        setLoading(false);
        return;
      }
      const res = await adminFetch("/api/run-now", { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");

      setStatus("success");
      setMsg("Actualizando. La lista se recargara en unos segundos.");
      setTimeout(() => window.location.reload(), 3500);
    } catch (error: unknown) {
      setStatus("error");
      setMsg(error instanceof Error && error.message === "ADMIN_TOKEN_REQUIRED" ? "Ingresa un token administrativo válido." : "No fue posible actualizar las fuentes.");
    } finally {
      if (getAdminToken()) {
        setLoading(false);
      }
    }
  };

  if (showTokenGate) {
    return <AdminTokenGate context="para actualizar las fuentes" onTokenSaved={handleRefresh} />;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
          border: "1px solid #111827",
          background: loading ? "#e5e7eb" : "#111827",
          color: loading ? "#6b7280" : "#ffffff",
          fontWeight: 800,
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 16,
          minHeight: 48,
          minWidth: 190,
        }}
      >
        {loading ? "Cargando..." : "Actualizar ahora"}
      </button>
    </div>
  );
}
