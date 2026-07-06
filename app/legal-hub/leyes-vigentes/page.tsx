"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildLawSearchHref, CURRENT_LEGAL_LAWS } from "@/lib/legalOperations";

export default function LeyesVigentesPage() {
  const [query, setQuery] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [matter, setMatter] = useState("");

  const matters = Array.from(new Set(CURRENT_LEGAL_LAWS.map((law) => law.matter)));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const article = articleQuery.trim().toLowerCase();
    return CURRENT_LEGAL_LAWS.filter((law) => {
      const matchesMatter = !matter || law.matter === matter;
      const searchableText = [
        law.title,
        law.officialName,
        law.matter,
        law.jurisdiction,
        law.practicalUse,
        law.updateNote,
        law.updateStatus,
        law.articleSearchHints.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !q || searchableText.includes(q);
      const matchesArticle = !article || searchableText.includes(article) || /art[ií]culo\s*\d+/i.test(articleQuery);
      return matchesMatter && matchesQuery && matchesArticle;
    });
  }, [articleQuery, matter, query]);

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell">
        <nav className="document-nav">
          <Link href="/legal-hub">Volver al Centro Jurídico</Link>
          <Link href="/search">Búsqueda avanzada</Link>
          <Link href="/admin/sources">Fuentes oficiales</Link>
        </nav>

        <section className="legal-hub-hero">
          <span className="badge">Leyes vigentes</span>
          <h1>Ordenamientos clave con liga oficial.</h1>
          <p className="subtitle">
            Consulta rápida por ley, materia, última reforma conocida, uso práctico y fuente oficial.
          </p>
        </section>

        <section className="glass-card legal-form-panel">
          <div className="legal-form-grid">
            <label>
              Buscar por ley o palabra clave
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Código de Comercio, alimentos, pagaré..." />
            </label>
            <label>
              Artículo o concepto
              <input value={articleQuery} onChange={(e) => setArticleQuery(e.target.value)} placeholder="Artículo 1391, suspensión, audiencia..." />
            </label>
            <label>
              Materia
              <select value={matter} onChange={(e) => setMatter(e.target.value)}>
                <option value="">Todas</option>
                {matters.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="legal-hub-grid">
          {filtered.map((law) => (
            <article key={law.id} className="glass-card legal-hub-card">
              <div>
                <span className="document-label">{law.matter}</span>
                <h2 className="legal-hub-card-title">{law.title}</h2>
                <p className="document-muted"><strong>Nombre oficial:</strong> {law.officialName}</p>
                <p className="document-muted">{law.practicalUse}</p>
              </div>
              <div className="legal-meta-block">
                <strong>Materia:</strong> {law.matter}
                <br />
                <strong>Jurisdicción:</strong> {law.jurisdiction}
                <br />
                <strong>Fuente oficial:</strong> {law.sourceName}
                <br />
                <strong>Última reforma / revisión:</strong> {law.lastKnownReform}
                <br />
                <strong>Estado de actualización:</strong> {law.updateStatus}
                <br />
                <strong>Búsqueda por artículo/concepto:</strong> {law.articleSearchHints.join(", ")}
                <br />
                <strong>Nota:</strong> {law.updateNote}
              </div>
              <div className="document-actions">
                <a href={law.officialUrl} target="_blank" rel="noreferrer" className="btn-doc-primary">Abrir texto oficial</a>
                <Link href={buildLawSearchHref(law, articleQuery || query)} className="btn-doc-secondary">
                  Buscar artículo/concepto
                </Link>
                <Link href={law.searchHref} className="btn-doc-secondary">Buscar ley</Link>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
