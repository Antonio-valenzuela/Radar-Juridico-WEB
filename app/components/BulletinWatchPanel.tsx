"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch, getAdminToken, setAdminToken } from '@/lib/client/adminToken';

type BulletinWatchPanelProps = {
  matterId: string;
  caseNumber?: string | null;
  matter?: string | null;
  court?: string | null;
};

type BulletinPayload = {
  ok?: boolean;
  status?: string;
  message?: string;
  watches?: Array<{ id: string; active: boolean; source?: { name?: string }; expedienteNumber: string }>;
  entries?: Array<{ id: string; expedienteNumber: string; publicationDate?: string | null; heading?: string | null; extract?: string | null; sourceUrl: string; source?: { name?: string }; reviewed?: boolean; reviewedAt?: string | null; notes?: string | null; actuation?: { id: string; reviewed: boolean } | null }>;
  history?: Array<{ id: string; status: string; startedAt: string; completedAt?: string | null; resultsFound: number; newResults: number; errorCode?: string | null }>;
  warnings?: string[];
};

const statusLabel: Record<string, string> = {
  PUBLISHED: 'Publicado',
  NOT_FOUND_AS_OF: 'No encontrado al corte',
  SOURCE_UNAVAILABLE: 'Fuente no disponible',
  AUTH_REQUIRED: 'Requiere autenticación o revisión manual',
  SOURCE_CHANGED: 'Fuente modificada',
  INVALID_QUERY: 'Consulta inválida',
  PENDING_RETRY: 'Pendiente de reintento',
  MANUAL_REVIEW: 'Revisión manual',
  UNSUPPORTED: 'Fuente aún no soportada',
};

export default function BulletinWatchPanel({ matterId, caseNumber, matter, court }: BulletinWatchPanelProps) {
  const [payload, setPayload] = useState<BulletinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [form, setForm] = useState({ sourceSlug: 'boletin_judicial_jalisco', expedienteNumber: caseNumber || '', expedienteYear: '', matter: matter || '', judicialDistrict: '', court: court || '' });

  useEffect(() => {
    const token = getAdminToken();
    setTokenInput(token);
    setHasToken(Boolean(token));
  }, []);

  useEffect(() => {
    setForm((current) => ({ ...current, expedienteNumber: current.expedienteNumber || caseNumber || '', matter: current.matter || matter || '', court: current.court || court || '' }));
  }, [caseNumber, matter, court]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin`, { cache: 'no-store' });
      const next = (await response.json()) as BulletinPayload;
      if (!response.ok) throw new Error(next.message || 'No fue posible consultar el Boletín Judicial.');
      setPayload(next);
      setMessage(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED') { setHasToken(false); setTokenInput(''); setMessage('Ingresa el token administrativo para consultar el Boletín Judicial.'); } else setMessage('No fue posible consultar el Boletín Judicial.');
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => { void load(); }, [load]);

  const persistToken = () => {
    setAdminToken(tokenInput);
    setHasToken(Boolean(tokenInput.trim()));
    setMessage(tokenInput.trim() ? 'Token guardado.' : 'Ingresa el token administrativo para ejecutar esta acción.');
    if (tokenInput.trim()) void load();
  };

  const updateEntry = async (entryId: string, action: 'review' | 'actuation' | 'notes') => {
    const notes = action === 'notes' ? window.prompt('Notas de revisión (opcional):') : undefined;
    if (action === 'notes' && notes === null) return;
    setBusy(true);
    try {
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin/entry`, { method: 'POST', body: JSON.stringify({ entryId, action, ...(notes !== undefined ? { notes } : {}) }) });
      const next = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok) throw new Error(next.message || 'No fue posible actualizar la publicación.');
      setMessage(action === 'review' ? 'Publicación marcada como revisada.' : action === 'actuation' ? 'Actuación agregada al expediente.' : 'Notas guardadas.');
      await load();
    } catch (error) {
      if (error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED') { setHasToken(false); setTokenInput(''); setMessage('Ingresa el token administrativo para ejecutar esta acción.'); } else setMessage('No fue posible actualizar la publicación.');
    } finally { setBusy(false); }
  };

  const consultNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin`, { method: 'POST', body: JSON.stringify({ ...form, expedienteYear: form.expedienteYear || undefined }) });
      const next = (await response.json()) as BulletinPayload;
      if (!response.ok) throw new Error(next.message || 'No fue posible consultar la fuente oficial.');
      setPayload((current) => ({ ...current, ...next }));
      setMessage(`${statusLabel[next.status || ''] || next.status || 'Consulta completada'}.`);
      await load();
    } catch (error) {
      if (error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED') { setHasToken(false); setTokenInput(''); setMessage('Ingresa el token administrativo para ejecutar esta acción.'); } else setMessage('No fue posible consultar la fuente oficial.');
    } finally { setBusy(false); }
  };

  const toggleWatch = async (active: boolean) => {
    setBusy(true);
    try {
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin/watch`, active ? { method: 'POST', body: JSON.stringify({ ...form, expedienteYear: form.expedienteYear || undefined }) } : { method: 'DELETE', body: JSON.stringify({}) });
      const next = (await response.json()) as BulletinPayload;
      if (!response.ok) throw new Error(next.message || 'No fue posible actualizar la vigilancia.');
      setMessage(active ? 'Vigilancia activada.' : 'Vigilancia pausada.');
      await load();
    } catch (error) { if (error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED') { setHasToken(false); setTokenInput(''); setMessage('Ingresa el token administrativo para ejecutar esta acción.'); } else setMessage('No fue posible actualizar la vigilancia.'); }
    finally { setBusy(false); }
  };

  const downloadEvidence = () => {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `boletin-${caseNumber || matterId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const activeWatch = useMemo(() => payload?.watches?.find((watch) => watch.active), [payload]);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="legal-warning" role="note">La consulta distingue una falla de la fuente de un resultado no encontrado. Nunca se interpreta una falla de red como “no boletinado”.</div>
      <div className="legal-form-grid">
        <label>Fuente judicial<select value={form.sourceSlug} onChange={(event) => setForm({ ...form, sourceSlug: event.target.value })}><option value="boletin_judicial_jalisco">Boletín Judicial de Jalisco</option><option value="boletin_judicial_federal">PJF/CJF (revisión manual)</option><option value="tjajal_bulletin">TJA Jalisco (revisión manual)</option></select></label>
        <label>Número de expediente<input value={form.expedienteNumber} onChange={(event) => setForm({ ...form, expedienteNumber: event.target.value })} /></label>
        <label>Año<input inputMode="numeric" value={form.expedienteYear} onChange={(event) => setForm({ ...form, expedienteYear: event.target.value })} /></label>
        <label>Materia<input value={form.matter} onChange={(event) => setForm({ ...form, matter: event.target.value })} /></label>
        <label>Partido judicial<input value={form.judicialDistrict} onChange={(event) => setForm({ ...form, judicialDistrict: event.target.value })} /></label>
        <label>Juzgado o sala<input value={form.court} onChange={(event) => setForm({ ...form, court: event.target.value })} /></label>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-doc-primary" onClick={() => void consultNow()} disabled={busy}>{busy ? 'Consultando…' : 'Consultar ahora'}</button>
        {!activeWatch ? <button type="button" className="btn-doc-secondary" onClick={() => void toggleWatch(true)} disabled={busy}>Activar vigilancia</button> : <button type="button" className="btn-doc-secondary" onClick={() => void toggleWatch(false)} disabled={busy}>Pausar vigilancia</button>}
        <button type="button" className="btn-doc-secondary" onClick={downloadEvidence} disabled={!payload}>Descargar evidencia</button>
      </div>
      {!hasToken && <div className="legal-meta-block"><label>Token administrativo<input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} autoComplete="off" /></label><button type="button" className="btn-doc-secondary" onClick={persistToken}>Guardar token</button></div>}
      {message && <p role="status">{message}</p>}
      {loading ? <p role="status">Consultando historial…</p> : null}
      {payload?.status && <p><strong>Estado:</strong> {statusLabel[payload.status] || payload.status}</p>}
      {payload?.warnings?.map((warning) => <p key={warning} className="document-muted">Advertencia: {warning}</p>)}
      {payload?.entries?.map((entry) => <article key={entry.id} className="legal-meta-block"><strong>{entry.heading || `Expediente ${entry.expedienteNumber}`}</strong><p>{entry.source?.name || 'Fuente oficial'} · {entry.publicationDate ? new Date(entry.publicationDate).toLocaleString('es-MX') : 'Fecha no entregada por la fuente'}</p><p>{entry.extract || 'Sin extracto disponible.'}</p>{entry.notes && <p><strong>Notas:</strong> {entry.notes}</p>}<div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}><a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="btn-doc-secondary">Abrir publicación oficial</a><button type="button" className="btn-doc-secondary" onClick={() => void updateEntry(entry.id, 'review')} disabled={busy || entry.reviewed}>{entry.reviewed ? 'Revisada' : 'Marcar como revisada'}</button><button type="button" className="btn-doc-secondary" onClick={() => void updateEntry(entry.id, 'actuation')} disabled={busy || Boolean(entry.actuation)}>Agregar como actuación</button><button type="button" className="btn-doc-secondary" onClick={() => void updateEntry(entry.id, 'notes')} disabled={busy}>Guardar notas</button>{entry.actuation && <span>{entry.actuation.reviewed ? 'Actuación revisada' : 'Actuación pendiente de revisión'}</span>}</div></article>)}
      {!loading && !payload?.entries?.length && payload?.status === 'NOT_FOUND_AS_OF' && <p>No se encontró publicación al corte de la consulta.</p>}
      {payload?.history?.length ? <details><summary>Ver historial</summary><ul>{payload.history.map((run) => <li key={run.id}>{new Date(run.startedAt).toLocaleString('es-MX')} · {statusLabel[run.status] || run.status} · resultados: {run.resultsFound} · nuevos: {run.newResults}</li>)}</ul></details> : null}
    </div>
  );
}
