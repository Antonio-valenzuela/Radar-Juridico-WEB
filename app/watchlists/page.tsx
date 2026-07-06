"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type AlertRuleItem = {
  id: string;
  type: string;
  value: string;
};

type RecentChange = {
  id: string;
  changeDescription: string;
  detectedAt: string;
  matter: string | null;
  sourceUrl: string | null;
  document?: {
    title: string;
    shortCode: string | null;
    officialUrl: string | null;
  };
};

const TYPE_LABELS: Record<string, string> = {
  keyword: "Palabra clave",
  norma: "Norma",
  tema: "Materia",
};

export default function WatchlistsPage() {
  const [email, setEmail] = useState("");
  const [orgSlug, setOrgSlug] = useState("demo");
  const [type, setType] = useState("keyword");
  const [value, setValue] = useState("");
  const [onlyHighImpact, setOnlyHighImpact] = useState(false);
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [changes, setChanges] = useState<RecentChange[]>([]);
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

  useEffect(() => {
    loadRecentChanges();
  }, []);

  async function loadRecentChanges() {
    try {
      const res = await fetch("/api/monitoring/changes?days=30&limit=5");
      const data = await res.json();
      if (Array.isArray(data.changes)) setChanges(data.changes);
    } catch {
      setChanges([]);
    }
  }

  function publicMessage(action: string) {
    if (action === "add") return "Alerta guardada. Se revisará contra los cambios indexados.";
    if (action === "remove") return "Alerta desactivada.";
    if (action === "settings") return "Preferencias actualizadas.";
    return "Alertas cargadas.";
  }

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
      if (!res.ok || !data.ok) throw new Error("No se pudo actualizar la alerta.");
      if (Array.isArray(data.watchlists)) setRules(data.watchlists);
      if (data.user) setOnlyHighImpact(Boolean(data.user.onlyHighImpact));
      if (data.tenant) setTenantLabel(`Organización ${data.tenant.orgSlug}`);
      setMessage(publicMessage(String(body.action || "list")));
      return data;
    } catch {
      setMessage("No se pudo actualizar la alerta. Verifica el correo y vuelve a intentar.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadList() {
    await post({ action: "list" });
  }

  async function addRule(event: FormEvent) {
    event.preventDefault();
    await post({ action: "add", type, value });
    setValue("");
    await loadList();
  }

  async function removeRule(id: string) {
    await post({ action: "remove", id });
    await loadList();
  }

  async function saveSettings(next: boolean) {
    setOnlyHighImpact(next);
    await post({ action: "settings", onlyHighImpact: next });
  }

  return (
    <>
      <div className="bg-gradient"></div>

      <header className="header">
        <Link href="/" className="logo">
          <div className="logo-icon"></div>
          Jurídico Radar
        </Link>
        <input type="checkbox" id="alerts-menu-toggle" className="menu-toggle" />
        <label htmlFor="alerts-menu-toggle" className="menu-icon" aria-label="Abrir menu">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="nav-menu">
          <Link href="/">Dashboard</Link>
          <Link href="/search">Búsqueda</Link>
          <Link href="/documents">Documentos</Link>
          <Link href="/monitoreo">Monitoreo</Link>
          <Link href="/watchlists">Alertas</Link>
          <Link href="/legal-hub">Centro Jurídico</Link>
        </nav>
      </header>

      <main className="container alerts-shell">
        <section className="alerts-hero">
          <span className="badge">Alertas</span>
          <h1>Mis alertas legales</h1>
          <p className="subtitle">
            Crea reglas por materia, norma o palabra clave para revisar cambios relevantes sin perder de vista
            la fuente oficial.
          </p>
        </section>

        <section className="alerts-layout">
          <div className="glass-card alerts-panel">
            <div className="alerts-panel-heading">
              <span className="document-label">Crear alerta</span>
              <h2>Crear alerta</h2>
              <p className="document-muted">
                Usa términos concretos como amparo, CNPCF, Código de Comercio o penal.
              </p>
            </div>

            <div className="alerts-account-grid">
              <label>
                Organización
                <input value={orgSlug} onChange={(event) => setOrgSlug(event.target.value)} placeholder="demo" />
              </label>
              <label>
                Correo
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="abogado@despacho.com" type="email" />
              </label>
            </div>

            <div className="alerts-actions-row">
              <button type="button" disabled={loading || !email} onClick={loadList} className="btn-doc-secondary">
                Consultar alertas
              </button>
              {tenantLabel ? <span className="alerts-tenant">{tenantLabel}</span> : null}
            </div>

            <label className="alerts-check">
              <input
                type="checkbox"
                checked={onlyHighImpact}
                onChange={(event) => saveSettings(event.target.checked)}
                disabled={!email || loading}
              />
              Avisarme solo cuando el cambio sea relevante
            </label>

            <form onSubmit={addRule} className="alerts-rule-form">
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="keyword">Palabra clave</option>
                <option value="norma">Norma</option>
                <option value="tema">Materia</option>
              </select>
              <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="ej. amparo, CNPCF, mercantil" />
              <button disabled={loading || !email || !value} className="btn-doc-primary">
                Guardar alerta
              </button>
            </form>

            {message ? <div className="alerts-message">{message}</div> : null}
          </div>

          <div className="glass-card alerts-panel">
            <div className="alerts-panel-heading">
              <span className="document-label">Reglas activas</span>
              <h2>Reglas activas</h2>
              <p className="document-muted">
                Estas reglas sirven para revisar cambios indexados y preparar seguimiento jurídico.
              </p>
            </div>

            <div className="alerts-rule-list">
              {rules.map((rule) => (
                <article key={rule.id} className="alerts-rule-card">
                  <div>
                    <strong>{TYPE_LABELS[rule.type] || rule.type}</strong>
                    <span>{rule.value}</span>
                  </div>
                  <button disabled={loading} onClick={() => removeRule(rule.id)} className="btn-doc-secondary">
                    Quitar
                  </button>
                </article>
              ))}
              {rules.length === 0 ? (
                <div className="alerts-empty">
                  Ingresa tu correo y consulta tus reglas, o crea una alerta nueva.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="glass-card alerts-panel">
          <div className="alerts-panel-heading">
            <span className="document-label">Cambios recientes</span>
            <h2>Cambios recientes</h2>
            <p className="document-muted">
              Señales detectadas por el monitor. Antes de actuar, abre y revisa la fuente oficial.
            </p>
          </div>

          <div className="alerts-change-list">
            {changes.map((change) => (
              <article key={change.id} className="alerts-change-card">
                <div>
                  <strong>{change.document?.title || "Documento monitoreado"}</strong>
                  <p>{change.changeDescription}</p>
                  <small>{change.matter || "materia pendiente"} · {new Date(change.detectedAt).toLocaleDateString("es-MX")}</small>
                </div>
                <a href={change.sourceUrl || change.document?.officialUrl || "#"} target="_blank" rel="noreferrer" className="btn-doc-secondary">
                  Abrir fuente
                </a>
              </article>
            ))}
            {changes.length === 0 ? (
              <div className="alerts-empty">No hay cambios indexados para el periodo consultado.</div>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}
