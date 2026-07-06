'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyResult {
  id: string;
  title: string;
  source: string;
  publishedAt: string | null;
  updatedAt: string | null;
  type: string;
  matter: string | null;
  impact: string | null;
  summary: string | null;
  url: string;
  changeType: string;
  affectedSections: string[];
  origin: 'local';
}

interface RangeUsed {
  startDate: string;
  endDate: string;
  timezone: string;
  defaulted?: boolean;
}

interface WeeklySummary {
  total: number;
  showing: number;
  page: number;
  limit: number;
  bySource: Record<string, number>;
  byType: Record<string, number>;
  highImpact: number;
}

interface WeeklyResponse {
  ok: boolean;
  rangeUsed: RangeUsed;
  summary: WeeklySummary;
  results: WeeklyResult[];
  external: { enabled: boolean; total: number; timedOutSources: string[] };
  degraded: boolean;
  message: string | null;
  generatedAt: string;
}

// For POST /api/legal/radar (active AI search)
interface LocalResult {
  title: string;
  source: string;
  type: string;
  publishedAt: string | null;
  lastModifiedAt: string | null;
  status: 'nuevo' | 'modificado' | 'sin cambios' | 'desconocido';
  matches: number;
  excerpt: string;
  officialUrl: string;
  score: number;
}

interface WeeklyChange {
  title: string;
  changeType: string;
  changedAt: string;
  affectedSections: string[];
  summary: string;
}

interface AiAnalysis {
  summary: string;
  legalImpact: string;
  attentionPoints: string[];
  provider: string;
  model: string;
  usedFallback: boolean;
}

interface RadarResponse {
  ok: boolean;
  query: string;
  localResults: LocalResult[];
  weeklyChanges: WeeklyChange[];
  externalResults: ExternalGroup[];
  aiAnalysis: AiAnalysis | null;
  warnings: string[];
  radarStatus: 'success' | 'partial';
  sourcesConsulted: string[];
  attempts: { limit: number; used: number; remaining: number } | null;
  degraded: boolean;
  timedOutSources: string[];
  debug: {
    localDocumentsFound: number;
    weeklyChangesFound: number;
    externalSourcesQueried: string[];
    llmCalled: boolean;
  } | null;
}

interface ExternalGroup {
  source: string;
  results: Array<{
    title: string;
    url: string;
    date?: string;
    excerpt?: string;
    type?: string;
    sourceName?: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultDates() {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { start: start.toISOString().slice(0, 10), end };
}

function getChangeTypeBadge(changeType: string) {
  const t = changeType.toLowerCase();
  if (t.includes('reform')) return { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' };
  if (t.includes('nuevo') || t.includes('publicaci')) return { bg: 'rgba(16,185,129,0.18)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' };
  if (t.includes('modific') || t.includes('actuali')) return { bg: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' };
  if (t.includes('derogaci')) return { bg: 'rgba(239,68,68,0.18)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' };
  if (t.includes('jurisprud') || t.includes('tesis')) return { bg: 'rgba(236,72,153,0.18)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.3)' };
  return { bg: 'rgba(148,163,184,0.18)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' };
}

function getImpactBadge(impact: string | null) {
  if (impact === 'alto')  return { color: '#f87171' };
  if (impact === 'medio') return { color: '#f59e0b' };
  if (impact === 'bajo')  return { color: '#10b981' };
  return { color: '#94a3b8' };
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case 'nuevo':      return { bg: 'rgba(16,185,129,0.18)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' };
    case 'modificado': return { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' };
    case 'sin cambios': return { bg: 'rgba(59,130,246,0.18)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' };
    default:           return { bg: 'rgba(148,163,184,0.18)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RadarLegalPage() {
  const defaults = getDefaultDates();

  // Form state
  const [keyword, setKeyword]       = useState('');
  const [matter, setMatter]         = useState('');
  const [dateFrom, setDateFrom]     = useState(defaults.start);
  const [dateTo, setDateTo]         = useState(defaults.end);
  const [forceExternal, setForceExternal] = useState(false);
  const [token, setToken]           = useState('dev-admin-token');

  // UI state
  const [weeklyLoading, setWeeklyLoading] = useState(false); // for auto-load
  const [searchLoading, setSearchLoading] = useState(false); // for active AI search
  const [loadingState, setLoadingState]   = useState('');
  const [error, setError]           = useState('');
  const [warnings, setWarnings]     = useState<string[]>([]);

  // Mode: 'weekly' = showing GET /api/legal/weekly-changes data
  //       'radar'  = showing POST /api/legal/radar (AI search) data
  const [mode, setMode] = useState<'weekly' | 'radar'>('weekly');

  // Weekly data (from GET /api/legal/weekly-changes)
  const [weeklyData, setWeeklyData]   = useState<WeeklyResponse | null>(null);

  // Radar data (from POST /api/legal/radar)
  const [radarData, setRadarData]     = useState<RadarResponse | null>(null);
  const [radarStatus, setRadarStatus] = useState<'idle' | 'loading' | 'success' | 'partial' | 'error'>('idle');

  // Misc
  const [lastQueryTime, setLastQueryTime] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel]       = useState('');

  const abortRef = useRef<AbortController | null>(null);

  // ── Load token from localStorage ────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('juridico_admin_token');
    if (saved) setToken(saved);
  }, []);

  // ── Load AI provider config ─────────────────────────────────────────────────
  useEffect(() => {
    if (!token.trim()) return;
    fetch('/api/legal/radar', { headers: { 'x-admin-token': token.trim() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok) {
          setProvider(data.provider ?? '');
          setModel(data.model ?? '');
        }
      })
      .catch(() => { /* non-critical */ });
  }, [token]);

  // ── Auto-load weekly data on mount ──────────────────────────────────────────
  const loadWeeklyData = useCallback(async (
    startDate?: string,
    endDate?: string,
    kw?: string,
    mat?: string
  ) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setWeeklyLoading(true);
    setError('');
    setWarnings([]);

    try {
      const params = new URLSearchParams();
      params.set('startDate', startDate ?? defaults.start);
      params.set('endDate',   endDate   ?? defaults.end);
      params.set('limit',     '50');
      if (kw)  params.set('keyword', kw);
      if (mat) params.set('materia', mat);

      const res = await fetch(`/api/legal/weekly-changes?${params.toString()}`, {
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? `Error ${res.status} al cargar el resumen semanal`);
      }

      const data: WeeklyResponse = await res.json();
      setWeeklyData(data);
      setMode('weekly');
      if (data.degraded) {
        setWarnings(w => [...w, 'La consulta se resolvió con información local disponible. Verifica la fuente oficial antes de usar el resultado.']);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
    } finally {
      setWeeklyLoading(false);
    }
  }, [defaults.start, defaults.end]);

  // Auto-load on mount
  useEffect(() => {
    loadWeeklyData(defaults.start, defaults.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const handleTokenChange = (v: string) => {
    setToken(v);
    localStorage.setItem('juridico_admin_token', v);
  };

  // ── Main search handler ──────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // If no keyword and no forceExternal: reload weekly local data with current filters
    if (!keyword.trim() && !forceExternal) {
      await loadWeeklyData(dateFrom, dateTo, undefined, matter || undefined);
      return;
    }

    // If keyword without forceExternal: fast local filter via GET weekly-changes
    if (keyword.trim() && !forceExternal) {
      await loadWeeklyData(dateFrom, dateTo, keyword.trim(), matter || undefined);
      return;
    }

    // If forceExternal (or keyword + external): use POST /api/legal/radar with AI
    if (!token.trim()) {
      setError('El Admin Token es requerido para búsqueda externa con IA.');
      return;
    }

    setSearchLoading(true);
    setRadarStatus('loading');
    setError('');
    setWarnings([]);
    setRadarData(null);

    // Loading animation
    setLoadingState('Buscando documentos locales...');
    const t1 = setTimeout(() => setLoadingState('Detectando reformas semanales...'),   1000);
    const t2 = setTimeout(() => setLoadingState('Consultando fuentes externas...'),    2500);
    const t3 = setTimeout(() => setLoadingState('Generando análisis jurídico con IA...'), 4500);

    const controller = new AbortController();
    const clientTimeoutId = setTimeout(() => controller.abort(), 28000);

    try {
      const res = await fetch('/api/legal/radar', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify({
          query:        keyword.trim() || 'resumen semanal',
          matter:       matter   || undefined,
          dateFrom:     dateFrom || undefined,
          dateTo:       dateTo   || undefined,
          forceExternal,
        }),
        signal: controller.signal,
      });

      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearTimeout(clientTimeoutId);

      if (!res.ok) {
        if (res.status === 401) throw new Error('Token inválido. Usa dev-admin-token en local.');
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? data?.error ?? `Error ${res.status}`);
      }

      const data: RadarResponse = await res.json();
      setRadarData(data);
      setMode('radar');
      setRadarStatus(data.radarStatus ?? 'success');
      setWarnings(data.warnings ?? []);
      setLastQueryTime(new Date().toLocaleTimeString('es-MX'));

    } catch (err: unknown) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearTimeout(clientTimeoutId);
      let msg = 'Error desconocido';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          msg = 'La solicitud excedió el tiempo límite (timeout). Por favor intenta de nuevo.';
        } else {
          msg = err.message;
        }
      }
      setError(msg);
      setRadarStatus('error');
      setLastQueryTime(new Date().toLocaleTimeString('es-MX'));
    } finally {
      setSearchLoading(false);
      setLoadingState('');
    }
  };

  // ── Convenience ────────────────────────────────────────────────────────────
  const isLoading = weeklyLoading || searchLoading;

  // How many external results (radar mode)
  const totalExternalResults = (radarData?.externalResults ?? []).reduce(
    (acc: number, g: ExternalGroup) => acc + (g.results?.length ?? 0), 0
  );

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '1400px' }}>
      <div className="bg-gradient" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          ← Volver al Dashboard
        </Link>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Admin Token (para IA):
          </label>
          <input
            id="admin-token-input"
            type="password"
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: '#1e293b', color: 'white', fontSize: '0.85rem', width: '160px' }}
          />
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <span className="badge">Módulo de Monitoreo Semanal</span>
        <h1 style={{ marginBottom: '0.5rem' }}>Radar Legal</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '680px', margin: '0 auto' }}>
          Monitoreo automático de leyes, reformas, tesis y publicaciones oficiales.
          Filtra por fecha, materia o palabra clave. Activa búsqueda externa para consultar fuentes oficiales con IA.
        </p>
      </div>

      {/* Search form */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="rag-search-row">
            <input
              id="radar-keyword-input"
              type="text"
              placeholder="Palabra clave opcional (ej. amparo, ISR, reforma laboral)…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)', background: '#0f172a', color: 'white', fontSize: '1.05rem' }}
            />
            <button
              id="radar-search-btn"
              type="submit"
              className="btn-primary"
              disabled={isLoading}
              style={{ minWidth: '160px' }}
            >
              {isLoading ? 'Consultando…' : 'Buscar en Radar'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Materia */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Materia:</label>
              <select
                id="radar-materia-select"
                value={matter}
                onChange={(e) => setMatter(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: '#0f172a', color: 'white', fontSize: '0.9rem' }}
              >
                <option value="">Cualquier materia</option>
                <option value="constitucional">Constitucional</option>
                <option value="civil">Civil</option>
                <option value="mercantil">Mercantil</option>
                <option value="fiscal">Fiscal</option>
                <option value="laboral">Laboral</option>
                <option value="familiar">Familiar</option>
                <option value="penal">Penal</option>
                <option value="administrativo">Administrativo</option>
              </select>
            </div>

            {/* Date from */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Desde:</label>
              <input
                id="radar-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: '#0f172a', color: 'white', fontSize: '0.9rem' }}
              />
            </div>

            {/* Date to */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hasta:</label>
              <input
                id="radar-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: '#0f172a', color: 'white', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {/* Force external */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="force-external-checkbox"
              type="checkbox"
              checked={forceExternal}
              onChange={(e) => setForceExternal(e.target.checked)}
              style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
            />
            <label htmlFor="force-external-checkbox" style={{ fontSize: '0.95rem', cursor: 'pointer', userSelect: 'none' }}>
              🌐 Forzar búsqueda externa en fuentes oficiales con IA (requiere Admin Token)
            </label>
          </div>

          {/* Mode indicator */}
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {!keyword && !forceExternal && (
              <span>💡 Sin palabra clave: muestra cambios locales de la semana. Con keyword: filtra resultados locales.</span>
            )}
            {keyword && !forceExternal && (
              <span>🔍 Búsqueda local rápida por &ldquo;<strong style={{ color: 'var(--primary)' }}>{keyword}</strong>&rdquo;</span>
            )}
            {forceExternal && (
              <span>⚡ Búsqueda externa con IA — puede tardar varios segundos. Requiere Admin Token.</span>
            )}
          </div>
        </form>
      </div>

      {/* Warnings (non-destructive) */}
      {warnings.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {warnings.map((w, i) => (
              <p key={i} style={{ color: '#fbbf24', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Error (non-destructive if we have data) */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <p style={{ color: '#f87171', margin: 0, fontWeight: 500 }}>{error}</p>
          </div>
          {error.includes('límite') && (
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>
              Se ha detectado un corte de carga por tiempo límite. Es posible que visualice un <strong>resultado parcial</strong>.
            </p>
          )}
          <button
            onClick={mode === 'radar' ? (e: any) => { e.preventDefault(); handleSearch(e); } : () => loadWeeklyData(dateFrom, dateTo, keyword || undefined, matter || undefined)}
            style={{ alignSelf: 'flex-start', padding: '0.35rem 0.85rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem', marginBottom: '1.5rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto', width: '3rem', height: '3rem', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            {weeklyLoading ? 'Cargando resumen semanal…' : 'Procesando Radar'}
          </h3>
          {loadingState && (
            <p style={{ color: 'var(--primary)', fontWeight: 600, margin: 0, fontSize: '1.05rem' }}>{loadingState}</p>
          )}
        </div>
      )}

      {/* ── WEEKLY MODE (GET /api/legal/weekly-changes) ────────────────────── */}
      {mode === 'weekly' && weeklyData && !searchLoading && (
        <div>
          {/* Summary bar */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  📊 Resumen — {weeklyData.rangeUsed.defaulted ? 'Última semana' : `${weeklyData.rangeUsed.startDate} → ${weeklyData.rangeUsed.endDate}`}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#a5b4fc' }}>{weeklyData.summary.total}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total encontrados</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#10b981' }}>{weeklyData.summary.showing}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mostrando</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#f87171' }}>{weeklyData.summary.highImpact}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Alto impacto</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#ec4899' }}>
                    {Object.keys(weeklyData.summary.bySource).length}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fuentes</div>
                </div>
              </div>
            </div>

            {/* By type chips */}
            {Object.keys(weeklyData.summary.byType).length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(weeklyData.summary.byType).map(([type, count]) => (
                  <span key={type} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', textTransform: 'capitalize' }}>
                    {type} ({count})
                  </span>
                ))}
              </div>
            )}

            {/* Provider info */}
            {provider && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                IA disponible: {provider} ({model})
              </div>
            )}
          </div>

          {/* Empty state */}
          {weeklyData.results.length === 0 && !isLoading && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', borderStyle: 'dashed' }}>
              <span style={{ fontSize: '3rem' }}>📭</span>
              <h3 style={{ color: 'var(--text-main)', marginTop: '1rem', marginBottom: '0.5rem' }}>
                No hay cambios en el rango seleccionado
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.25rem auto' }}>
                {weeklyData.message ?? 'No se encontraron publicaciones locales en los últimos 7 días.'}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  id="radar-expand-range-btn"
                  className="btn-primary"
                  onClick={() => {
                    const newStart = new Date();
                    newStart.setDate(newStart.getDate() - 30);
                    const s = newStart.toISOString().slice(0, 10);
                    setDateFrom(s);
                    loadWeeklyData(s, dateTo);
                  }}
                  style={{ fontSize: '0.9rem' }}
                >
                  Ampliar a 30 días
                </button>
                <button
                  id="radar-force-external-btn"
                  className="btn-primary"
                  onClick={() => setForceExternal(true)}
                  style={{ fontSize: '0.9rem', background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.3)' }}
                >
                  Activar búsqueda externa
                </button>
              </div>
            </div>
          )}

          {/* Results list */}
          {weeklyData.results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {weeklyData.results.map((item) => {
                const badge  = getChangeTypeBadge(item.changeType);
                const impact = getImpactBadge(item.impact);
                return (
                  <div
                    key={item.id}
                    className="glass-card"
                    style={{ padding: '1.25rem', border: '1px solid var(--card-border)', transition: 'border-color 0.2s' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, fontWeight: 600, flex: 1 }}>{item.title}</h4>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: badge.bg, color: badge.color, border: badge.border, fontWeight: 700, textTransform: 'capitalize' }}>
                          {item.changeType}
                        </span>
                        {item.impact && (
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: impact.color, border: `1px solid ${impact.color}44`, fontWeight: 600 }}>
                            ★ {item.impact}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>🏛️ {item.source}</span>
                      {item.type && (
                        <><span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>📄 {item.type}</span></>
                      )}
                      {item.matter && (
                        <><span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>📁 {item.matter}</span></>
                      )}
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        📅 {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('es-MX') : 'Fecha desconocida'}
                      </span>
                    </div>

                    {item.summary && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '0.65rem 0.85rem', borderRadius: '6px', margin: '0 0 0.75rem 0', borderLeft: '3px solid var(--primary)', lineHeight: 1.5 }}>
                        {item.summary.length > 220 ? item.summary.slice(0, 220) + '…' : item.summary}
                      </p>
                    )}

                    {item.affectedSections.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Secciones:</span>
                        {item.affectedSections.slice(0, 5).map((sec, i) => (
                          <span key={i} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.04)', color: 'white', borderRadius: '3px', border: '1px solid var(--card-border)' }}>
                            {sec}
                          </span>
                        ))}
                      </div>
                    )}

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-doc-primary"
                      style={{ textDecoration: 'none', fontSize: '0.8rem', padding: '0.35rem 0.75rem', minHeight: 'auto', display: 'inline-block' }}
                    >
                      Ver documento →
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── RADAR MODE (POST /api/legal/radar — AI search) ───────────────── */}
      {mode === 'radar' && (radarStatus === 'success' || radarStatus === 'partial') && radarData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Summary */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>📊 Resumen Semanal Detectado</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Nuevos',     value: radarData.localResults.filter(r => r.status === 'nuevo').length,      color: '#10b981' },
                  { label: 'Modificados',value: radarData.localResults.filter(r => r.status === 'modificado').length, color: '#f59e0b' },
                  { label: 'Sin cambios',value: radarData.localResults.filter(r => r.status === 'sin cambios').length,color: '#3b82f6' },
                  { label: 'Externos',   value: totalExternalResults,                                                  color: '#ec4899' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>{value}</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
                  </div>
                ))}
              </div>
              {radarData.degraded && (
                <p style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(245,158,11,0.08)', padding: '0.5rem 0.75rem', borderRadius: '6px', margin: 0, border: '1px solid rgba(245,158,11,0.2)' }}>
                  ⚠️ Se muestran resultados locales. Algunas fuentes externas excedieron el tiempo de espera.
                </p>
              )}
            </div>

            {/* Local Results */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1.25rem 0' }}>🔍 Resultados para &ldquo;{radarData.query}&rdquo;</h3>

              {radarData.localResults.length === 0 && totalExternalResults === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                  {radarData.timedOutSources.length > 0 || radarData.degraded
                    ? `La búsqueda externa excedió el tiempo límite (timeout) en: ${radarData.timedOutSources.join(', ') || 'algunas fuentes'}. Intenta nuevamente.`
                    : `No se encontraron coincidencias locales ni externas para "${radarData.query}".`}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {radarData.localResults.map((res, i) => {
                    const badge = getStatusBadgeStyle(res.status);
                    return (
                      <div key={`local-${i}`} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)', margin: '0 1rem 0 0', fontWeight: 600 }}>{res.title}</h4>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: badge.bg, color: badge.color, border: badge.border, whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                            {res.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>🏛️ {res.source}</span>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>📄 {res.type}</span>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span style={{ color: 'var(--text-muted)' }}>📅 {res.publishedAt ? new Date(res.publishedAt).toLocaleDateString('es-MX') : 'Desconocida'}</span>
                          {res.matches > 0 && <><span style={{ color: 'var(--text-muted)' }}>•</span><span style={{ color: '#10b981', fontWeight: 600 }}>🔢 {res.matches} coincidencia(s)</span></>}
                        </div>
                        {res.excerpt && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '0.65rem', borderRadius: '6px', margin: '0 0 0.75rem 0', borderLeft: '3px solid var(--primary)', lineHeight: 1.4 }}>
                            &ldquo;{res.excerpt}&rdquo;
                          </p>
                        )}
                        <a href={res.officialUrl} target="_blank" rel="noopener noreferrer" className="btn-doc-primary" style={{ textDecoration: 'none', fontSize: '0.8rem', padding: '0.35rem 0.75rem', minHeight: 'auto', display: 'inline-block' }}>
                          Ver documento →
                        </a>
                      </div>
                    );
                  })}

                  {/* External results */}
                  {radarData.externalResults.map((group, gi) => (
                    <div key={`ext-${gi}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#ec4899', borderBottom: '1px solid rgba(236,72,153,0.2)', paddingBottom: '0.25rem', marginTop: '1rem' }}>
                        🏛️ {group.source}
                      </div>
                      {group.results.map((res, ri) => (
                        <div key={`ext-r-${gi}-${ri}`} style={{ background: 'rgba(236,72,153,0.02)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: '10px', padding: '1rem' }}>
                          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>{res.title}</h4>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem', fontSize: '0.75rem' }}>
                            {res.type && <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>📄 {res.type}</span>}
                            {res.date && <><span style={{ color: 'var(--text-muted)' }}>•</span><span style={{ color: 'var(--text-muted)' }}>📅 {new Date(res.date).toLocaleDateString('es-MX')}</span></>}
                          </div>
                          {res.excerpt && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '0.6rem', borderRadius: '6px', margin: '0 0 0.6rem 0', borderLeft: '3px solid #ec4899', lineHeight: 1.4 }}>
                             &ldquo;{res.excerpt}&rdquo;
                            </p>
                          )}
                          <a href={res.url} target="_blank" rel="noopener noreferrer" className="btn-doc-primary" style={{ textDecoration: 'none', fontSize: '0.8rem', padding: '0.35rem 0.75rem', minHeight: 'auto', display: 'inline-block' }}>
                            Ver documento →
                          </a>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Changes (from radar) */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1.25rem 0' }}>🔔 Reformas y Cambios Detectados</h3>
              {radarData.weeklyChanges.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                  No se detectaron reformas semanales directamente ligadas a la búsqueda.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {radarData.weeklyChanges.map((change, i) => (
                    <div key={`change-${i}`} style={{ background: 'rgba(245,158,11,0.02)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)', margin: '0 1rem 0 0', fontWeight: 600 }}>{change.title}</h4>
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', whiteSpace: 'nowrap', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {change.changeType}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        📅 {new Date(change.changedAt).toLocaleDateString('es-MX')}
                      </div>
                      {change.affectedSections.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Secciones:</span>
                          {change.affectedSections.map((sec, si) => (
                            <span key={si} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.04)', color: 'white', borderRadius: '3px', border: '1px solid var(--card-border)' }}>{sec}</span>
                          ))}
                        </div>
                      )}
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{change.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — AI analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {radarData.aiAnalysis && (
              <div className="glass-card" style={{ padding: '1.75rem', border: '2px solid rgba(99,102,241,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0 }}>🤖 Análisis RAG y Síntesis IA</h3>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                    {(radarData.aiAnalysis as AiAnalysis).provider} ({(radarData.aiAnalysis as AiAnalysis).model})
                  </span>
                </div>

                {(radarData.aiAnalysis as AiAnalysis).usedFallback && (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#f59e0b', marginBottom: '1.25rem' }}>
                    💡 Se usó un proveedor de respaldo porque el proveedor principal no respondió o alcanzó su límite.
                  </div>
                )}

                {(radarData.aiAnalysis as AiAnalysis).provider === 'local' && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#f87171', marginBottom: '1.25rem' }}>
                    ⚠️ Orientación local activa; confirma el resultado en fuentes oficiales antes de usarlo en un escrito.
                  </div>
                )}

                {radarStatus === 'partial' ? (
                  <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '1.25rem', borderRadius: '8px', color: '#f87171' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>⚠️ Análisis IA no disponible</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {radarData.warnings[0] ?? 'El análisis IA no pudo completarse en el tiempo disponible.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 700 }}>Resumen Ejecutivo:</h4>
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {(radarData.aiAnalysis as AiAnalysis).summary}
                      </p>
                    </div>
                    <div style={{ marginBottom: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--card-border)' }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--secondary)', marginBottom: '0.5rem', fontWeight: 700 }}>Impacto Jurídico:</h4>
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {(radarData.aiAnalysis as AiAnalysis).legalImpact}
                      </p>
                    </div>
                    {(radarData.aiAnalysis as AiAnalysis).attentionPoints.length > 0 && (
                      <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--card-border)' }}>
                        <h4 style={{ fontSize: '1rem', color: '#f59e0b', marginBottom: '0.75rem', fontWeight: 700 }}>Puntos de Atención:</h4>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {(radarData.aiAnalysis as AiAnalysis).attentionPoints.map((pt, i) => (
                            <li key={i} style={{ lineHeight: 1.5 }}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Sources */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1.25rem 0' }}>🔗 Fuentes Consultadas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                {lastQueryTime && (
                  <div><strong style={{ color: 'var(--text-muted)' }}>Hora de consulta:</strong>{' '}
                    <span style={{ color: 'white' }}>{lastQueryTime}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {radarData.sourcesConsulted.map((src, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#f8fafc', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                      <span style={{ color: '#10b981' }}>✓</span> {src}
                    </div>
                  ))}
                </div>
                {radarData.timedOutSources.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong style={{ color: '#fbbf24', fontSize: '0.82rem' }}>⏱ Fuentes con timeout:</strong>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {radarData.timedOutSources.map((s, i) => (
                        <span key={i} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error state in radar mode */}
      {mode === 'radar' && radarStatus === 'error' && !isLoading && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h3 style={{ color: '#f87171', marginTop: '1rem', marginBottom: '0.5rem' }}>Error en Búsqueda con IA</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.25rem auto' }}>
            {error || 'La búsqueda externa no pudo completarse.'}
          </p>
          <button
            id="radar-retry-weekly-btn"
            className="btn-primary"
            onClick={() => {
              setMode('weekly');
              setRadarStatus('idle');
              setError('');
              if (weeklyData) return; // already have data
              loadWeeklyData(dateFrom, dateTo);
            }}
          >
            Volver a resultados locales
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
