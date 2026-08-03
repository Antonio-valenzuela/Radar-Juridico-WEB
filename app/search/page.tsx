'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { normalizeLegalDisplayText } from '@/lib/text/normalizeLegalDisplayText';
import { adminFetch, getAdminToken, getAdminTokenHeaders, setAdminToken } from '@/lib/client/adminToken';

type TaskDef = {
  id: string;
  label: string;
  description: string;
  matter: string;
};

const MATERIAS = [
  { value: '', label: 'Cualquier materia' },
  { value: 'constitucional', label: 'Constitucional' },
  { value: 'civil', label: 'Civil' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'mercantil', label: 'Mercantil' },
  { value: 'cnpcf', label: 'Código Nacional de Procedimientos Civiles y Familiares' },
  { value: 'amparo', label: 'Amparo' },
  { value: 'penal', label: 'Penal' },
  { value: 'aduanal', label: 'Aduanal' },
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'laboral', label: 'Laboral' },
  { value: 'salud', label: 'Salud' },
  { value: 'ambiental', label: 'Ambiental' },
  { value: 'energia', label: 'Energía' },
  { value: 'financiero', label: 'Financiero' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'comercio_exterior', label: 'Comercio exterior' },
  { value: 'proteccion_datos', label: 'Protección de datos' },
  { value: 'otro', label: 'Otro' },
];

const IMPACT_OPTIONS = [
  { value: '', label: 'Cualquier impacto' },
  { value: 'alto', label: 'Alto' },
  { value: 'medio', label: 'Medio' },
  { value: 'bajo', label: 'Bajo' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Cualquier fuente' },
  { value: 'DOF', label: 'DOF' },
  { value: 'SIDOF', label: 'SIDOF' },
  { value: 'SCJN', label: 'SCJN' },
  { value: 'SCJN_LEG', label: 'SCJN Legislación' },
  { value: 'SJF', label: 'SJF' },
];

const MODE_OPTIONS = [
  { value: 'hybrid', label: 'Híbrido (texto + semántico)' },
  { value: 'text', label: 'Solo texto' },
  { value: 'semantic', label: 'Solo semántico' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'date', label: 'Fecha' },
  { value: 'impact', label: 'Impacto' },
];

function getThisWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  return { dateFrom: startOfWeek.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [exact, setExact] = useState('');
  const [matter, setMatter] = useState('');
  const [impactLevel, setImpactLevel] = useState('');
  const [source, setSource] = useState('');
  const [authority, setAuthority] = useState('');
  const [entity, setEntity] = useState('');
  const [sector, setSector] = useState('');
  const [task, setTask] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [sort, setSort] = useState('relevance');
  const [limit] = useState(20);
  const [tipo, setTipo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [alertEmail, setAlertEmail] = useState('abogado@demo.com');
  const [alertName, setAlertName] = useState('');
  const [alertFrequency, setAlertFrequency] = useState('semanal');
  const [alertMessage, setAlertMessage] = useState('');

  const [results, setResults] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [tasks, setTasks] = useState<TaskDef[]>([]);
  const [expandedQuery, setExpandedQuery] = useState<{ originalQuery: string; expandedTerms: string[]; relatedMaterias: string[] } | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ timedOut: boolean; partial: boolean; failed: boolean }>({ timedOut: false, partial: false, failed: false });

  // Async RAG Report states
  const [reportJobId, setReportJobId] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<string>('');
  const [reportStage, setReportStage] = useState<string>('');
  const [reportProgress, setReportProgress] = useState<number>(0);
  const [reportError, setReportError] = useState<string>('');
  const [reportResult, setReportResult] = useState<any>(null);

  // Poll report status
  useEffect(() => {
    if (!reportJobId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/legal-reports/${reportJobId}`, {
          headers: getAdminTokenHeaders(),
        });
        if (!res.ok) {
          throw new Error('No se pudo obtener el estado del reporte');
        }
        const data = await res.json();
        if (data.ok) {
          setReportStatus(data.status);
          setReportStage(data.stage);
          setReportProgress(data.progress);
          
          if (data.status === 'COMPLETED') {
            setReportResult(data.result);
            clearInterval(intervalId);
          } else if (data.status === 'FAILED') {
            setReportError(data.error || 'El reporte falló en su ejecución.');
            clearInterval(intervalId);
          }
        }
      } catch (err: any) {
        setReportError(err.message);
        clearInterval(intervalId);
      }
    }, 1500);

    return () => clearInterval(intervalId);
  }, [reportJobId]);

  const handleCreateReport = async () => {
    setReportJobId(null);
    setReportStatus('QUEUED');
    setReportStage('queued');
    setReportProgress(5);
    setReportError('');
    setReportResult(null);

    const token = getAdminToken();

    try {
      const res = await fetch('/api/legal-reports', {
        method: 'POST',
        headers: getAdminTokenHeaders({ 'Content-Type': 'application/json' }, token),
        body: JSON.stringify({
          query,
          filters: {
            exact,
            matter,
            impactLevel,
            source,
            authority,
            entity,
            sector,
            task,
            dateFrom,
            dateTo,
          },
          materia: matter || undefined,
          fuente: source || undefined,
          autoridad: authority || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          mode: mode,
          localResults: results.slice(0, 10),
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          const newToken = prompt('Ingresa el token de administrador:', token);
          if (newToken) {
            setAdminToken(newToken);
            handleCreateReport();
            return;
          }
        }
        throw new Error(data.message || data.error || 'Error al iniciar reporte');
      }

      if (data.ok && data.id) {
        setReportJobId(data.id);
      } else {
        throw new Error('Respuesta del servidor no contiene ID de reporte');
      }
    } catch (err: any) {
      setReportError(err.message);
      setReportStatus('FAILED');
      setReportStage('failed');
      setReportProgress(0);
    }
  };

  // Load tasks on mount
  useEffect(() => {
    fetch('/api/search/tasks')
      .then(res => res.json())
      .then(data => {
        if (data.ok) setTasks(data.tasks || []);
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Load query parameters from chat quick actions or direct links.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('query') || '';
    const urlMatter = params.get('matter') || '';
    const urlSource = params.get('source') || '';
    const urlDateRange = params.get('dateRange') || '';
    const urlMode = params.get('mode') || '';
    const shouldAutoSearch = params.get('auto') === '1';

    const overrides: Record<string, string> = {};
    if (urlQuery) {
      setQuery(urlQuery);
      overrides.query = urlQuery;
    }
    if (urlMatter) {
      setMatter(urlMatter);
      overrides.matter = urlMatter;
    }
    if (urlSource) {
      setSource(urlSource);
      overrides.source = urlSource;
    }
    if (urlMode) {
      setMode(urlMode);
      overrides.mode = urlMode;
    }
    if (urlDateRange === 'this_week') {
      const range = getThisWeekRange();
      setDateFrom(range.dateFrom);
      setDateTo(range.dateTo);
      overrides.dateFrom = range.dateFrom;
      overrides.dateTo = range.dateTo;
    }

    if (shouldAutoSearch && Object.keys(overrides).length > 0) {
      handleSearch(overrides);
    }
  }, []);

  // Listen to global chat actions to control search page dynamically
  useEffect(() => {
    const handleActionQuery = (e: Event & { detail?: any }) => {
      if (e.detail?.query !== undefined) {
        const overrides: Record<string, string> = { query: e.detail.query };
        setQuery(e.detail.query);
        if (e.detail.matter) {
          setMatter(e.detail.matter);
          overrides.matter = e.detail.matter;
        }
        if (e.detail.source) {
          setSource(e.detail.source);
          overrides.source = e.detail.source;
        }
        if (e.detail.dateRange === 'this_week') {
          const range = getThisWeekRange();
          setDateFrom(range.dateFrom);
          setDateTo(range.dateTo);
          overrides.dateFrom = range.dateFrom;
          overrides.dateTo = range.dateTo;
        }
        handleSearch(overrides);
      }
    };
    const handleActionClear = () => {
      setQuery('');
      setExact('');
      setTask('');
      setMatter('');
      setAuthority('');
      setSector('');
      setEntity('');
      setImpactLevel('');
      handleSearch({
        query: '',
        exact: '',
        task: '',
        matter: '',
        authority: '',
        sector: '',
        entity: '',
        impactLevel: '',
      });
    };
    const handleActionMode = (e: Event & { detail?: any }) => {
      if (e.detail?.mode) {
        setMode(e.detail.mode);
        handleSearch({ mode: e.detail.mode });
      }
    };

    window.addEventListener('chat-action-query', handleActionQuery as any);
    window.addEventListener('chat-action-clear', handleActionClear as any);
    window.addEventListener('chat-action-mode', handleActionMode as any);

    return () => {
      window.removeEventListener('chat-action-query', handleActionQuery as any);
      window.removeEventListener('chat-action-clear', handleActionClear as any);
      window.removeEventListener('chat-action-mode', handleActionMode as any);
    };
  }, [exact, matter, impactLevel, source, authority, entity, sector, task, dateFrom, dateTo, mode, sort, tipo]);


  const handleSearch = async (overrideParams?: any) => {
    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const payload: any = {
        query, exact, matter, impactLevel, source, authority,
        entity, sector, task, dateFrom, dateTo, mode, sort, limit, tipo,
        ...overrideParams
      };
      // Clean empty fields
      Object.keys(payload).forEach(key => {
        if (!payload[key] && payload[key] !== 0) delete payload[key];
      });

      const res = await fetch('/api/search/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          console.error('Failed to parse search response JSON:', jsonErr);
        }
      }

      if (!res.ok) {
        setSearchMeta({ timedOut: false, partial: false, failed: true });
        const details = data.details ? data.details.join('; ') : data.error || `Error HTTP ${res.status}`;
        throw new Error(details);
      }

      setResults(data.results || []);
      setFacets(data.facets || null);
      setPagination(data.pagination || null);
      setExpandedQuery(data.expandedQuery || null);
      setHasSearched(true);

      const hasTimeout = !!data.warnings?.some((w: string) => w.toLowerCase().includes('timeout') || w.toLowerCase().includes('espera'));
      const hasPartial = !!data.warnings?.some((w: string) => w.toLowerCase().includes('parcial'));
      setSearchMeta({
        timedOut: hasTimeout,
        partial: hasPartial,
        failed: false
      });

      // Notify chatbot of query changed
      window.dispatchEvent(new CustomEvent('search-query-changed', {
        detail: {
          query: payload.query || '',
          filters: payload,
          resultCount: (data.results || []).length
        }
      }));
    } catch (err: any) {
      const isTechnical = !err.message || 
                          /json|fetch|response|prisma|sql|unexpected|abort|timeout|token|fail|undefined|null|object|status/i.test(err.message);
      if (err?.name === 'AbortError' || isTechnical) {
        setError('No pude completar esta acción en este momento. Intenta de nuevo o ajusta tu búsqueda.');
        setSearchMeta({ timedOut: err?.name === 'AbortError', partial: false, failed: true });
      } else {
        setError(err.message);
        setSearchMeta({ timedOut: false, partial: false, failed: true });
      }
      setResults([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleEnrich = async (itemId: string) => {
    let token = getAdminToken();
    const newToken = prompt('Ingresa el token de administrador:', token);
    if (newToken === null) return;
    if (newToken) {
      token = setAdminToken(newToken);
    }

    try {
      const res = await fetch('/api/admin/enrich-item', {
        method: 'POST',
        headers: getAdminTokenHeaders({ 'Content-Type': 'application/json' }, token),
        body: JSON.stringify({ itemId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enriquecer');
      }

      alert('¡Documento enriquecido con éxito!');
      setResults(prev => prev.map(r => r.id === itemId && data.enrichment ? {
        ...r,
        aiMatter: data.enrichment.matter,
        authority: data.enrichment.authority,
        impactLevel: data.enrichment.impactLevel,
        entities: data.enrichment.entities,
        affectedSectors: data.enrichment.affectedSectors,
        keywords: data.enrichment.keywords,
        relatedTopics: data.enrichment.relatedTopics,
      } : r));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const clearFilters = () => {
    setQuery(''); setExact(''); setMatter(''); setImpactLevel('');
    setSource(''); setAuthority(''); setEntity(''); setSector('');
    setTask(''); setDateFrom(''); setDateTo(''); setTipo('');
    setMode('hybrid'); setSort('relevance');
    setResults([]); setFacets(null); setPagination(null);
    setHasSearched(false); setError('');
  };

  const applyChip = (overrides: Record<string, string>) => {
    const nextParams = {
      query: overrides.query ?? '',
      exact: '',
      matter: overrides.matter ?? '',
      impactLevel: overrides.impactLevel ?? '',
      source: overrides.source ?? '',
      authority: '',
      entity: overrides.entity ?? '',
      sector: overrides.sector ?? '',
      task: '',
      dateFrom: overrides.dateFrom ?? '',
      dateTo: overrides.dateTo ?? '',
      mode: 'hybrid',
      sort: overrides.sort ?? 'relevance',
      tipo: '',
    };
    setQuery(nextParams.query);
    setExact('');
    setMatter(nextParams.matter);
    setImpactLevel(nextParams.impactLevel);
    setSource(nextParams.source);
    setAuthority('');
    setEntity(nextParams.entity);
    setSector(nextParams.sector);
    setTask('');
    setDateFrom(nextParams.dateFrom);
    setDateTo(nextParams.dateTo);
    setTipo('');
    setSort(nextParams.sort);
    handleSearch(nextParams);
  };


  // chipStyle, selectStyle, inputStyle eliminados — usar clases CSS globales:
  // .chip, .chip.is-active en globals.css



  return (
    <div className="container page-content">
      <Link href="/" className="back-link">
        &larr; Volver al Dashboard
      </Link>
      <h1>Búsqueda Avanzada</h1>
      <p className="text-muted" style={{ marginBottom: 'var(--space-5)' }}>
        Encuentra publicaciones por tema, palabra clave, autoridad, impacto, fecha, fuente y más.
      </p>

      {/* Search form */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Main query field with label */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="search-query-field" style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              ¿Qué quieres buscar?
            </label>
            <input
              id="search-query-field"
              type="text"
              placeholder="Escribe palabras clave o preguntas legales (ej. aduanal, reformas, amparo...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ fontSize: '1.2rem' }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Buscando...' : 'Buscar'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (query.trim()) {
                  window.location.href = `/rag?q=${encodeURIComponent(query)}`;
                } else {
                  window.location.href = `/rag`;
                }
              }}
              className="btn-accent"
              style={{ flex: 1 }}
            >
              Preguntar a IA
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary"
            >
              Limpiar filtros
            </button>

            <button
              type="button"
              onClick={() => {
                setAlertName(query ? `Alerta: ${query}` : `Alerta materia: ${matter || 'todas'}`);
                setShowCreateAlert(!showCreateAlert);
              }}
              className="btn-primary"
            >
              🔔 Crear alerta
            </button>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="btn-secondary"
            >
              {showAdvanced ? 'Ocultar filtros avanzados' : 'Mostrar filtros avanzados'}
            </button>
          </div>

          {/* Collapsible Advanced Filters */}
          {showAdvanced && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)', marginTop: 'var(--space-2)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Filtros avanzados</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Materia</label>
                  <select value={matter} onChange={e => setMatter(e.target.value)}>
                    {MATERIAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fuente</label>
                  <select value={source} onChange={e => setSource(e.target.value)}>
                    {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Impacto</label>
                  <select value={impactLevel} onChange={e => setImpactLevel(e.target.value)}>
                    {IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Autoridad</label>
                  <input type="text" placeholder="ej. SAT, IMSS, ANAM" value={authority} onChange={e => setAuthority(e.target.value)} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tipo de documento</label>
                  <input type="text" placeholder="ej. LEY, DECRETO" value={tipo} onChange={e => setTipo(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Desde:</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minWidth: '130px', width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hasta:</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ minWidth: '130px', width: 'auto' }} />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Orden:</span>
                  <select value={sort} onChange={e => setSort(e.target.value)} style={{ width: 'auto' }}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select value={mode} onChange={e => setMode(e.target.value)} style={{ width: 'auto' }}>
                    {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Chips rápidos */}
        <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Temas de interés:</span>
          <button type="button" onClick={() => applyChip({ matter: 'penal' })} className={`chip${matter === 'penal' ? ' is-active' : ''}`}>Penal</button>
          <button type="button" onClick={() => applyChip({ matter: 'civil' })} className={`chip${matter === 'civil' ? ' is-active' : ''}`}>Civil</button>
          <button type="button" onClick={() => applyChip({ matter: 'familiar' })} className={`chip${matter === 'familiar' ? ' is-active' : ''}`}>Familiar</button>
          <button type="button" onClick={() => applyChip({ matter: 'mercantil' })} className={`chip${matter === 'mercantil' ? ' is-active' : ''}`}>Mercantil</button>
          <button type="button" onClick={() => applyChip({ matter: 'fiscal' })} className={`chip${matter === 'fiscal' ? ' is-active' : ''}`}>Fiscal</button>
          <button type="button" onClick={() => applyChip({ matter: 'laboral' })} className={`chip${matter === 'laboral' ? ' is-active' : ''}`}>Laboral</button>
          <button type="button" onClick={() => applyChip({ matter: 'salud' })} className={`chip${matter === 'salud' ? ' is-active' : ''}`}>Salud</button>
          <button type="button" onClick={() => applyChip({ matter: 'amparo' })} className={`chip${matter === 'amparo' ? ' is-active' : ''}`}>Amparo</button>
          <button type="button" onClick={() => applyChip({ matter: 'aduanal' })} className={`chip${matter === 'aduanal' ? ' is-active' : ''}`}>Aduanal</button>
          <button type="button" onClick={() => applyChip({ matter: 'comercio_exterior' })} className={`chip${matter === 'comercio_exterior' ? ' is-active' : ''}`}>Comercio exterior</button>
          <button type="button" onClick={() => applyChip({ entity: 'SAT' })} className={`chip${entity === 'SAT' ? ' is-active' : ''}`}>SAT</button>
          <button type="button" onClick={() => applyChip({ entity: 'IMSS' })} className={`chip${entity === 'IMSS' ? ' is-active' : ''}`}>IMSS</button>
          <button type="button" onClick={() => applyChip({ impactLevel: 'alto' })} className={`chip${impactLevel === 'alto' ? ' is-active' : ''}`}>Alto impacto</button>
          <button type="button" onClick={() => applyChip({ sector: 'empresas' })} className={`chip${sector === 'empresas' ? ' is-active' : ''}`}>Empresas</button>
          <button type="button" onClick={() => applyChip({ source: 'DOF' })} className={`chip${source === 'DOF' ? ' is-active' : ''}`}>DOF</button>
          <button type="button" onClick={() => applyChip({ source: 'SCJN' })} className={`chip${source === 'SCJN' ? ' is-active' : ''}`}>SCJN</button>
          <button type="button" onClick={() => {
            const range = getThisWeekRange();
            applyChip(range);
          }} className={`chip${!!dateFrom && !query ? ' is-active' : ''}`}>Esta semana</button>
          <button type="button" onClick={() => applyChip({ query: 'reforma', sort: 'date' })} className={`chip${query === 'reforma' ? ' is-active' : ''}`}>Reformas recientes</button>
        </div>
      </div>

      {showCreateAlert && (
        <div className="card" style={{ marginBottom: 'var(--space-5)', border: '1px solid var(--border-focus)' }}>
          <h3 style={{ margin: '0 0 var(--space-4) 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span>🔔</span> Configurar Alerta Regulatoria
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email para notificaciones</label>
              <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre de la alerta</label>
              <input type="text" value={alertName} onChange={e => setAlertName(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Frecuencia</label>
              <select value={alertFrequency} onChange={e => setAlertFrequency(e.target.value)}>
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estado</label>
              <select>
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
              </select>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
            Se creará una alerta por <strong>{query ? `palabra clave "${query}"` : `materia "${matter || 'general'}"`}</strong> en el tenant compartida de demostración.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                try {
                  let token = getAdminToken();
                  if (!token) {
                    const entered = window.prompt('Ingresa el token de administrador para crear alertas:');
                    if (entered === null) throw new Error('ADMIN_TOKEN_REQUIRED');
                    token = setAdminToken(entered);
                  }
                  if (!token) throw new Error('ADMIN_TOKEN_REQUIRED');
                  const type = query ? 'keyword' : 'tema';
                  const value = query || matter || 'general';
                  const res = await adminFetch('/api/watchlist', {
                    method: 'POST',
                    body: JSON.stringify({
                      email: alertEmail,
                      orgSlug: 'demo',
                      action: 'add',
                      type,
                      value
                    })
                  });
                  const data = await res.json();
                  if (data.ok) {
                    setAlertMessage('¡Alerta creada con éxito! Se mostrará en tu panel de alertas.');
                    setTimeout(() => {
                      setShowCreateAlert(false);
                      setAlertMessage('');
                    }, 2500);
                  } else {
                    setAlertMessage(`Error: ${data.error}`);
                  }
                } catch (err: any) {
                  setAlertMessage(err?.message === 'ADMIN_TOKEN_REQUIRED' ? 'Ingresa un token administrativo válido.' : `Error: ${err?.message || 'No fue posible crear la alerta.'}`);
                }
              }}
            >
              Guardar Alerta
            </button>
            <button
              type="button"
              onClick={() => setShowCreateAlert(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
          {alertMessage && <p style={{ marginTop: 'var(--space-4)', fontWeight: 600 }} className={alertMessage.includes('Error') ? 'text-error' : 'text-success'}>{alertMessage}</p>}
        </div>
      )}

      {/* AI Report Progress / Result Card */}
      {reportStatus && (
        <div className="card" style={{ marginBottom: 'var(--space-5)', borderColor: 'var(--border-focus)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h3 style={{ margin: 0, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>🤖</span> Reporte Jurídico Asíncrono con IA
            </h3>
            <button
              onClick={() => setReportStatus('')}
              className="btn-secondary"
              style={{ minHeight: 'auto', padding: 'var(--space-1) var(--space-2)', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>

          {/* Progress bar */}
          {reportStatus !== 'COMPLETED' && reportStatus !== 'FAILED' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {reportStage === 'queued' && '⏳ Reporte en cola...'}
                  {reportStage === 'searching' && '🔍 Buscando información...'}
                  {reportStage === 'collecting_sources' && '🏗️ Recopilando fuentes oficiales...'}
                  {reportStage === 'analyzing' && '🧠 Analizando con Inteligencia Artificial...'}
                  {reportStage === 'generating_summary' && '✍️ Generando resumen ejecutivo...'}
                  {!['queued', 'searching', 'collecting_sources', 'analyzing', 'generating_summary'].includes(reportStage) && 'Procesando reporte...'}
                </span>
                <span style={{ color: 'var(--info)', fontWeight: 'bold' }}>{reportProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ width: `${reportProgress}%`, height: '100%', background: 'var(--info)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
              </div>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 'var(--space-3)', marginBottom: 0 }}>
                La tarea se ejecuta en background mediante BullMQ. No requiere mantener la búsqueda abierta.
              </p>
            </div>
          )}

          {/* Error display */}
          {reportStatus === 'FAILED' && (
            <div className="status-error" style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'block' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>⚠️ El reporte no pudo ser completado:</p>
              <p className="text-secondary" style={{ margin: 'var(--space-1) 0 0 0', fontSize: '0.9rem' }}>{reportError}</p>
            </div>
          )}

          {/* Successful result display */}
          {reportStatus === 'COMPLETED' && reportResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div style={{ background: 'var(--info-bg)', border: '1px solid rgba(29,78,216,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)' }}>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 'var(--space-2)', fontSize: '1.05rem' }}>
                  📊 Resumen Ejecutivo
                </strong>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {reportResult.resumenEjecutivo}
                </p>
              </div>

              {reportResult.posiblesImpactos && (
                <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(148,98,0,0.25)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 'var(--space-2)', fontSize: '1.05rem' }}>
                    ⚠️ Impactos Jurídicos Detectados
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {reportResult.posiblesImpactos}
                  </p>
                </div>
              )}

              {reportResult.puntosRelevantes && reportResult.puntosRelevantes.length > 0 && (
                <div className="card">
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 'var(--space-2)', fontSize: '1rem' }}>
                    📌 Puntos Relevantes
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                    {reportResult.puntosRelevantes.map((pt: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: 'var(--space-1)' }}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {reportResult.fuentesConsultadas && reportResult.fuentesConsultadas.length > 0 && (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                  🏗️ <strong>Fuentes oficiales consultadas:</strong> {reportResult.fuentesConsultadas.join(', ')}
                </p>
              )}

              {reportResult.documentosEncontrados && reportResult.documentosEncontrados.length > 0 && (
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 'var(--space-3)', fontSize: '0.98rem' }}>
                    📂 Documentos y Evidencia Asociada
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {reportResult.documentosEncontrados.map((doc: any, idx: number) => (
                      <div key={idx} className="card" style={{ fontSize: '0.88rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--info)', fontWeight: 600, marginBottom: 'var(--space-1)', gap: 'var(--space-4)' }}>
                          <span>{doc.titulo}</span>
                          <span className="tag-ai" style={{ whiteSpace: 'nowrap' }}>
                            Similitud: {doc.similitudSemantica ? `${(doc.similitudSemantica * 100).toFixed(0)}%` : 'Manual'}
                          </span>
                        </div>
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 'var(--space-1)', margin: 'var(--space-1) 0' }}>
                          Fuente: {doc.fuente} | Publicado: {doc.fecha}
                        </p>
                        {doc.fragment && (
                          <p className="text-secondary" style={{ margin: 0, fontStyle: 'italic', background: 'var(--surface-muted)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', lineHeight: 1.4 }}>
                            &ldquo;{doc.fragment}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-muted" style={{ fontSize: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between' }}>
                <span>ID del reporte: {reportJobId}</span>
                <span>Generado el: {new Date(reportResult.generatedAt).toLocaleString('es-MX')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card" style={{ borderColor: 'var(--error)', marginBottom: 'var(--space-4)' }}>
          <p className="text-error" style={{ margin: 0 }}>⚠️ {error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && <p style={{ color: 'var(--text-muted)' }}>Cargando resultados...</p>}

      {/* Diagnóstico de estado para pruebas de UX */}
      {searchMeta.partial && (
        <div className="status-warn" style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', display: 'block' }}>
          ⚠️ Se muestran <strong>resultados parciales</strong> (respuesta parcial) debido a retrasos en fuentes oficiales.
        </div>
      )}
      {searchMeta.timedOut && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
          ⌛ Ocurrió un <strong>tiempo de espera</strong> agotado (timeout) en la consulta externa.
        </div>
      )}
      {searchMeta.failed && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
          ❌ No se pudo completar la búsqueda en fuentes oficiales. Reintenta la consulta o abre directamente la fuente aplicable.
        </div>
      )}

      {/* Empty state */}
      {!loading && hasSearched && results.length === 0 && !error && !searchMeta?.timedOut && !searchMeta?.partial && !searchMeta?.failed && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <span style={{ fontSize: '3.0rem', display: 'block', marginBottom: '1.25rem' }}>🔍</span>
          <h2>No se encontraron publicaciones con esos filtros.</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            Búsqueda local sin coincidencias ni resultados reales. No pudimos hallar coincidencias locales ni externas. Intenta simplificar tus términos, remover filtros o prueba con una de las siguientes opciones rápidas:
          </p>

          {expandedQuery && expandedQuery.expandedTerms.length > 0 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(197, 168, 128, 0.15)', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', maxWidth: '700px', margin: '0 auto 2rem auto', textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#c5a880' }}>Búsqueda Expandida Automática (Thesaurus)</h4>
              <p style={{ fontSize: '0.88rem', margin: '0 0 1rem 0', color: '#cbd5e1' }}>
                No encontré resultados para &quot;{expandedQuery.originalQuery}&quot;. También intentamos buscar sinónimos y términos relacionados:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {expandedQuery.expandedTerms.map((term: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(term);
                      handleSearch({ query: term });
                    }}
                    style={{
                      background: 'rgba(197, 168, 128, 0.1)',
                      border: '1px solid rgba(197, 168, 128, 0.3)',
                      color: '#ffffff',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    🔍 {term}
                  </button>
                ))}
              </div>
              {expandedQuery.relatedMaterias.length > 0 && (
                <p style={{ fontSize: '0.8rem', margin: 0, color: '#94a3b8' }}>
                  <strong>Materias relacionadas:</strong> {expandedQuery.relatedMaterias.join(', ')}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('open-legal-chat', {
                  detail: {
                    mode: 'empty_search_assistant',
                    query,
                    filters: {
                      exact,
                      matter,
                      impactLevel,
                      source,
                      authority,
                      entity,
                      sector,
                      task,
                      dateFrom,
                      dateTo,
                    },
                    resultCount: 0,
                  },
                })
              );
            }}
            style={{
              padding: '0.95rem 2.5rem',
              background: 'linear-gradient(135deg, #c5a880 0%, #b3956b 100%)',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem',
              marginBottom: '2.5rem',
              boxShadow: '0 4px 15px rgba(197, 168, 128, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            💬 Preguntar al asistente IA
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', maxWidth: '900px', margin: '0 auto' }}>
            <Link href="/admin/ingest/manual-url" className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', padding: '0.85rem' }}>
              Agregar link jurídico
            </Link>
            <button
              onClick={() => {
                handleSearch({ mode: 'text' });
              }}
              style={{ padding: '0.85rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Forzar búsqueda textual
            </button>
            <button
              onClick={() => {
                handleSearch({ query });
              }}
              style={{ padding: '0.85rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Reintentar búsqueda ampliada
            </button>
            <button
              onClick={() => {
                // Realizar búsqueda externa
                handleSearch({ query });
              }}
              style={{ padding: '0.85rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Buscar en fuentes oficiales
            </button>
            <button
              onClick={() => {
                setQuery('');
                setExact('');
                setTask('');
                setMatter('');
                setAuthority('');
                setSector('');
                setEntity('');
                setImpactLevel('');
                handleSearch({
                  query: '',
                  exact: '',
                  task: '',
                  matter: '',
                  authority: '',
                  sector: '',
                  entity: '',
                  impactLevel: '',
                });
              }}
              style={{ padding: '0.85rem', background: '#475569', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Quitar filtros
            </button>
            <Link href={`/watchlists?query=${encodeURIComponent(query || '')}`} style={{ padding: '0.85rem', background: '#84cc16', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Crear alerta
            </Link>
            <Link href="/items" style={{ padding: '0.85rem', background: '#1e293b', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: 'span 1' }}>
              Ver documentos indexados
            </Link>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
          {/* Facets sidebar */}
          <div>
            <div className="glass-card">
              <h3 style={{ marginTop: 0 }}>Facetas</h3>
              {pagination && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {pagination.total} resultado{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}
                </p>
              )}
              {facets && Object.keys(facets.matters || {}).length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Materias</strong>
                  <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                    {Object.entries(facets.matters).map(([k, v]) => <li key={k}>{k}: {v as number}</li>)}
                  </ul>
                </div>
              )}
              {facets && Object.keys(facets.sources || {}).length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Fuentes</strong>
                  <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                    {Object.entries(facets.sources).map(([k, v]) => <li key={k}>{k}: {v as number}</li>)}
                  </ul>
                </div>
              )}
              {facets && Object.keys(facets.impacts || {}).length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Impacto</strong>
                  <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                    {Object.entries(facets.impacts).map(([k, v]) => <li key={k}>{k}: {v as number}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Results list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {results.map((r: any) => {
              const hasEnrichment = !r.isExternal && !!(r.aiMatter || r.authority || (r.entities && r.entities.length > 0));
              const title = normalizeLegalDisplayText(r.title);
              const summary = normalizeLegalDisplayText(r.summary);
              const sourceName = normalizeLegalDisplayText(r.source);
              const matterName = normalizeLegalDisplayText(r.matter);
              return (
                <div key={r.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: r.isExternal ? '1px solid #ec4899' : '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    {r.isExternal ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                        <h3 style={{ color: '#f472b6', margin: 0 }}>
                          {normalizeLegalDisplayText(r.title)} <span style={{ fontSize: '0.7rem', background: '#ec4899', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem', verticalAlign: 'middle', fontWeight: 'bold' }}>Fuente Externa</span>
                        </h3>
                      </a>
                    ) : (
                      <Link href={`/items/${r.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                        <h3 style={{ color: 'var(--accent)', margin: 0 }}>{normalizeLegalDisplayText(r.title)}</h3>
                      </Link>
                    )}
                    <span style={{ fontSize: '0.75rem', background: 'var(--card-border)', padding: '0.2rem 0.5rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      {r.isExternal ? 'Externo' : `Score: ${r.score.toFixed(2)}`}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {summary ? summary.substring(0, 300) + (summary.length > 300 ? '...' : '') : 'Sin resumen disponible'}
                  </p>

                  {/* Metadata Row */}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>📅 {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString('es-MX') : 'Sin fecha'}</span>
                    <span>🏛️ Fuente: {sourceName || 'Sin fuente'}</span>
                    <span>📚 Materia: {matterName || 'Sin tema'}</span>
                    {!r.isExternal && r.impactLevel && (
                      <span style={{ color: r.impactLevel === 'high' || r.impactLevel === 'alto' ? '#ef4444' : r.impactLevel === 'medium' || r.impactLevel === 'medio' ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                        ⚠️ Impacto: {r.impactLevel}
                      </span>
                    )}
                  </div>

                  {/* Enrichment Section */}
                  {hasEnrichment ? (
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '0.25rem' }}>Análisis Enriquecido por IA:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {r.aiMatter && <div><strong>Materia IA:</strong> <span style={{ color: '#60a5fa' }}>{r.aiMatter}</span></div>}
                        {r.authority && <div><strong>Autoridad Detectada:</strong> <span style={{ color: '#34d399' }}>{r.authority}</span></div>}
                        {r.entities && r.entities.length > 0 && (
                          <div><strong>Entidades:</strong> {r.entities.map((e: string) => <span key={e} style={{ background: '#334155', padding: '1px 5px', borderRadius: '4px', fontSize: '0.75rem', marginRight: '4px', color: '#cbd5e1' }}>{e}</span>)}</div>
                        )}
                        {r.affectedSectors && r.affectedSectors.length > 0 && (
                          <div><strong>Sectores Afectados:</strong> {r.affectedSectors.map((s: string) => <span key={s} style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '4px', fontSize: '0.75rem', marginRight: '4px', color: '#94a3b8' }}>{s}</span>)}</div>
                        )}
                        {r.keywords && r.keywords.length > 0 && (
                          <div><strong>Keywords IA:</strong> {r.keywords.join(', ')}</div>
                        )}
                        {r.relatedTopics && r.relatedTopics.length > 0 && (
                          <div><strong>Temas Relacionados:</strong> {r.relatedTopics.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {r.isExternal ? (
                      <>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block', borderRadius: '4px' }}>
                          Ingresar ahora
                        </a>
                        {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
                          <Link href={`/admin/ingest/manual-url?url=${encodeURIComponent(r.url)}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: '#475569', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                            Importar a Local
                          </Link>
                        )}
                      </>
                    ) : (
                      <>
                        <Link href={`/items/${r.id}`} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block', borderRadius: '4px' }}>
                          Ver detalle
                        </Link>
                        <Link href={`/rag?q=${encodeURIComponent(title)}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: '#475569', color: 'white', textDecoration: 'none', borderRadius: '4px', transition: 'background 0.2s' }}>
                          Preguntar con RAG
                        </Link>
                        {!hasEnrichment && process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
                          <button onClick={() => handleEnrich(r.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            Enriquecer con IA
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {pagination && pagination.total > pagination.offset + pagination.limit && (
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '1rem' }}
                onClick={() => handleSearch({ offset: (pagination.offset || 0) + limit })}
              >
                Cargar más ({pagination.total - pagination.offset - pagination.limit} restantes)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
