'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SystemStatusPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch health status');
        return res.json();
      })
      .then(data => {
        setHealthData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <header style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
          &larr; Volver al Dashboard
        </Link>
        <h1>System Status</h1>
        <p className="subtitle" style={{ marginLeft: 0 }}>
          Monitoreo de salud de la plataforma, base de datos y workers.
        </p>
      </header>

      {loading && <p>Cargando estado del sistema...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {healthData && (
        <div className="grid">
          <div className="glass-card">
            <h2>General</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <p>
                <strong>API:</strong>{' '}
                <span style={{ color: healthData.ok ? '#10b981' : '#ef4444' }}>
                  {healthData.ok ? 'OK' : 'ERROR'}
                </span>
              </p>
              <p>
                <strong>Base de datos:</strong>{' '}
                <span style={{ color: healthData.db?.ok ? '#10b981' : '#ef4444' }}>
                  {healthData.db?.ok ? 'OK' : 'ERROR'}
                </span>
              </p>
              <p>
                <strong>Redis:</strong>{' '}
                <span style={{ color: healthData.redis?.ok ? '#10b981' : '#ef4444' }}>
                  {healthData.redis?.ok ? 'OK' : 'ERROR'}
                </span>
              </p>
              <p>
                <strong>Total documentos:</strong> {healthData.totalItems || 0}
              </p>
            </div>
          </div>

          <div className="glass-card">
            <h2>Queues</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {Array.isArray(healthData.queues) && healthData.queues.length > 0 ? (
                <ul style={{ marginLeft: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {healthData.queues.map((q: any) => (
                    <li key={q.name}>
                      <strong>{q.name}:</strong> {q.size} en cola
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sin información de colas disponible.</p>
              )}
            </div>
          </div>

          <div className="glass-card">
            <h2>Última ingesta</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {healthData.latestIngest ? (
                <>
                  <p><strong>source:</strong> {healthData.latestIngest.source}</p>
                  <p><strong>startedAt:</strong> {healthData.latestIngest.startedAt}</p>
                  <p><strong>finishedAt:</strong> {healthData.latestIngest.finishedAt}</p>
                  <p><strong>ok:</strong> {healthData.latestIngest.ok ? 'true' : 'false'}</p>
                  <p><strong>saved:</strong> {healthData.latestIngest.saved}</p>
                </>
              ) : (
                <p>Sin ingesta reciente.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {healthData && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Raw Health Response</h3>
          <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '4px', overflowX: 'auto', marginTop: '1rem', fontSize: '0.8rem', color: '#e2e8f0' }}>
            {JSON.stringify(healthData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
