'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { SourceHealthResult, SourceHealthStatus } from '@/lib/sources/sourceHealth';

interface FetchLog {
  id: string;
  status: string;
  foundItems: number;
  savedItems: number;
  duplicateItems: number;
  errorCategory: string | null;
  durationMs: number;
  createdAt: string;
}

interface OfficialSource {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  adapter: string;
  healthUrl: string | null;
  requiresBrowser: boolean;
  type: string;
  jurisdiction: string;
  country: string;
  state: string | null;
  matter: string | null;
  description: string | null;
  isActive: boolean;
  isOfficial: boolean;
  trustLevel: string;
  crawlMode: string;
  refreshFrequency: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCategory: string | null;
  fetchLogs?: FetchLog[];
}

interface ManualIngestResult {
  ok: boolean;
  found: number;
  saved: number;
  duplicates: number;
  errors: string[];
  warnings?: string[];
  message?: string;
  sample?: Array<{ title: string; url: string; published?: string }>;
}

const HEALTH_LABELS: Record<SourceHealthStatus, string> = {
  OK: 'Accesible',
  REDIRECT_BLOCKED: 'Redirección insegura bloqueada',
  BLOCKED_BY_PROVIDER: 'Bloqueado por proveedor externo, requiere navegador/Playwright',
  NOT_FOUND: 'Ruta configurada incorrecta',
  FETCH_ERROR: 'Error de red/TLS/DNS',
  BROWSER_REQUIRED: 'Bloqueado por proveedor externo, requiere navegador/Playwright',
  WARNING_ACCESSIBLE_WITH_LIMITATIONS: 'Accesible con limitaciones',
};

function healthLabel(result: SourceHealthResult) {
  const label = HEALTH_LABELS[result.status] || result.message;
  if (result.status === 'FETCH_ERROR' && result.error?.causeCode) {
    return `${label}: ${result.error.causeCode}`;
  }
  return label;
}

function healthColor(status: SourceHealthStatus) {
  if (status === 'OK') return '#34d399';
  if (['BLOCKED_BY_PROVIDER', 'BROWSER_REQUIRED', 'WARNING_ACCESSIBLE_WITH_LIMITATIONS'].includes(status)) {
    return '#fbbf24';
  }
  return '#f87171';
}

async function fetchJsonSafe(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  // Response is NOT JSON (likely HTML error page, 502 proxy error, etc.)
  const text = await res.text();
  const preview = text.slice(0, 300).replace(/\n/g, ' ');
  throw new Error(
    `La API devolvió ${contentType || 'contenido desconocido'} (HTTP ${res.status}) en lugar de JSON. ` +
    `Revisa que la ruta exista y que el backend esté funcionando correctamente. ` +
    `Preview: ${preview}`
  );
}

export default function AdminSourcesPage() {
  const [token, setToken] = useState('dev-admin-token');
  const [sources, setSources] = useState<OfficialSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formType, setFormType] = useState('manual_url');
  const [formJurisdiction, setFormJurisdiction] = useState('MX');
  const [formCountry, setFormCountry] = useState('MX');
  const [formState, setFormState] = useState('');
  const [formMatter, setFormMatter] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsOfficial, setFormIsOfficial] = useState(true);
  const [formTrustLevel, setFormTrustLevel] = useState('official');
  const [formCrawlMode, setFormCrawlMode] = useState('manual_url');
  const [formRefreshFrequency, setFormRefreshFrequency] = useState('daily');

  // Test and Ingest actions maps
  const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; data?: SourceHealthResult; error?: string }>>({});
  const [ingestStatus, setIngestStatus] = useState<Record<string, { loading: boolean; data?: ManualIngestResult; error?: string }>>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('juridico_admin_token');
    if (saved) {
      setToken(saved);
    }
  }, []);

  const handleTokenChange = (v: string) => {
    setToken(v);
    localStorage.setItem('juridico_admin_token', v);
  };

  const fetchSources = useCallback(async () => {
    if (!token.trim()) {
      setError('Escribe el Admin Token local.');
      return;
    }
    // Cancelar fetch anterior
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Timeout de cliente de 15s
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/sources', {
        headers: { 'x-admin-token': token.trim() },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.status === 401) {
        throw new Error('Token de administrador no autorizado. Revisa tu token.');
      }
      const data = await fetchJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.message || 'Error al obtener fuentes.');
      }
      setSources(data.sources || []);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('La carga excedió el tiempo límite (15s). Verifica que el backend esté funcionando.');
      } else {
        setError(err.message || 'Error de conexión.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [token]);

  // Debounce: esperar 600ms después de cambio de token antes de recargar
  useEffect(() => {
    if (!token) return;
    const debounceId = setTimeout(() => {
      fetchSources().catch(() => {});
    }, 600);
    return () => clearTimeout(debounceId);
  }, [token, fetchSources]);

  const resetForm = () => {
    setEditId(null);
    setFormName('');
    setFormSlug('');
    setFormBaseUrl('');
    setFormType('manual_url');
    setFormJurisdiction('MX');
    setFormCountry('MX');
    setFormState('');
    setFormMatter('');
    setFormDescription('');
    setFormIsActive(true);
    setFormIsOfficial(true);
    setFormTrustLevel('official');
    setFormCrawlMode('manual_url');
    setFormRefreshFrequency('daily');
  };

  const handleEditClick = (s: OfficialSource) => {
    setEditId(s.id);
    setFormName(s.name);
    setFormSlug(s.slug);
    setFormBaseUrl(s.baseUrl);
    setFormType(s.type);
    setFormJurisdiction(s.jurisdiction);
    setFormCountry(s.country);
    setFormState(s.state || '');
    setFormMatter(s.matter || '');
    setFormDescription(s.description || '');
    setFormIsActive(s.isActive);
    setFormIsOfficial(s.isOfficial);
    setFormTrustLevel(s.trustLevel);
    setFormCrawlMode(s.crawlMode);
    setFormRefreshFrequency(s.refreshFrequency);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formName.trim() || !formSlug.trim() || !formBaseUrl.trim() || !formType.trim()) {
      setError('Nombre, slug, URL base y tipo son campos requeridos.');
      return;
    }

    const payload = {
      name: formName.trim(),
      slug: formSlug.trim(),
      baseUrl: formBaseUrl.trim(),
      type: formType.trim(),
      jurisdiction: formJurisdiction.trim(),
      country: formCountry.trim(),
      state: formState.trim() || null,
      matter: formMatter.trim() || null,
      description: formDescription.trim() || null,
      isActive: formIsActive,
      isOfficial: formIsOfficial,
      trustLevel: formTrustLevel,
      crawlMode: formCrawlMode,
      refreshFrequency: formRefreshFrequency,
    };

    try {
      const url = editId ? `/api/admin/sources/${editId}` : '/api/admin/sources';
      const method = editId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify(payload),
      });

      const data = await fetchJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar la fuente.');
      }

      setSuccess(editId ? 'Fuente actualizada con éxito.' : 'Nueva fuente registrada con éxito.');
      resetForm();
      fetchSources();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar la fuente.');
    }
  };

  const handleToggleActive = async (s: OfficialSource) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/sources/${s.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      const data = await fetchJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.message || 'Error al cambiar estatus.');
      }
      setSuccess(`Fuente '${s.name}' ${!s.isActive ? 'activada' : 'desactivada'} correctamente.`);
      fetchSources();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estatus.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas desactivar (borrado lógico) la fuente '${name}'?`)) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/sources/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-token': token.trim(),
        },
      });
      const data = await fetchJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.message || 'Error al desactivar la fuente.');
      }
      setSuccess(`La fuente '${name}' ha sido desactivada.`);
      fetchSources();
    } catch (err: any) {
      setError(err.message || 'Error al desactivar.');
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestStatus(prev => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch('/api/admin/source-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify({ id }),
      });
      const data = await fetchJsonSafe(res);
      setTestStatus(prev => ({ ...prev, [id]: { loading: false, data } }));
      fetchSources(); // Actualiza timestamps de checks
    } catch (err: any) {
      setTestStatus(prev => ({ ...prev, [id]: { loading: false, error: err.message } }));
    }
  };

  const handleIngest = async (id: string) => {
    setIngestStatus(prev => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch('/api/admin/source-ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify({ id }),
      });
      const data = await fetchJsonSafe(res);
      setIngestStatus(prev => ({ ...prev, [id]: { loading: false, data } }));
      fetchSources(); // Recargar para ver los logs actualizados y tiempos de sync
    } catch (err: any) {
      setIngestStatus(prev => ({ ...prev, [id]: { loading: false, error: err.message } }));
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginBottom: '1.5rem' }}>
        &larr; Volver al Dashboard
      </Link>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1>Fuentes Oficiales</h1>
          <p style={{ color: 'var(--text-muted)' }}>Administra los portales jurídicos y URLs autorizadas para la ingesta y RAG de Jurídico Radar.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Admin Token:</label>
          <input 
            type="password" 
            value={token} 
            onChange={(e) => handleTokenChange(e.target.value)} 
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--card-border)', background: '#0f172a', color: 'white', fontSize: '0.9rem', width: '160px' }}
          />
          <button onClick={fetchSources} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem', boxShadow: 'none' }} disabled={loading}>
            {loading ? 'Cargando...' : 'Cargar'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <span>⚠️ <strong>Error:</strong> {error}</span>
          <button onClick={() => fetchSources()} className="btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', background: '#3b82f6', boxShadow: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            🔄 Reintentar
          </button>
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#a7f3d0', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          ✓ {success}
        </div>
      )}

      {/* Grid containing Registry form and Status log details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2.5rem' }}>
        
        {/* FORM CARD */}
        <div className="glass-card">
          <h2>{editId ? 'Editar Fuente Oficial' : 'Registrar Nueva Fuente Oficial'}</h2>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Nombre de la Fuente *</label>
              <input 
                type="text" 
                placeholder="Ej. Diario Oficial de la Federación"
                value={formName} 
                onChange={e => setFormName(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Slug Único *</label>
              <input 
                type="text" 
                placeholder="Ej. dof_web"
                value={formSlug} 
                onChange={e => setFormSlug(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
                disabled={editId !== null}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: 'span 2' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>URL Base (Debe ser HTTPS) *</label>
              <input 
                type="url" 
                placeholder="Ej. https://www.dof.gob.mx"
                value={formBaseUrl} 
                onChange={e => setFormBaseUrl(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Tipo / Adaptador *</label>
              <select 
                value={formType} 
                onChange={e => setFormType(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              >
                <option value="sidof">SIDOF (Nativo)</option>
                <option value="diputados">Cámara de Diputados (Nativo)</option>
                <option value="scjn_sjf">SCJN Semanario (Nativo)</option>
                <option value="scjn_leg">SCJN Legislación (Nativo)</option>
                <option value="dof_web">DOF Web Scraper (Nativo)</option>
                <option value="rss">Canal RSS (XML)</option>
                <option value="manual_url">Página Web Única (HTML)</option>
                <option value="search_only">Sólo Búsqueda Externa (Tavily Restricted)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Modo de Ingesta *</label>
              <select 
                value={formCrawlMode} 
                onChange={e => setFormCrawlMode(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              >
                <option value="api">API / Native Ingestor</option>
                <option value="rss">Crawl Canal RSS</option>
                <option value="manual_url">Scrape URL HTML Directo</option>
                <option value="search_only">Sin ingesta activa (Sólo RAG)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Jurisdicción</label>
              <input 
                type="text" 
                value={formJurisdiction} 
                onChange={e => setFormJurisdiction(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>País</label>
              <input 
                type="text" 
                value={formCountry} 
                onChange={e => setFormCountry(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Estado / Entidad (Opcional)</label>
              <input 
                type="text" 
                placeholder="Ej. CDMX"
                value={formState} 
                onChange={e => setFormState(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Materia (Opcional)</label>
              <input 
                type="text" 
                placeholder="Ej. Fiscal, Constitucional"
                value={formMatter} 
                onChange={e => setFormMatter(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Frecuencia de Actualización</label>
              <select 
                value={formRefreshFrequency} 
                onChange={e => setFormRefreshFrequency(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              >
                <option value="hourly">Cada hora</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="manual">Sólo manual</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Nivel de Confianza</label>
              <select 
                value={formTrustLevel} 
                onChange={e => setFormTrustLevel(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              >
                <option value="official">Máxima Oficial (Gubernamental)</option>
                <option value="high">Alta (Institucional/SCJN)</option>
                <option value="medium">Media (Noticieros jurídicos autorizados)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: 'span 2' }}>
              <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Descripción</label>
              <textarea 
                rows={2}
                placeholder="Detalle sobre los alcances y contenidos de la fuente jurídica..."
                value={formDescription} 
                onChange={e => setFormDescription(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', gridColumn: 'span 2', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem' }}>
                <input 
                  type="checkbox" 
                  checked={formIsActive} 
                  onChange={e => setFormIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                Fuente Activa (Habilita ingestas y consultas)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem' }}>
                <input 
                  type="checkbox" 
                  checked={formIsOfficial} 
                  onChange={e => setFormIsOfficial(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                Es Portal Oficial del Gobierno
              </label>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ padding: '0.7rem 2.5rem' }}>
                {editId ? 'Guardar Cambios' : 'Registrar Fuente'}
              </button>
              {editId && (
                <button type="button" onClick={resetForm} className="btn-primary" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'none' }}>
                  Cancelar Edición
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LIST CARD */}
        <div className="glass-card">
          <h2>Fuentes Registradas ({sources.length})</h2>
          {sources.length === 0 ? (
            <p className="text-muted" style={{ padding: '2rem 0', textAlign: 'center' }}>No hay fuentes oficiales cargadas o el admin token no ha sido ingresado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {sources.map((s) => {
                const tStatus = testStatus[s.id];
                const iStatus = ingestStatus[s.id];

                return (
                  <div key={s.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', transition: 'border-color 0.2s' }}>
                    
                    {/* Source Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>{s.name}</h3>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', fontWeight: 'bold' }}>
                            {s.slug.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: s.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: s.isActive ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                            {s.isActive ? 'ACTIVA' : 'INACTIVA'}
                          </span>
                          {s.isOfficial && (
                            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 'bold' }}>
                              GOB.MX
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          URL Base: <a href={s.baseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{s.baseUrl}</a>
                        </p>
                      </div>

                      {/* Top Action buttons */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleEditClick(s)} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#4b5563', boxShadow: 'none' }}>
                          Editar
                        </button>
                        <button onClick={() => handleToggleActive(s)} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: s.isActive ? '#d97706' : '#16a34a', boxShadow: 'none' }}>
                          {s.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleDelete(s.id, s.name)} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#dc2626', boxShadow: 'none' }}>
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Sync Status Columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Adaptador / Crawl Mode</div>
                        <div style={{ fontWeight: 'bold' }}>{s.type.toUpperCase()} ({s.crawlMode})</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Filtros & Nivel Confianza</div>
                        <div>Materia: {s.matter || 'Todas'} | Nivel: {s.trustLevel}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Último Chequeo</div>
                        <div>{s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString('es-MX') : 'Nunca'}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Último Éxito / Error</div>
                        <div style={{ color: s.lastFailureAt ? '#fca5a5' : '#a7f3d0' }}>
                          {s.lastSuccessAt ? 'Éxito: ' + new Date(s.lastSuccessAt).toLocaleDateString('es-MX') : ''}
                          {s.lastFailureAt ? 'Fallo: ' + s.lastErrorCategory : ''}
                          {!s.lastSuccessAt && !s.lastFailureAt ? 'Sin ejecuciones' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {s.description && (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', fontStyle: 'italic' }}>
                        &ldquo;{s.description}&rdquo;
                      </p>
                    )}

                    {/* Testing and Ingest Triggers / Results */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                      <button 
                        onClick={() => handleTestConnection(s.id)} 
                        disabled={tStatus?.loading || !s.isActive || s.crawlMode === 'manual_url'} 
                        title={s.crawlMode === 'manual_url' ? "Las fuentes manual_url no soportan prueba automática de conexión. Usa 'Ejecutar Ingesta Manual' con una URL específica." : undefined}
                        className="btn-primary" 
                        style={{ 
                          padding: '0.45rem 1rem', 
                          fontSize: '0.85rem', 
                          background: s.crawlMode === 'manual_url' ? '#6b7280' : '#2563eb', 
                          boxShadow: 'none',
                          cursor: s.crawlMode === 'manual_url' ? 'not-allowed' : undefined
                        }}
                      >
                        {tStatus?.loading ? 'Probando...' : 'Probar Conexión'}
                      </button>

                      <button 
                        onClick={() => handleIngest(s.id)} 
                        disabled={iStatus?.loading || !s.isActive} 
                        className="btn-primary" 
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: '#059669', boxShadow: 'none' }}
                      >
                        {iStatus?.loading ? 'Ingestando...' : 'Ejecutar Ingesta Manual'}
                      </button>
                    </div>

                    {/* Test Connection Result Box */}
                    {tStatus && (tStatus.data || tStatus.error) && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem', 
                        borderRadius: '6px', 
                        fontSize: '0.85rem',
                        background: tStatus.error
                          ? 'rgba(239,68,68,0.08)'
                          : `${healthColor(tStatus.data?.status || 'FETCH_ERROR')}18`,
                        border: `1px solid ${tStatus.error ? '#f87171' : healthColor(tStatus.data?.status || 'FETCH_ERROR')}`
                      }}>
                        <strong>Resultado de Conexión:</strong>
                        {tStatus.error && <p style={{ color: '#f87171', margin: '0.2rem 0 0 0' }}>{tStatus.error}</p>}
                        {tStatus.data && (
                          <div style={{ margin: '0.2rem 0 0 0' }}>
                            <span style={{ color: healthColor(tStatus.data.status), fontWeight: 'bold' }}>
                              {healthLabel(tStatus.data)}
                            </span>
                            {tStatus.data.statusCode && ` [HTTP ${tStatus.data.statusCode}]`}
                            {tStatus.data.durationMs !== undefined && ` (${tStatus.data.durationMs}ms)`}
                            <p style={{ margin: '0.2rem 0 0 0', opacity: 0.9 }}>{tStatus.data.message}</p>
                            {tStatus.data.finalUrl && (
                              <p style={{ margin: '0.2rem 0 0 0', opacity: 0.75, wordBreak: 'break-all' }}>
                                URL final: {tStatus.data.finalUrl}
                              </p>
                            )}
                            {tStatus.data.error?.causeMessage && (
                              <p style={{ margin: '0.2rem 0 0 0', opacity: 0.75 }}>
                                Causa: {tStatus.data.error.causeMessage}
                                {tStatus.data.error.causeHostname ? ` (${tStatus.data.error.causeHostname})` : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ingestion Result Box */}
                    {iStatus && (iStatus.data || iStatus.error) && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem', 
                        borderRadius: '6px', 
                        fontSize: '0.85rem',
                        background: iStatus.error || !iStatus.data?.ok ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${iStatus.error || !iStatus.data?.ok ? '#f87171' : '#34d399'}`
                      }}>
                        <strong>Resultado de Ingesta:</strong>
                        {iStatus.error && <p style={{ color: '#f87171', margin: '0.2rem 0 0 0' }}>{iStatus.error}</p>}
                        {iStatus.data && (
                          <div style={{ margin: '0.2rem 0 0 0' }}>
                            <span style={{ color: iStatus.data.ok ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                              {iStatus.data.ok ? (iStatus.data.warnings?.length ? 'Completado con advertencias' : 'Completado') : 'Fallo'}
                            </span>
                            {iStatus.data.ok && (
                              <span style={{ marginLeft: '0.5rem' }}>
                                (Encontrados: {iStatus.data.found} | Guardados: {iStatus.data.saved} | Duplicados: {iStatus.data.duplicates})
                              </span>
                            )}
                            {iStatus.data.message && <p style={{ margin: '0.3rem 0 0 0' }}>{iStatus.data.message}</p>}
                            {iStatus.data.warnings?.map((warning) => (
                              <p key={warning} style={{ color: '#fbbf24', margin: '0.3rem 0 0 0' }}>{warning}</p>
                            ))}
                            <p style={{ margin: '0.2rem 0 0 0', opacity: 0.9 }}>{iStatus.data.message}</p>
                            {iStatus.data.errors && iStatus.data.errors.length > 0 && (
                              <details style={{ marginTop: '0.4rem', cursor: 'pointer' }}>
                                <summary style={{ color: '#fca5a5' }}>Ver errores detallados ({iStatus.data.errors.length})</summary>
                                <ul style={{ marginLeft: '1rem', marginTop: '0.2rem', color: '#fca5a5' }}>
                                  {iStatus.data.errors.map((e: string, idx: number) => <li key={idx}>{e}</li>)}
                                </ul>
                              </details>
                            )}
                            {iStatus.data.sample && iStatus.data.sample.length > 0 && (
                              <div style={{ marginTop: '0.4rem' }}>
                                <div style={{ fontWeight: '600' }}>Últimas muestras guardadas:</div>
                                <ul style={{ marginLeft: '1rem', marginTop: '0.2rem', opacity: 0.85 }}>
                                  {iStatus.data.sample.map((itm: any, idx: number) => (
                                    <li key={idx}>
                                      <a href={itm.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{itm.title}</a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fetch Logs Accordion */}
                    {s.fetchLogs && s.fetchLogs.length > 0 && (
                      <details style={{ marginTop: '0.75rem', cursor: 'pointer' }}>
                        <summary style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                          Ver bitácora de sincronización (Últimos {s.fetchLogs.length} intentos)
                        </summary>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                              <th style={{ padding: '0.4rem' }}>Fecha</th>
                              <th style={{ padding: '0.4rem' }}>Estatus</th>
                              <th style={{ padding: '0.4rem' }}>Items</th>
                              <th style={{ padding: '0.4rem' }}>Categoría Error</th>
                              <th style={{ padding: '0.4rem' }}>Duración</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.fetchLogs.map((log) => (
                              <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '0.4rem' }}>{new Date(log.createdAt).toLocaleString('es-MX')}</td>
                                <td style={{ padding: '0.4rem', color: log.status === 'success' ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                                  {log.status.toUpperCase()}
                                </td>
                                <td style={{ padding: '0.4rem' }}>
                                  {log.foundItems} tot / {log.savedItems} nvs / {log.duplicateItems} dup
                                </td>
                                <td style={{ padding: '0.4rem', color: '#fca5a5' }}>{log.errorCategory || '-'}</td>
                                <td style={{ padding: '0.4rem' }}>{log.durationMs}ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
