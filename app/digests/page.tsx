'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DigestsPage() {
  const [days, setDays] = useState(7);
  const [digest, setDigest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('dev-admin-token');

  useEffect(() => {
    const saved = localStorage.getItem('juridico_admin_token');
    if (saved) setToken(saved);
  }, []);

  const handleTokenChange = (v: string) => {
    setToken(v);
    localStorage.setItem('juridico_admin_token', v);
  };

  const handleFetchError = async (res: Response) => {
    if (res.status === 401) {
      throw new Error('Token inválido o faltante. Usa dev-admin-token en local.');
    }
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Error ${res.status}`);
  };

  const handleGenerate = async () => {
    if (!token.trim()) {
      setError('Escribe el Admin Token local.');
      return;
    }
    setLoading(true);
    setError('');
    setDigest(null);
    try {
      const res = await fetch(`/api/ai/weekly-digest?days=${days}`, {
        headers: { 'x-admin-token': token.trim() }
      });
      if (!res.ok) await handleFetchError(res);
      const data = await res.json();
      setDigest(data.digest || data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
        &larr; Volver al Dashboard
      </Link>
      <h1>Resumen Semanal IA</h1>
      <p style={{ color: 'var(--text-muted)' }}>Genera un digest ejecutivo de los documentos más importantes.</p>
      
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{ fontWeight: 'bold' }}>Admin Token:</label>
        <input 
          type="text" 
          value={token} 
          onChange={(e) => handleTokenChange(e.target.value)} 
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', background: '#1e293b', color: 'white' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', alignItems: 'center' }}>
        <label>Días a analizar:</label>
        <input 
          type="number" 
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{ width: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--card-border)', background: '#0f172a', color: 'white' }}
        />
        <button onClick={handleGenerate} className="btn-primary" disabled={loading}>
          {loading ? 'Generando...' : 'Generar Digest'}
        </button>
      </div>

      {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}

      {loading && <p style={{ marginTop: '2rem' }}>Analizando documentos, por favor espera...</p>}

      {!loading && digest && (
        <div className="glass-card" style={{ marginTop: '2rem' }}>
          <h2>Digest generado</h2>
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Total de documentos evaluados:</strong> {digest.totalDocuments || 0}</p>
            <p><strong>Documentos de alto impacto:</strong> {digest.highImpactCount || 0}</p>
            
            <h3 style={{ marginTop: '1.5rem', color: 'var(--accent)' }}>Materias principales</h3>
            {digest.matters && Object.keys(digest.matters).length > 0 ? (
              <ul>
                {Object.entries(digest.matters).map(([matter, count]) => (
                  <li key={matter}>{matter}: {count as number}</li>
                ))}
              </ul>
            ) : <p>Ninguna destacada.</p>}

            <h3 style={{ marginTop: '1.5rem', color: 'var(--accent)' }}>Highlights</h3>
            {digest.highlights && digest.highlights.length > 0 ? (
              <ul style={{ lineHeight: 1.6 }}>
                {digest.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            ) : <p>Sin highlights.</p>}

            <h3 style={{ marginTop: '1.5rem', color: 'var(--accent)' }}>Recomendaciones</h3>
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
