"use client";

import { useState } from "react";

export default function EnrichButton({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEnrich = async () => {
    setLoading(true);
    setError("");

    let token = typeof window !== "undefined" ? (localStorage.getItem("adminToken") || "dev-admin-token") : "dev-admin-token";
    const newToken = prompt("Ingresa el token de administrador:", token);
    if (newToken === null) {
      setLoading(false);
      return;
    }
    if (newToken) {
      token = newToken;
      if (typeof window !== "undefined") {
        localStorage.setItem("adminToken", token);
      }
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
