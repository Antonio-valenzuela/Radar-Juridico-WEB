"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  getStatusLabel,
  LEGAL_HUB_TABS,
  LEGAL_SOURCE_SHORTCUTS,
  LEGAL_TEMPLATES,
  type LegalHubTabId,
} from "@/lib/legalHub";

export default function LegalHubPage() {
  const [activeTab, setActiveTab] = useState<LegalHubTabId>("materias");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeShortcuts = useMemo(
    () => LEGAL_SOURCE_SHORTCUTS.filter((item) => item.tabId === activeTab),
    [activeTab]
  );
  const activeTabInfo = LEGAL_HUB_TABS.find((tab) => tab.id === activeTab) || LEGAL_HUB_TABS[0];

  async function copyTemplate(id: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <>
      <div className="bg-gradient"></div>

      <header className="header">
        <Link href="/" className="logo">
          <div className="logo-icon"></div>
          Jurídico Radar
        </Link>
        <input type="checkbox" id="legal-menu-toggle" className="menu-toggle" />
        <label htmlFor="legal-menu-toggle" className="menu-icon" aria-label="Abrir menu">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="nav-menu">
          <Link href="/">Dashboard</Link>
          <Link href="/search">Búsqueda</Link>
          <Link href="/documents">Documentos</Link>
          <Link href="/monitoreo">Monitoreo</Link>
          <Link href="/rag">IA Legal</Link>
          <Link href="/watchlists">Alertas</Link>
          {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && process.env.ENABLE_PUBLIC_DEMO !== 'true' && (
            <Link href="/admin/sources">Fuentes</Link>
          )}
        </nav>
      </header>

      <main className="container legal-hub-shell">
        <section className="legal-hub-hero">
          <span className="badge">Centro Jurídico</span>
          <h1>Fuentes, boletines y machotes para litigio.</h1>
          <p className="subtitle">
            Accesos listos para civil, mercantil, CNPCF, jurisprudencia SCJN, boletines judiciales,
            SISE/CJF y formatos base de escritos.
          </p>
          <div className="hero-buttons">
            <Link href="/legal-hub/leyes-vigentes" className="btn-primary" style={{ textDecoration: "none" }}>
              Leyes vigentes
            </Link>
            <Link href="/legal-hub/jurisprudencia" className="btn-primary" style={{ textDecoration: "none" }}>
              Jurisprudencia
            </Link>
            <Link href="/legal-hub/expedientes" className="btn-primary" style={{ textDecoration: "none" }}>
              Expedientes
            </Link>
            <Link href="/legal-hub/machotes" className="btn-primary" style={{ textDecoration: "none" }}>
              Machotes guiados
            </Link>
            <Link href="/admin/sources" className="btn-primary" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "none", textDecoration: "none" }}>
              Ver fuentes oficiales
            </Link>
          </div>
        </section>

        <section className="legal-hub-tabs" aria-label="Pestanas del Centro Juridico">
          {LEGAL_HUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`legal-hub-tab ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </section>

        <section className="glass-card legal-hub-intro">
          <div>
            <span className="document-label">{activeTabInfo.label}</span>
            <h2>{activeTabInfo.description}</h2>
          </div>
          <p className="document-muted">
            Las fuentes marcadas como busqueda externa usan el radar federado. Las que requieren navegador
            quedan identificadas para consulta con acceso autorizado.
          </p>
        </section>

        {activeTab !== "machotes" ? (
          <section className="legal-hub-grid">
            {activeShortcuts.map((item) => (
              <article key={item.id} className="glass-card legal-hub-card">
                <div>
                  <span className="document-label">{item.eyebrow}</span>
                  <h2 className="legal-hub-card-title">{item.title}</h2>
                  <p className="document-muted">{item.description}</p>
                </div>

                <div className="legal-hub-tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="legal-hub-chip">{tag}</span>
                  ))}
                </div>

                <p className={`legal-hub-status status-${item.status}`}>{getStatusLabel(item.status)}</p>

                <div className="document-actions">
                  <Link href={item.href} className="btn-doc-primary">Buscar</Link>
                  {item.sourceHref ? (
                    item.sourceHref.startsWith("http") ? (
                      <a href={item.sourceHref} target="_blank" rel="noreferrer" className="btn-doc-secondary">
                        Abrir fuente
                      </a>
                    ) : (
                      <Link href={item.sourceHref} className="btn-doc-secondary">Abrir fuente</Link>
                    )
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="legal-hub-grid">
            {LEGAL_TEMPLATES.map((template) => (
              <article key={template.id} className="glass-card legal-hub-card template-card">
                <div>
                  <span className="document-label">{template.matter}</span>
                  <h2 className="legal-hub-card-title">{template.title}</h2>
                  <p className="document-muted">{template.description}</p>
                  <p className="legal-hub-usecase">{template.useCase}</p>
                </div>
                <pre className="template-preview">{template.body}</pre>
                <button
                  type="button"
                  className="btn-doc-primary"
                  onClick={() => copyTemplate(template.id, template.body)}
                >
                  {copiedId === template.id ? "Copiado" : "Copiar machote base"}
                </button>
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
