"use client";

import { useState } from "react";

export default function EnrichButton({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEnrich = async () => {
    setLoading(true);
    setError("");

    const storageKey = "juridico_admin_token";
    let token = typeof window !== "undefined" ? (localStorage.getItem(storageKey)?.trim() || "") : "";
    const newToken = prompt("Ingresa el token ADMIN_TOKEN configurado en el servidor:", token);
    if (newToken === null) {
      setLoading(false);
      return;
    }
    token = newToken.trim();
    if (!token) {
      setError("Se requiere un token administrativo válido para generar el análisis.");
      setLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, token);
    }

    try {
      const res = await fetch("/api/admin/enrich-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ itemId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al enriquecer el documento");
      }

      alert("¡Análisis IA generado con éxito!");
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      {error && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>⚠️ {error}</span>}
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
