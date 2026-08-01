"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Norm {
  id: string;
  nombre: string;
  sigla?: string | null;
  fuente: string;
  matter?: string | null;
  jurisdiction: string;
  verificationStatus: string;
  monitoringStatus: string;
  lastVerifiedAt?: string | null;
  lastReformDate?: string | null;
  versions?: Array<{ publishedAt: string }>;
  urlBase?: string | null;
  practicalUse?: string | null;
}

export default function LeyesVigentesPage() {
  const [norms, setNorms] = useState<Norm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [matter, setMatter] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  useEffect(() => {
    const fetchNorms = async () => {
      try {
        const res = await fetch('/api/norms');
        if (!res.ok) throw new Error('Failed to fetch');
        const payload = (await res.json()) as { data?: Norm[] };
        setNorms(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchNorms();
  }, []);

  const matters = Array.from(
    new Set(norms.map((law) => law.matter).filter((item): item is string => Boolean(item)))
  );
  const jurisdictions = Array.from(new Set(norms.map((law) => law.jurisdiction)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return norms.filter((law) => {
      const matchesMatter = !matter || law.matter === matter;
      const matchesJurisdiction = !jurisdiction || law.jurisdiction === jurisdiction;
      const searchableText = [
        law.nombre,
        law.sigla,
        law.fuente,
        law.matter,
        law.jurisdiction,
        law.practicalUse
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesQuery = !q || searchableText.includes(q);

      return matchesMatter && matchesJurisdiction && matchesQuery;
    });
  }, [norms, query, matter, jurisdiction]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Verificado</span>;
      case 'outdated':
        return <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Desactualizado</span>;
      case 'manual_review':
        return <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Revisión manual requerida</span>;
      case 'error':
        return <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Error de verificación</span>;
      case 'pending':
      default:
        return <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pendiente de verificación</span>;
    }
  };

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell">
        <nav className="document-nav">
          <Link href="/legal-hub">&larr; Volver al Centro Jurídico</Link>
        </nav>

        <section className="legal-hub-hero">
          <span className="badge">Leyes vigentes</span>
          <h1>Ordenamientos clave con liga oficial.</h1>
          <p className="subtitle">
            Consulta rápida por ley, materia y jurisdicción con enlace directo a fuentes oficiales.
          </p>
        </section>

        {!loading && error && (
          <div className="legal-warning glass-card" style={{ marginBottom: '2rem' }}>
            <strong>No fue posible consultar la biblioteca normativa.</strong> Intenta de nuevo más tarde.
          </div>
        )}

        {!loading && !error && norms.length === 0 && (
          <div className="legal-warning glass-card" style={{ marginBottom: '2rem' }}>
            <strong>No hay normas registradas.</strong> El catálogo inicial puede cargarse con el seed; seguirá marcado como pendiente hasta completar una verificación oficial.
          </div>
        )}

        <section className="glass-card legal-form-panel">
          <div className="legal-form-grid">
            <label>
              Buscar por ley o palabra clave
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej. Código de Comercio..." />
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
            <label>
              Jurisdicción
              <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                <option value="">Todas</option>
                {jurisdictions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="legal-hub-grid">
          {loading ? (
            // Skeleton loaders
            Array(6).fill(0).map((_, i) => (
              <article key={i} className="glass-card legal-hub-card" style={{ opacity: 0.7 }}>
                <div style={{ height: '20px', width: '30%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '1rem' }} />
                <div style={{ height: '32px', width: '80%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '0.5rem' }} />
                <div style={{ height: '16px', width: '60%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '1.5rem' }} />
                <div style={{ height: '80px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1rem' }} />
                <div style={{ height: '40px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              </article>
            ))
          ) : filtered.length > 0 ? (
            filtered.map((law) => (
              <article key={law.id} className="glass-card legal-hub-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span className="document-label">{law.matter}</span>
                    {getStatusBadge(law.verificationStatus)}
                  </div>
                  <h2 className="legal-hub-card-title">{law.sigla || law.nombre}</h2>
                  <p className="document-muted"><strong>Nombre:</strong> {law.nombre}</p>
                  {law.practicalUse && <p className="document-muted" style={{ marginTop: '0.5rem' }}>{law.practicalUse}</p>}
                </div>
                <div className="legal-meta-block">
                  <strong>Materia:</strong> {law.matter || 'Sin clasificar'}
                  <br />
                  <strong>Jurisdicción:</strong> {law.jurisdiction}
                  <br />
                  <strong>Última reforma registrada:</strong> {
                    law.versions?.[0]?.publishedAt 
                      ? new Date(law.versions[0].publishedAt).toLocaleDateString('es-MX') 
                      : law.lastVerifiedAt 
                      ? new Date(law.lastVerifiedAt).toLocaleDateString('es-MX') 
                      : 'Monitoreo activo'
                  }
                </div>
                {law.urlBase && (
                  <div className="document-actions">
                    <a href={law.urlBase} target="_blank" rel="noreferrer" className="btn-doc-primary" style={{ width: '100%', textAlign: 'center' }}>
                      Ver fuente oficial
                    </a>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="legal-wide-card glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>No se encontraron normas</h3>
              <p>Intenta ajustar tus filtros de búsqueda.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
