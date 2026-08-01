"use client";

import { useState } from "react";
import { adminFetch, getAdminToken, setAdminToken } from "@/lib/client/adminToken";

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
    const storedToken = getAdminToken();
    const enteredToken = prompt("Ingresa el token ADMIN_TOKEN configurado en el servidor:", storedToken);
    if (enteredToken === null) return;
    const token = setAdminToken(enteredToken);

    if (!token) {
      setMessage("Se requiere un token administrativo válido.");
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const response = await adminFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ itemId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || data.error || "La acción administrativa no pudo completarse.");
      }

      setMessage("Acción completada.");
    } catch (error) {
      setMessage(error instanceof Error && error.message === "ADMIN_TOKEN_REQUIRED"
        ? "Ingresa el token administrativo para ejecutar esta acción."
        : error instanceof Error ? error.message : "La acción administrativa no pudo completarse.");
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
