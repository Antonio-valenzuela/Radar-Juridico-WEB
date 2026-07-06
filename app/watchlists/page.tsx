"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Watch = {
  id: string;
  type: string;
  value: string;
};

export default function WatchlistsPage() {
  const [email, setEmail] = useState("");
  const [orgSlug, setOrgSlug] = useState("demo");
  const [type, setType] = useState("keyword");
  const [value, setValue] = useState("");
  const [onlyHighImpact, setOnlyHighImpact] = useState(false);
  const [watchlists, setWatchlists] = useState<Watch[]>([]);
  const [message, setMessage] = useState("");
  const [tenantLabel, setTenantLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query") || "";
    const matter = params.get("matter") || "";
    if (query) setValue(query);
    if (matter) setType("tema");
  }, []);

  async function post(body: Record<string, unknown>) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgSlug, ...body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error");
      if (Array.isArray(data.watchlists)) setWatchlists(data.watchlists);
      if (data.user) setOnlyHighImpact(Boolean(data.user.onlyHighImpact));
      if (data.tenant) {
        setTenantLabel(`${data.tenant.orgSlug} · limite diario ${data.tenant.dailyNotificationLimit}`);
      }
      setMessage("Listo");
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadList() {
    await post({ action: "list" });
  }

  async function addWatch(event: FormEvent) {
    event.preventDefault();
    await post({ action: "add", type, value });
    setValue("");
    await loadList();
  }

  async function removeWatch(id: string) {
    await post({ action: "remove", id });
    await loadList();
  }

  async function saveSettings(next: boolean) {
    setOnlyHighImpact(next);
    await post({ action: "settings", onlyHighImpact: next });
  }

  async function sendTest() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error");
      setMessage(`Prueba enviada. Email=${data.emailOk ? "ok" : "no"} Webhook=${data.webhookOk ? "ok" : "no"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 820, margin: "0 auto" }}>
      <Link href="/" style={{ color: "#111", fontWeight: 700 }}>
        Volver
      </Link>
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Alertas regulatorias</h1>
      <p style={{ color: "#4b5563", marginTop: 0 }}>
        Crea reglas por keyword, norma o tema para recibir digests cuando una publicacion oficial sea relevante.
      </p>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
            Organización
            <input
              value={orgSlug}
              onChange={(event) => setOrgSlug(event.target.value)}
              placeholder="institucion-demo"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              type="email"
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button disabled={loading || !email} onClick={loadList} style={buttonStyle}>
            Cargar
          </button>
          <button disabled={loading || !email} onClick={sendTest} style={buttonStyle}>
            Probar
          </button>
          {tenantLabel ? <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 700 }}>{tenantLabel}</span> : null}
        </div>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={onlyHighImpact}
            onChange={(event) => saveSettings(event.target.checked)}
            disabled={!email || loading}
          />
          Solo alto impacto
        </label>
      </section>

      <form onSubmit={addWatch} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8 }}>
          <select value={type} onChange={(event) => setType(event.target.value)} style={inputStyle}>
            <option value="keyword">Keyword</option>
            <option value="norma">Norma</option>
            <option value="tema">Tema</option>
          </select>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="ej. amparo, CFF, fiscal"
            style={inputStyle}
          />
          <button disabled={loading || !email || !value} style={buttonStyle}>
            Agregar
          </button>
        </div>
      </form>

      {message ? <div style={{ marginBottom: 12, color: "#374151", fontWeight: 700 }}>{message}</div> : null}

      <section>
        <h2 style={{ fontSize: 18 }}>Reglas activas</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {watchlists.map((watch) => (
            <li key={watch.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <span>
                <strong>{watch.type}</strong>: {watch.value}
              </span>
              <button disabled={loading} onClick={() => removeWatch(watch.id)} style={buttonStyle}>
                Quitar
              </button>
            </li>
          ))}
          {watchlists.length === 0 ? (
            <li style={{ border: "1px dashed #d1d5db", borderRadius: 8, padding: 16, color: "#6b7280" }}>
              Carga un email para listar o agrega tu primera watchlist.
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}

const inputStyle = {
  minHeight: 44,
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
} as const;

const buttonStyle = {
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 6,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
} as const;
