"use client";

import { useEffect, useState } from "react";
import { clearAdminToken, getAdminToken, setAdminToken } from "@/lib/client/adminToken";

interface AdminTokenGateProps {
  /** Se llama cuando el token queda guardado. Útil para disparar la acción pendiente. */
  onTokenSaved?: () => void;
  /** Texto descriptivo sobre para qué se necesita el token (ej. "para gestionar alertas"). */
  context?: string;
}

/**
 * Panel inline de token administrativo.
 * Muestra campo de contraseña + botones "Guardar token" / "Borrar token".
 * No abre ningún modal ni window.prompt.
 */
export function AdminTokenGate({ onTokenSaved, context = "para ejecutar esta acción" }: AdminTokenGateProps) {
  const [input, setInput] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [showField, setShowToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = getAdminToken();
    setHasToken(Boolean(token));
    setInput(token ?? "");
  }, []);

  const persist = () => {
    const saved = setAdminToken(input);
    setHasToken(Boolean(saved));
    if (saved) {
      setMessage("Token guardado.");
      setShowToken(false);
      onTokenSaved?.();
    } else {
      setMessage("El token no puede estar vacío.");
    }
  };

  const forget = () => {
    clearAdminToken();
    setHasToken(false);
    setInput("");
    setMessage("Token administrativo eliminado de este navegador.");
  };

  if (hasToken) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Token administrativo guardado</span>
        <button type="button" className="btn-doc-secondary" onClick={forget} style={{ fontSize: "0.8rem" }}>
          Borrar token
        </button>
        {message && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{message}</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--warning-bg)",
        border: "1px solid var(--warning)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-4)",
        display: "grid",
        gap: "var(--space-3)",
      }}
    >
      <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
        Se necesita el token administrativo {context}.
      </p>

      {showField ? (
        <>
          <label style={{ display: "grid", gap: "var(--space-1)", fontSize: "0.875rem" }}>
            Token administrativo
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") persist(); }}
                autoComplete="off"
                style={{ flex: 1 }}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button
                type="button"
                className="btn-doc-secondary"
                onClick={() => setShowPassword((v) => !v)}
                style={{ fontSize: "0.8rem" }}
                aria-label={showPassword ? "Ocultar token" : "Mostrar token"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <button type="button" className="btn-doc-secondary" onClick={persist}>
              Guardar token
            </button>
            <button type="button" className="btn-doc-secondary" onClick={() => setShowToken(false)}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn-doc-secondary" onClick={() => setShowToken(true)}>
          Ingresar token administrativo
        </button>
      )}

      {message && (
        <p role="status" style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
