"use client";

import { useState } from "react";

type AdminItemActionButtonProps = {
  itemId: string;
  endpoint: string;
  label: string;
};

export default function AdminItemActionButton({
  itemId,
  endpoint,
  label,
}: AdminItemActionButtonProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const handleAction = async () => {
    const storageKey = "juridico_admin_token";
    const storedToken = localStorage.getItem(storageKey)?.trim() || "";
    const token = prompt("Ingresa el token ADMIN_TOKEN configurado en el servidor:", storedToken)?.trim() || "";

    if (!token) {
      setMessage("Se requiere un token administrativo válido.");
      return;
    }

    localStorage.setItem(storageKey, token);
    setPending(true);
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ itemId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "La acción administrativa no pudo completarse.");
      }

      setMessage("Acción completada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button type="button" className="btn-doc-secondary" onClick={handleAction} disabled={pending}>
        {pending ? "Procesando..." : label}
      </button>
      {message ? <small style={{ color: message === "Acción completada." ? "#34d399" : "#f87171" }}>{message}</small> : null}
    </span>
  );
}
