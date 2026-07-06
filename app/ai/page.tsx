'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const EMPTY_USAGE_SUMMARY = {
  totalAttempts: 0,
  totalSuccesses: 0,
  totalFailures: 0,
  totalFallbacks: 0,
  estimatedTokens: 0,
  estimatedCostUsd: '0.000000',
};

const EMPTY_PROVIDERS: any[] = [];

export default function AILegalPage() {
  const [token, setToken] = useState('dev-admin-token');
  
  useEffect(() => {
    const saved = localStorage.getItem('juridico_admin_token');
    if (saved) setToken(saved);
  }, []);

  const handleTokenChange = (v: string) => {
    setToken(v);
    localStorage.setItem('juridico_admin_token', v);
  };
  
  const [analyzeTitle, setAnalyzeTitle] = useState('Resolución del SAT sobre obligaciones fiscales');
  const [analyzeSummary, setAnalyzeSummary] = useState('Nueva disposición fiscal para contribuyentes y empresas.');
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const [matchRule, setMatchRule] = useState('Avísame sobre cambios fiscales para empresas');
  const [matchTitle, setMatchTitle] = useState('Resolución del SAT sobre obligaciones fiscales');
  const [matchSummary, setMatchSummary] = useState('Nueva disposición fiscal para contribuyentes y empresas.');
  const [matchResult, setMatchResult] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');

  const [digestDays, setDigestDays] = useState(7);
  const [digestResult, setDigestResult] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState('');

  const [limitsResult, setLimitsResult] = useState<any>(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsError, setLimitsError] = useState('');

  const usageSummary = limitsResult?.ok ? (limitsResult?.summary ?? EMPTY_USAGE_SUMMARY) : EMPTY_USAGE_SUMMARY;
  const usageProviders = limitsResult?.ok && Array.isArray(limitsResult?.providers) ? limitsResult.providers : EMPTY_PROVIDERS;
  const usageDate = limitsResult?.date ?? '';
  const usageTimezone = limitsResult?.timezone ?? '';

  const handleFetchError = async (res: Response) => {
    if (res.status === 401) {
      throw new Error('Token inválido o faltante. Usa dev-admin-token en local.');
    }
    if (res.status === 400) {
      throw new Error('Solicitud inválida. Revisa los campos enviados.');
    }
    if (res.status === 500) {
      throw new Error('Error interno. Revisa docker compose logs frontend.');
    }
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Error ${res.status}`);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setAnalyzeError('Escribe el Admin Token local.');
      return;
    }
    setAnalyzeLoading(true);
    setAnalyzeError('');
    setAnalyzeResult(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify({ title: analyzeTitle, summary: analyzeSummary }),
      });
      if (!res.ok) await handleFetchError(res);
      setAnalyzeResult(await res.json());
    } catch (err: any) {
      setAnalyzeError(err.message);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setMatchError('Escribe el Admin Token local.');
      return;
    }
    setMatchLoading(true);
    setMatchError('');
    setMatchResult(null);
    try {
      const res = await fetch('/api/ai/match-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify({
          ruleText: matchRule,
          documentTitle: matchTitle,
          documentSummary: matchSummary,
        }),
      });
      if (!res.ok) await handleFetchError(res);
      setMatchResult(await res.json());
    } catch (err: any) {
      setMatchError(err.message);
    } finally {
      setMatchLoading(false);
    }
  };

  const handleDigest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setDigestError('Escribe el Admin Token local.');
      return;
    }
    setDigestLoading(true);
    setDigestError('');
    setDigestResult(null);
    try {
      const res = await fetch(`/api/ai/weekly-digest?days=${digestDays}`, {
        method: 'GET',
        headers: {
          'x-admin-token': token.trim(),
        },
      });
      if (!res.ok) await handleFetchError(res);
      setDigestResult(await res.json());
    } catch (err: any) {
      setDigestError(err.message);
    } finally {
      setDigestLoading(false);
    }
  };

  const handleCheckLimits = async () => {
    if (!token.trim()) {
      setLimitsError('Escribe el Admin Token local.');
      return;
    }
    setLimitsLoading(true);
    setLimitsError('');
    setLimitsResult(null);
    try {
      const res = await fetch('/api/ai/usage', {
        method: 'GET',
        headers: {
          'x-admin-token': token,
        },
      });
      if (res.status === 401) {
        setLimitsError('Este panel requiere Admin Token para consultar métricas internas. Verifica el Admin Token.');
        return;
      }
      if (!res.ok) {
        setLimitsError('No se pudo cargar el consumo de IA. Verifica el Admin Token.');
        return;
      }
      const data = await res.json();
      if (!data || data.ok === false) {
        setLimitsError(data?.error || data?.message || 'No se pudo cargar el consumo de IA.');
      } else {
        setLimitsResult(data);
      }
    } catch (err: any) {
      setLimitsError('No se pudo cargar el consumo de IA. Verifica el Admin Token.');
    } finally {
      setLimitsLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          &larr; Volver al Dashboard
        </Link>
        {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
          <Link href="/admin/sources" style={{ border: '1px dashed var(--secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ⚙ Fuentes Oficiales (Admin)
          </Link>
        )}
      </div>
      <header style={{ marginBottom: '2rem' }}>
        <h1>IA Legal</h1>
        <p className="subtitle" style={{ marginLeft: 0 }}>
          Analiza publicaciones oficiales, compara alertas y genera resumen semanal usando la capa de IA de Jurídico Radar.
        </p>
        {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold' }}>Admin Token:</label>
            <input 
              type="text" 
              value={token} 
              onChange={(e) => handleTokenChange(e.target.value)} 
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', background: '#1e293b', color: 'white' }}
            />
            <button onClick={handleCheckLimits} className="btn-primary" disabled={limitsLoading} style={{ background: '#3b82f6' }}>
              {limitsLoading ? 'Consultando...' : 'Ver intentos restantes de IA'}
            </button>
          </div>
        )}
        
        {limitsError && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{limitsError}</p>}
        {limitsResult && (
          <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid #3b82f6', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📈 Consumo de IA Real {usageDate ? `(Hoy: ${usageDate})` : ''}</span>
              {usageTimezone && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Zona horaria: {usageTimezone}</span>}
            </h3>
            
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Intentos totales hoy</p>
                <h2 style={{ margin: '0.25rem 0 0 0' }}>{usageSummary.totalAttempts}</h2>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Éxitos / Fallos</p>
                <h2 style={{ margin: '0.25rem 0 0 0', color: '#10b981' }}>
                  {usageSummary.totalSuccesses} <span style={{ color: '#ef4444', fontSize: '1rem', fontWeight: 'normal' }}>/ {usageSummary.totalFailures}</span>
                </h2>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Fallbacks activados</p>
                <h2 style={{ margin: '0.25rem 0 0 0', color: '#f59e0b' }}>{usageSummary.totalFallbacks}</h2>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Costo total estimado</p>
                <h2 style={{ margin: '0.25rem 0 0 0', color: '#60a5fa' }}>${usageSummary.estimatedCostUsd}</h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {usageProviders.map((p: any) => (
                <div key={p.provider} style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, textTransform: 'capitalize', fontSize: '1.1rem' }}>
                      {p.provider === "gemini" ? "Google Gemini" : p.provider === "groq" ? "Groq API" : p.provider === "openrouter" ? "OpenRouter" : "Procesamiento Local"}
                    </h4>
                    <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: p.configured ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: p.configured ? '#10b981' : '#ef4444' }}>
                      {p.configured ? 'Configurado' : 'Sin Configurar'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div><strong>Intentos:</strong> {p.attempts ?? 0}</div>
                    <div><strong>Éxitos / Fallos:</strong> {p.successes ?? 0} / {p.failures ?? 0}</div>
                    <div><strong>Tokens:</strong> {(p.attempts ?? 0) > 0 ? `${p.estimatedTokens ?? 0} (est.)` : '0'}</div>
                    <div><strong>Costo:</strong> {p.provider === "local" ? 'N/A' : p.provider === "openrouter" && p.costSource === "provider_metadata" ? '$0.00' : `$${p.estimatedCostUsd ?? '0.000000'} USD`}</div>
                  </div>

                  {(p.failures ?? 0) > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#f87171' }}>
                      ⚠️ Fallos categorizados: rateLimit={p.rateLimited ?? 0}, quotaExceeded={p.quotaExceeded ?? 0}, timeout={p.timeouts ?? 0}, missingKey={p.missingKey ?? 0}, invalidKey={p.invalidKey ?? 0}
                    </div>
                  )}

                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <strong>Límite y Rate Limit:</strong> {p.rateLimit?.remaining != null ? `Restan ${p.rateLimit.remaining} req (Límite: ${p.rateLimit.limit}). ` : ''}{p.rateLimit?.note ?? ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="grid">
        {/* Card 1: Analizar documento */}
        <div className="glass-card">
          <h2>Analizar documento</h2>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Analiza documento: clasifica y resume una publicación oficial.</p>
          <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              placeholder="Título" 
              value={analyzeTitle} 
              onChange={e => setAnalyzeTitle(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
            />
            <textarea 
              placeholder="Resumen" 
              value={analyzeSummary} 
              onChange={e => setAnalyzeSummary(e.target.value)}
              rows={3}
              style={{ padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
            />
            <button type="submit" className="btn-primary" disabled={analyzeLoading}>
              {analyzeLoading ? 'Analizando...' : 'Analizar con IA'}
            </button>
          </form>
          {analyzeError && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{analyzeError}</p>}
          {analyzeResult && analyzeResult.analysis && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <p><strong>Materia:</strong> {analyzeResult.analysis.matter}</p>
              <p><strong>Confianza:</strong> {analyzeResult.analysis.confidence}</p>
              <p><strong>Resumen:</strong> {analyzeResult.analysis.summary}</p>
              <p><strong>Entidades:</strong> {analyzeResult.analysis.entities?.join(', ')}</p>
              <p><strong>Sectores afectados:</strong> {analyzeResult.analysis.affectedSectors?.join(', ')}</p>
              <p><strong>Impacto:</strong> <span className={`alert-impact-${analyzeResult.analysis.impactLevel}`}>{analyzeResult.analysis.impactLevel}</span></p>
              <p><strong>Keywords:</strong> {analyzeResult.analysis.keywords?.join(', ')}</p>
              {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
                <>
                  <p><strong>Proveedor:</strong> {analyzeResult.provider}</p>
                  <details style={{ marginTop: '1rem' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Ver JSON completo</summary>
                    <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '4px', overflowX: 'auto', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                      {JSON.stringify(analyzeResult, null, 2)}
                    </pre>
                  </details>
                </>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Comparar alerta */}
        <div className="glass-card">
          <h2>Comparar alerta</h2>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Comparar alerta: revisa si un documento coincide con una alerta del usuario.</p>
          <form onSubmit={handleMatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              placeholder="Regla de alerta" 
              value={matchRule} 
              onChange={e => setMatchRule(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
            />
            <input 
              placeholder="Título del documento" 
              value={matchTitle} 
              onChange={e => setMatchTitle(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
            />
            <textarea 
              placeholder="Resumen del documento" 
              value={matchSummary} 
              onChange={e => setMatchSummary(e.target.value)}
              rows={3}
              style={{ padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
            />
            <button type="submit" className="btn-primary" disabled={matchLoading}>
              {matchLoading ? 'Comparando...' : 'Comparar alerta'}
            </button>
          </form>
          {matchError && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{matchError}</p>}
          {matchResult && matchResult.match && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <p><strong>Matched:</strong> <span style={{ color: matchResult.match.matched ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{matchResult.match.matched ? 'True' : 'False'}</span></p>
              <p><strong>Score:</strong> {matchResult.match.score}</p>
              <p><strong>Reasons:</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {matchResult.match.reasons?.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
              <p><strong>Matched Keywords:</strong> {matchResult.match.matchedKeywords?.join(', ')}</p>
              {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Ver JSON completo</summary>
                  <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '4px', overflowX: 'auto', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    {JSON.stringify(matchResult, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Card 3: Resumen semanal */}
        <div className="glass-card">
          <h2>Resumen semanal</h2>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Resumen semanal: genera digest de documentos recientes.</p>
          <form onSubmit={handleDigest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label>Días:</label>
              <input 
                type="number" 
                value={digestDays} 
                onChange={e => setDigestDays(Number(e.target.value))}
                style={{ width: '80px', padding: '0.5rem', borderRadius: '4px', background: '#0f172a', color: 'white', border: '1px solid var(--card-border)' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={digestLoading}>
              {digestLoading ? 'Generando...' : 'Generar resumen semanal'}
            </button>
          </form>
          {digestError && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{digestError}</p>}
          {digestResult && digestResult.digest && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <p><strong>Total Documents:</strong> {digestResult.digest.totalDocuments}</p>
              <p><strong>High Impact Count:</strong> {digestResult.digest.highImpactCount}</p>
              <p><strong>Matters:</strong> {Object.keys(digestResult.digest.matters || {}).join(', ')}</p>
              <p><strong>Highlights:</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {digestResult.digest.highlights?.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
              <p><strong>Recommendations:</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {digestResult.digest.recommendations?.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
              {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Ver JSON completo</summary>
                  <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '4px', overflowX: 'auto', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    {JSON.stringify(digestResult, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
