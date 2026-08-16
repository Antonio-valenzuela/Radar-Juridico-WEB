"use client";

import Link from "next/link";
import { useState } from "react";

interface JurisprudenciaResult {
  id: string;
  registroDigital?: string | null;
  rubro: string;
  text: string;
  type: string;
  matter: string;
  epoch?: string | null;
  instance?: string | null;
  issuingBody?: string | null;
  publicationDate?: string | null;
  verificationStatus: string;
  officialUrl?: string | null;
  precedents?: Array<{
    id: string;
    relatedRegistro?: string | null;
    description?: string | null;
  }>;
  contradictions?: Array<{
    id: string;
    contradictionId?: string | null;
    description?: string | null;
  }>;
}

export default function JurisprudenciaPage() {
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<JurisprudenciaResult[]>([]);
  const [error, setError] = useState(false);

  const [form, setForm] = useState({
    keyword: "",
    materia: "",
    registroDigital: "",
    organoEmisor: "",
    epoca: "",
    tipoCriterio: "",
    fechaPublicacion: "",
    temaJuridico: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setHasSearched(true);

    try {
      const res = await fetch('/api/jurisprudencia/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!res.ok) throw new Error('Search failed');
      const payload = (await res.json()) as { data?: JurisprudenciaResult[] };
      setResults(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setError(true);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Verificado</span>;
      case 'outdated':
        return <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Superado/Contradicción</span>;
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
          <Link href="/legal-hub">Volver al Centro Jurídico</Link>
          <a href="https://sjf2.scjn.gob.mx" target="_blank" rel="noreferrer">SJF Oficial (SCJN)</a>
        </nav>

        <section className="legal-hub-hero" style={{ paddingBottom: '1rem' }}>
          <span className="badge">Jurisprudencia y Tesis</span>
          <h1>Buscador de Criterios</h1>
          <p className="subtitle">
            Consulta la base de datos local de criterios jurisprudenciales y tesis aisladas.
          </p>
        </section>

        <div className="legal-warning jr-card" style={{ marginBottom: '2rem' }}>
          <strong>Revisión profesional requerida:</strong>
          <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li>Confirma el tipo, la vigencia y la aplicabilidad del criterio al caso concreto.</li>
            <li>Revisa precedentes, contradicciones y criterios posteriores en la fuente oficial.</li>
            <li>Valida el registro digital y el texto directamente en SJF antes de citar.</li>
          </ul>
        </div>

        <section className="jr-card legal-form-panel">
          <form onSubmit={handleSearch} className="legal-form-grid">
            <label>
              Búsqueda Libre
              <input name="keyword" value={form.keyword} onChange={handleChange} placeholder="Ej. Pagaré intereses usureros..." />
            </label>
            <label>
              Registro Digital
              <input name="registroDigital" value={form.registroDigital} onChange={handleChange} placeholder="Ej. 2021234" />
            </label>
            <label>
              Materia
              <select name="materia" value={form.materia} onChange={handleChange}>
                <option value="">Todas</option>
                <option value="Constitucional">Constitucional</option>
                <option value="Penal">Penal</option>
                <option value="Civil">Civil</option>
                <option value="Administrativa">Administrativa</option>
                <option value="Laboral">Laboral</option>
                <option value="Común">Común</option>
              </select>
            </label>
            <label>
              Tipo de Criterio
              <select name="tipoCriterio" value={form.tipoCriterio} onChange={handleChange}>
                <option value="">Todos</option>
                <option value="Jurisprudencia">Jurisprudencia</option>
                <option value="Tesis aislada">Tesis aislada</option>
              </select>
            </label>
            <label>
              Época
              <select name="epoca" value={form.epoca} onChange={handleChange}>
                <option value="">Todas</option>
                <option value="Undécima Época">Undécima Época</option>
                <option value="Décima Época">Décima Época</option>
                <option value="Novena Época">Novena Época</option>
              </select>
            </label>
            <label>
              Órgano Emisor
              <input name="organoEmisor" value={form.organoEmisor} onChange={handleChange} placeholder="Ej. Primera Sala" />
            </label>
            <label>
              Fecha de publicación
              <input type="date" name="fechaPublicacion" value={form.fechaPublicacion} onChange={handleChange} />
            </label>
            <label>
              Tema jurídico
              <input name="temaJuridico" value={form.temaJuridico} onChange={handleChange} placeholder="Ej. alimentos" />
            </label>

            <div className="legal-wide-card" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-doc-primary" disabled={loading} style={{ minHeight: '44px' }}>
                {loading ? 'Buscando...' : 'Buscar Criterios'}
              </button>
            </div>
          </form>
        </section>

        <section className="legal-hub-grid" style={{ gridTemplateColumns: '1fr' }}>
          {loading && (
            Array(3).fill(0).map((_, i) => (
              <article key={i} className="jr-card legal-hub-card" style={{ opacity: 0.7 }}>
                <div style={{ height: '24px', width: '20%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '1rem' }} />
                <div style={{ height: '32px', width: '90%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '1rem' }} />
                <div style={{ height: '100px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1rem' }} />
                <div style={{ height: '40px', width: '200px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              </article>
            ))
          )}

          {!loading && hasSearched && results.length === 0 && !error && (
            <div className="legal-wide-card jr-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>No se encontraron criterios jurídicos verificados en la base local.</h3>
              <p style={{ marginBottom: '1.5rem' }}>Verifica los términos de búsqueda o consulta directamente la fuente oficial.</p>
              <a href="https://sjf2.scjn.gob.mx" target="_blank" rel="noreferrer" className="btn-doc-primary">
                Buscar en SJF Oficial (SCJN)
              </a>
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="legal-wide-card jr-card" style={{ textAlign: 'center', padding: '3rem', borderColor: '#ef4444' }}>
              <h3 style={{ color: '#ef4444' }}>Error de conexión</h3>
              <p>No se pudo realizar la búsqueda. Por favor intente más tarde.</p>
            </div>
          )}

          {!loading && results.length > 0 && results.map((item) => (
            <article key={item.id} className="jr-card legal-hub-card" style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <span className="document-label" style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '4px 10px', borderRadius: '4px' }}>{item.type}</span>
                  <span className="document-label">{item.matter}</span>
                  {item.registroDigital && (
                    <span className="document-label" style={{ color: '#c4b5fd' }}>Reg: {item.registroDigital}</span>
                  )}
                  <div style={{ marginLeft: 'auto' }}>
                    {getStatusBadge(item.verificationStatus)}
                  </div>
                </div>

                <h2 className="legal-hub-card-title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{item.rubro}</h2>

                <div className="legal-preview" style={{ minHeight: 'auto', maxHeight: '180px', padding: '1rem', fontSize: '0.9rem', marginBottom: '1.5rem', position: 'relative' }}>
                  {item.text}
                  {item.text.length > 500 && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, rgba(2, 6, 23, 1))' }}></div>
                  )}
                </div>

                <div className="legal-meta-block" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><strong>Época:</strong> {item.epoch || 'No registrada'}</div>
                  <div><strong>Instancia:</strong> {item.instance || 'No registrada'}</div>
                  <div><strong>Órgano:</strong> {item.issuingBody || 'No registrado'}</div>
                  <div><strong>Publicación:</strong> {item.publicationDate ? new Date(item.publicationDate).toLocaleDateString('es-MX') : 'No registrada'}</div>
                </div>
                {Boolean(item.precedents?.length || item.contradictions?.length) && (
                  <div className="legal-meta-block" style={{ marginTop: '1rem' }}>
                    {item.precedents && item.precedents.length > 0 && (
                      <>
                        <strong>Precedentes registrados</strong>
                        <ul>
                          {item.precedents.map((precedent) => (
                            <li key={precedent.id}>
                              {[precedent.relatedRegistro, precedent.description]
                                .filter(Boolean)
                                .join(' — ')}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {item.contradictions && item.contradictions.length > 0 && (
                      <>
                        <strong>Contradicciones registradas</strong>
                        <ul>
                          {item.contradictions.map((contradiction) => (
                            <li key={contradiction.id}>
                              {[contradiction.contradictionId, contradiction.description]
                                .filter(Boolean)
                                .join(' — ')}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>

              {item.officialUrl && (
                <div className="document-actions">
                  <a href={item.officialUrl} target="_blank" rel="noreferrer" className="btn-doc-primary">
                    Ver fuente oficial
                  </a>
                </div>
              )}
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
