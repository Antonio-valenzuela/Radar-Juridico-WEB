"use client";

import { useState } from "react";
import { adminFetch, getAdminToken, setAdminToken } from "@/lib/client/adminToken";

export default function EnrichButton({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleEnrich = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    let token = getAdminToken();
    const newToken = prompt("Ingresa el token ADMIN_TOKEN configurado en el servidor:", token);
    if (newToken === null) {
      setLoading(false);
      return;
    }
    token = setAdminToken(newToken);
    if (!token) {
      setError("Se requiere un token administrativo válido para generar el análisis.");
      setLoading(false);
      return;
    }

    try {
      const res = await adminFetch("/api/admin/enrich-item", {
        method: "POST",
        body: JSON.stringify({ itemId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "No fue posible generar el análisis IA.");
      }

      setSuccess("Análisis IA generado correctamente.");
    } catch (err: unknown) {
      setError(err instanceof Error && err.message === "ADMIN_TOKEN_REQUIRED"
        ? "Ingresa el token administrativo para ejecutar esta acción."
        : err instanceof Error ? err.message : "No fue posible generar el análisis IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      {error && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>⚠️ {error}</span>}
      {success && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>✓ {success}</span>}
      <button
        onClick={handleEnrich}
        disabled={loading}
        className="btn-doc-primary"
      >
        {loading ? "Generando..." : "Generar análisis IA"}
      </button>
    </div>
  );
}
