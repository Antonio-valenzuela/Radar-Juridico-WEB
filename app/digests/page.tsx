'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch, getAdminToken, setAdminToken } from '@/lib/client/adminToken';

export default function DigestsPage() {
  const [days, setDays] = useState(7);
  const [digest, setDigest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  const handleTokenChange = (v: string) => {
    setToken(v);
    setAdminToken(v);
  };

  const handleFetchError = async (res: Response) => {
    if (res.status === 401) {
      throw new Error('Token administrativo inválido o faltante.');
    }
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Error ${res.status}`);
  };

  const handleGenerate = async () => {
    if (!token.trim() && process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true') {
      setError('Escribe el Admin Token local.');
      return;
    }
    setLoading(true);
    setError('');
    setDigest(null);
    try {
      const res = await adminFetch(`/api/ai/weekly-digest?days=${days}`);
      if (!res.ok) await handleFetchError(res);
      const data = await res.json();
      setDigest(data.digest || data);
    } catch (err: any) {
      setError(process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO === 'true'
        ? 'No pude completar esta acción en este momento. Intenta de nuevo o ajusta tu búsqueda.'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-content">
      <Link href="/" className="back-link">
        &larr; Volver al Dashboard
      </Link>
      <h1>Resumen Semanal IA</h1>
      <p className="text-muted">Genera un digest ejecutivo de los documentos más importantes.</p>

      {process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO !== 'true' && (
        <div className="admin-token-input">
          <label>Admin Token:</label>
          <input
            type="text"
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-6)', alignItems: 'center' }}>
        <label style={{ color: 'var(--text-primary)' }}>Días a analizar:</label>
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="days-input"
        />
        <button onClick={handleGenerate} className="jr-button-primary" disabled={loading}>
          {loading ? 'Generando...' : 'Generar Digest'}
        </button>
      </div>

      {error && <p className="text-error" style={{ marginTop: 'var(--space-4)' }}>{error}</p>}

      {loading && <p style={{ marginTop: 'var(--space-6)' }}>Analizando documentos, por favor espera...</p>}

      {!loading && digest && (
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <h2>Digest generado</h2>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <p><strong>Total de documentos evaluados:</strong> {digest.totalDocuments || 0}</p>
            <p><strong>Documentos de alto impacto:</strong> {digest.highImpactCount || 0}</p>

            <h3 style={{ marginTop: 'var(--space-5)', color: 'var(--accent)' }}>Materias principales</h3>
            {digest.matters && Object.keys(digest.matters).length > 0 ? (
              <ul>
                {Object.entries(digest.matters).map(([matter, count]) => (
                  <li key={matter}>{matter}: {count as number}</li>
                ))}
              </ul>
            ) : <p>Ninguna destacada.</p>}

            <h3 style={{ marginTop: 'var(--space-5)', color: 'var(--accent)' }}>Highlights</h3>
            {digest.highlights && digest.highlights.length > 0 ? (
              <ul style={{ lineHeight: 1.6 }}>
                {digest.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            ) : <p>Sin highlights.</p>}

            <h3 style={{ marginTop: 'var(--space-5)', color: 'var(--accent)' }}>Recomendaciones</h3>
            {digest.recommendations && digest.recommendations.length > 0 ? (
              <ul style={{ lineHeight: 1.6 }}>
                {digest.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            ) : <p>Sin recomendaciones específicas.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
