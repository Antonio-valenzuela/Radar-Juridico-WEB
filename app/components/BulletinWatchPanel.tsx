"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from '@/lib/client/adminToken';

type BulletinWatchPanelProps = {
  matterId: string;
  caseNumber?: string | null;
  matter?: string | null;
  court?: string | null;
};

type Watch = {
  id: string;
  active: boolean;
  expedienteNumber: string;
  lastCheckedAt?: string | null;
  lastSuccessfulAt?: string | null;
  lastQueryStatus?: string | null;
  lastPublicationStatus?: string | null;
  nextCheckAt?: string | null;
  source?: { name?: string };
};

type Entry = {
  id: string;
  expedienteNumber: string;
  expedienteYear?: number | null;
  matterLabel?: string | null;
  judicialDistrict?: string | null;
  court?: string | null;
  chamber?: string | null;
  bulletinNumber?: string | null;
  publicationDate?: string | null;
  publicationDateRaw?: string | null;
  agreementDate?: string | null;
  agreementDateRaw?: string | null;
  proceedingType?: string | null;
  heading?: string | null;
  extract?: string | null;
  sourceUrl: string;
  firstSeenAt?: string | null;
  lastVerifiedAt?: string | null;
  verificationStatus?: string | null;
  origin?: string | null;
  source?: { name?: string };
  reviewed?: boolean;
  reviewedAt?: string | null;
  notes?: string | null;
  actuation?: { id: string; reviewed: boolean } | null;
};

type HistoryRun = {
  id: string;
  status: string;
  queryStatus?: string | null;
  publicationStatus?: string | null;
  startedAt: string;
  completedAt?: string | null;
  resultsFound: number;
  newResults: number;
  errorCode?: string | null;
};

type BulletinPayload = {
  ok?: boolean;
  status?: string;
  queryStatus?: string;
  publicationStatus?: string;
  message?: string;
  checkedAt?: string;
  watches?: Watch[];
  entries?: Entry[];
  history?: HistoryRun[];
  warnings?: string[];
  lastCheck?: HistoryRun | null;
  nextCheckAt?: string | null;
};

type ImportPreview = {
  ok: boolean;
  mode: 'preview' | 'confirm';
  origin: string;
  publicationsAnalyzed: number;
  watchedCasesFound: number;
  newPublications: number;
  duplicates: number;
  unmatched: number;
  saved: number;
  previewToken?: string;
  previewExpiresAt?: string;
  sourceUrl: string;
  publications: Array<{
    expedienteNumber: string;
    expedienteYear: number;
    heading: string;
    extract: string;
    contentHash: string;
    matches: Array<{
      watchId: string;
      matterId: string;
      sourceId: string;
      duplicate: boolean;
      entryId?: string;
    }>;
  }>;
};

const queryStatusLabel: Record<string, string> = {
  SUCCESS: 'Consulta oficial completada',
  SOURCE_UNAVAILABLE: 'Fuente no disponible',
  SOURCE_CHANGED: 'La fuente cambió',
  TIMEOUT: 'La fuente excedió el tiempo de respuesta',
  RATE_LIMITED: 'La fuente limitó temporalmente las consultas',
  AUTH_REQUIRED: 'Requiere autenticación, CAPTCHA o revisión manual',
  MANUAL_REVIEW: 'Requiere revisión manual',
  PROVIDER_ERROR: 'Error temporal del proveedor',
  INVALID_QUERY: 'Configuración inválida',
  UNSUPPORTED: 'Fuente aún no soportada',
};

const publicationStatusLabel: Record<string, string> = {
  NEW_PUBLICATIONS: 'PUBLICACIÓN NUEVA',
  HAS_PREVIOUS_PUBLICATIONS: 'PUBLICACIONES ANTERIORES',
  NO_PUBLICATION_FOUND_AS_OF: 'SIN PUBLICACIÓN AL CORTE',
  CASE_NOT_CONFIGURED: 'CONFIGURACIÓN INCOMPLETA',
  INVALID_CASE_CONFIGURATION: 'CONFIGURACIÓN INCOMPLETA',
  UNKNOWN: 'NO FUE POSIBLE DETERMINAR EL ESTADO',
  UNCONFIRMED: 'EXPEDIENTE LOCALIZADO - BOLETÍN NO CONFIRMADO'
};

const JALISCO_MATERIAS = [
  'CIVIL', 'FAMILIAR', 'MERCANTIL', 'PENAL', 'LABORAL', 'ADMINISTRATIVO', 'OTRA'
];

const JALISCO_PARTIDOS = [
  'PRIMER PARTIDO JUDICIAL (ZAPOPAN)',
  'PRIMER PARTIDO JUDICIAL (GUADALAJARA)',
  'PRIMER PARTIDO JUDICIAL (TLAQUEPAQUE)',
  'PRIMER PARTIDO JUDICIAL (TONALÁ)',
  'SEGUNDO PARTIDO JUDICIAL (CHAPALA)',
  'TERCER PARTIDO JUDICIAL (LAGOS DE MORENO)',
  'CUARTO PARTIDO JUDICIAL (OCOTLÁN)',
  'QUINTO PARTIDO JUDICIAL (PUERTO VALLARTA)',
  'SEXTO PARTIDO JUDICIAL (CIUDAD GUZMÁN)',
  'SÉPTIMO PARTIDO JUDICIAL (AUTLÁN DE NAVARRO)',
  'OCTAVO PARTIDO JUDICIAL (TEPATITLÁN DE MORELOS)',
  'NOVENO PARTIDO JUDICIAL (AMECA)',
  'DÉCIMO PARTIDO JUDICIAL (TEQUILA)'
];

const JALISCO_JUZGADOS = [
  'Juzgado Primero de lo Civil',
  'Juzgado Segundo de lo Civil',
  'Juzgado Tercero de lo Civil',
  'Juzgado Primero de lo Familiar',
  'Juzgado Segundo de lo Familiar',
  'Juzgado Tercero de lo Familiar',
  'Juzgado Primero de lo Mercantil',
  'Juzgado Segundo de lo Mercantil',
  'Juzgado Primero de lo Penal',
  'Juzgado Segundo de lo Penal',
  'Juzgado Menor',
  'Juzgado Mixto'
];

function dateLabel(value?: string | null) {
  if (!value) return 'No entregada por la fuente';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-MX');
}

function StatusBadge({ type, status }: { type: 'query' | 'publication', status?: string | null }) {
  if (!status) return null;
  const label = type === 'query' ? queryStatusLabel[status] || status : publicationStatusLabel[status] || status;
  let style: React.CSSProperties = { display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' };

  if (type === 'publication') {
    if (status === 'NEW_PUBLICATIONS') style = { ...style, backgroundColor: '#d1fae5', color: '#065f46' };
    else if (status === 'NO_PUBLICATION_FOUND_AS_OF') style = { ...style, backgroundColor: '#fef3c7', color: '#92400e' };
    else if (status === 'HAS_PREVIOUS_PUBLICATIONS') style = { ...style, backgroundColor: '#e0e7ff', color: '#3730a3' };
    else if (status === 'UNCONFIRMED') style = { ...style, backgroundColor: '#ffedd5', color: '#9a3412' };
    else style = { ...style, backgroundColor: '#f3f4f6', color: '#1f2937' };
  } else {
    if (status === 'SUCCESS') style = { ...style, backgroundColor: '#d1fae5', color: '#065f46' };
    else if (status === 'AUTH_REQUIRED' || status === 'MANUAL_REVIEW') style = { ...style, backgroundColor: '#fee2e2', color: '#991b1b' };
    else if (status === 'SOURCE_UNAVAILABLE' || status === 'TIMEOUT' || status === 'PROVIDER_ERROR') style = { ...style, backgroundColor: '#fef3c7', color: '#92400e' };
    else style = { ...style, backgroundColor: '#f3f4f6', color: '#1f2937' };
  }

  return <span style={style}>{label}</span>;
}

export default function BulletinWatchPanel({ matterId, caseNumber, matter, court }: BulletinWatchPanelProps) {
  const [payload, setPayload] = useState<BulletinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [form, setForm] = useState({
    sourceSlug: 'boletin_judicial_jalisco',
    expedienteNumber: caseNumber || '', expedienteYear: '', matter: matter || '',
    judicialDistrict: '', court: court || '',
  });
  const [importType, setImportType] = useState<'text' | 'url' | 'pdf'>('text');
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [noteEntryId, setNoteEntryId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const [entriesPage, setEntriesPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    const token = getAdminToken();
    setTokenInput(token);
    setHasToken(Boolean(token));
  }, []);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      expedienteNumber: current.expedienteNumber || caseNumber || '',
      matter: current.matter || matter || '',
      court: current.court || court || '',
    }));
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
      if (error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED') {
        setHasToken(false);
        setTokenInput('');
        setMessage('Ingresa el token administrativo para consultar el Boletín Judicial.');
      } else setMessage('No fue posible consultar el Boletín Judicial.');
    } finally {
      setLoading(false);
    }
  }, [matterId]);

  useEffect(() => { void load(); }, [load]);

  const persistToken = () => {
    const token = setAdminToken(tokenInput);
    setHasToken(Boolean(token));
    setMessage(token ? 'Token guardado.' : 'Ingresa el token administrativo para ejecutar esta acción.');
    if (token) void load();
  };

  const forgetToken = () => {
    clearAdminToken();
    setTokenInput('');
    setHasToken(false);
    setMessage('Token administrativo eliminado de este navegador.');
  };

  const updateEntry = async (entryId: string, action: 'review' | 'actuation' | 'notes') => {
    if (action === 'notes') {
      setNoteEntryId(entryId);
      setNoteText('');
      return;
    }
    setBusy(true);
    try {
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin/entry`, {
        method: 'POST', body: JSON.stringify({ entryId, action }),
      });
      const next = await response.json() as { message?: string };
      if (!response.ok) throw new Error(next.message || 'No fue posible actualizar la publicación.');
      setMessage(action === 'review' ? 'Publicación marcada como revisada.' : 'Actuación agregada al expediente.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED'
        ? 'Ingresa el token administrativo para ejecutar esta acción.'
        : 'No fue posible actualizar la publicación.');
    } finally { setBusy(false); }
  };

  const submitNote = async () => {
    if (!noteEntryId) return;
    setBusy(true);
    try {
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin/entry`, {
        method: 'POST', body: JSON.stringify({ entryId: noteEntryId, action: 'notes', notes: noteText }),
      });
      const next = await response.json() as { message?: string };
      if (!response.ok) throw new Error(next.message || 'No fue posible guardar las notas.');
      setNoteEntryId(null);
      setNoteText('');
      setMessage('Notas guardadas.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED'
        ? 'Ingresa el token administrativo para ejecutar esta acción.'
        : 'No fue posible guardar las notas.');
    } finally { setBusy(false); }
  };

  const consultNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin/check`, {
        method: 'POST', body: JSON.stringify({ ...form, expedienteYear: form.expedienteYear || undefined }),
      });
      const next = (await response.json()) as BulletinPayload;
      if (!response.ok) throw new Error(next.message || 'No fue posible consultar la fuente oficial.');
      setPayload((current) => ({ ...current, ...next }));
      setMessage(`${queryStatusLabel[next.queryStatus || ''] || 'Consulta terminada'}. ${publicationStatusLabel[next.publicationStatus || ''] || ''}`.trim());
      await load();
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED'
        ? 'Ingresa el token administrativo para ejecutar esta acción.'
        : 'No fue posible consultar la fuente oficial. El estado de publicación queda indeterminado.');
    } finally { setBusy(false); }
  };

  const activeWatch = useMemo(() => payload?.watches?.find((watch) => watch.active), [payload]);

  const toggleWatch = async (active: boolean) => {
    setBusy(true);
    try {
      const request = active
        ? { method: 'POST', body: JSON.stringify({ ...form, expedienteYear: form.expedienteYear || undefined }) }
        : { method: 'DELETE', body: JSON.stringify({ watchId: activeWatch?.id }) };
      const response = await adminFetch(`/api/legal/cases/${matterId}/bulletin/watch`, request);
      const next = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(next.message || 'No fue posible actualizar la vigilancia.');
      setMessage(active ? 'Vigilancia activada.' : 'Vigilancia pausada.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED'
        ? 'Ingresa el token administrativo para ejecutar esta acción.'
        : 'No fue posible actualizar la vigilancia.');
    } finally { setBusy(false); }
  };

  const importBulletin = async (mode: 'preview' | 'confirm') => {
    setBusy(true);
    setMessage(null);
    try {
      let init: RequestInit;
      if (importType === 'pdf') {
        if (!importFile) throw new Error('Selecciona un PDF.');
        const data = new FormData();
        data.set('mode', mode);
        data.set('file', importFile);
        if (mode === 'confirm' && importPreview?.previewToken) {
          data.set('previewToken', importPreview.previewToken);
        }
        init = { method: 'POST', body: data };
      } else {
        init = {
          method: 'POST',
          body: JSON.stringify(importType === 'url'
            ? { type: 'url', mode, url: importUrl, previewToken: mode === 'confirm' ? importPreview?.previewToken : undefined }
            : { type: 'text', mode, text: importText, previewToken: mode === 'confirm' ? importPreview?.previewToken : undefined }),
        };
      }
      const response = await adminFetch('/api/legal/bulletins/import', init);
      const next = await response.json() as ImportPreview & { message?: string };
      if (!response.ok) throw new Error(next.message || 'No fue posible analizar el boletín.');
      setImportPreview(next);
      setMessage(mode === 'preview' ? 'Vista previa lista. Confirma sólo después de revisarla.' : `Importación confirmada: ${next.saved} publicaciones guardadas.`);
      if (mode === 'confirm') await load();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : 'No fue posible importar el boletín.');
    } finally { setBusy(false); }
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

  const paginatedEntries = payload?.entries?.slice((entriesPage - 1) * PAGE_SIZE, entriesPage * PAGE_SIZE) || [];
  const totalEntriesPages = Math.ceil((payload?.entries?.length || 0) / PAGE_SIZE);

  const paginatedHistory = payload?.history?.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE) || [];
  const totalHistoryPages = Math.ceil((payload?.history?.length || 0) / PAGE_SIZE);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="legal-warning" role="note">Una falla de red, CAPTCHA, autenticación o parser nunca se muestra como “sin publicación”. La validación final siempre corresponde a un profesional.</div>

      <div className="legal-form-grid">
        <label>Fuente judicial<select value={form.sourceSlug} onChange={(event) => setForm({ ...form, sourceSlug: event.target.value })}><option value="boletin_judicial_jalisco">Boletín Judicial de Jalisco</option><option value="boletin_judicial_federal">PJF/CJF (revisión manual)</option><option value="boletin_tjajal">TJA Jalisco (revisión manual)</option></select></label>
        <label>Número de expediente<input value={form.expedienteNumber} onChange={(event) => setForm({ ...form, expedienteNumber: event.target.value })} /></label>
        <label>Año<input inputMode="numeric" value={form.expedienteYear} onChange={(event) => setForm({ ...form, expedienteYear: event.target.value })} /></label>

        <label>
          Materia
          <input list="jalisco-materias" value={form.matter} onChange={(event) => setForm({ ...form, matter: event.target.value })} />
          <datalist id="jalisco-materias">
            {JALISCO_MATERIAS.map(m => <option key={m} value={m} />)}
          </datalist>
        </label>
        <label>
          Partido judicial
          <input list="jalisco-partidos" value={form.judicialDistrict} onChange={(event) => setForm({ ...form, judicialDistrict: event.target.value })} />
          <datalist id="jalisco-partidos">
            {JALISCO_PARTIDOS.map(p => <option key={p} value={p} />)}
          </datalist>
        </label>
        <label>
          Juzgado o sala
          <input list="jalisco-juzgados" value={form.court} onChange={(event) => setForm({ ...form, court: event.target.value })} />
          <datalist id="jalisco-juzgados">
            {JALISCO_JUZGADOS.map(j => <option key={j} value={j} />)}
          </datalist>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-doc-primary" onClick={() => void consultNow()} disabled={busy}>{busy ? 'Procesando…' : 'Consultar ahora'}</button>
        {!activeWatch ? <button type="button" className="btn-doc-secondary" onClick={() => void toggleWatch(true)} disabled={busy}>Activar vigilancia</button> : <button type="button" className="btn-doc-secondary" onClick={() => void toggleWatch(false)} disabled={busy}>Pausar vigilancia</button>}
        <button type="button" className="btn-doc-secondary" onClick={downloadEvidence} disabled={!payload}>Descargar evidencia</button>
      </div>

      <div className="legal-meta-block">
        <strong>Respaldo manual</strong>
        <p className="document-muted">Úsalo cuando el portal requiera CAPTCHA o revisión humana. Primero genera una vista previa.</p>
        <div className="legal-form-grid">
          <label>Tipo<select value={importType} onChange={(event) => { setImportType(event.target.value as typeof importType); setImportPreview(null); }}><option value="text">Pegar texto</option><option value="url">URL HTTPS pública</option><option value="pdf">Subir PDF</option></select></label>
          {importType === 'text' && <label className="legal-wide-card">Texto<textarea rows={6} value={importText} onChange={(event) => { setImportText(event.target.value); setImportPreview(null); }} /></label>}
          {importType === 'url' && <label className="legal-wide-card">URL HTTPS<input type="url" value={importUrl} onChange={(event) => { setImportUrl(event.target.value); setImportPreview(null); }} /></label>}
          {importType === 'pdf' && <label className="legal-wide-card">PDF<input type="file" accept="application/pdf,text/plain" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setImportPreview(null); }} /></label>}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <button type="button" className="btn-doc-secondary" onClick={() => void importBulletin('preview')} disabled={busy}>Generar vista previa</button>
          <button type="button" className="btn-doc-primary" onClick={() => void importBulletin('confirm')} disabled={busy || !importPreview?.previewToken}>Confirmar importación</button>
        </div>
        {importPreview && <p role="status">Analizadas: {importPreview.publicationsAnalyzed} · expedientes vigilados: {importPreview.watchedCasesFound} · nuevas: {importPreview.newPublications} · duplicados: {importPreview.duplicates} · sin coincidencia: {importPreview.unmatched}</p>}
        {importPreview?.publications?.length ? <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
          <strong>Coincidencias detectadas</strong>
          {importPreview.publications.map((publication) => <article key={publication.contentHash} className="legal-meta-block">
            <strong>{publication.heading || `Expediente ${publication.expedienteNumber}`}</strong>
            <p>Expediente: {publication.expedienteNumber} · año: {publication.expedienteYear}</p>
            <p>{publication.extract}</p>
            {publication.matches.length ? <ul>
              {publication.matches.map((match) => <li key={`${match.watchId}:${match.matterId}`}>
                Expediente vigilado {match.watchId} · asunto {match.matterId} · {match.duplicate ? 'ya vinculado' : 'listo para vincular'}
              </li>)}
            </ul> : <p className="document-muted">Sin coincidencia con expedientes vigilados.</p>}
          </article>)}
          {importPreview.previewExpiresAt && <p className="document-muted">La confirmación vence: {dateLabel(importPreview.previewExpiresAt)}.</p>}
        </div> : null}
      </div>

      {!hasToken && <div className="legal-meta-block"><label>Token administrativo<input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} autoComplete="off" /></label><div style={{ display: 'flex', gap: '0.75rem' }}><button type="button" className="btn-doc-secondary" onClick={persistToken}>Guardar token</button><button type="button" className="btn-doc-secondary" onClick={forgetToken}>Borrar token</button></div></div>}
      {hasToken && <button type="button" className="btn-doc-secondary" onClick={forgetToken}>Borrar token administrativo</button>}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">Consultando historial…</p>}

      {payload?.lastCheck && <div className="legal-meta-block">
        <strong>Última consulta</strong>
        <p>
          {dateLabel(payload.lastCheck.completedAt || payload.lastCheck.startedAt)} · <StatusBadge type="query" status={payload.lastCheck.queryStatus || payload.lastCheck.status} /> · <StatusBadge type="publication" status={payload.lastCheck.publicationStatus || 'UNKNOWN'} />
        </p>
        <p>Siguiente consulta: {dateLabel(payload.nextCheckAt)}</p>
      </div>}

      {payload?.queryStatus && <p><strong>Consulta:</strong> <StatusBadge type="query" status={payload.queryStatus} /></p>}
      {payload?.publicationStatus && <p><strong>Publicación:</strong> <StatusBadge type="publication" status={payload.publicationStatus} /></p>}

      {payload?.warnings?.map((warning) => <p key={warning} className="document-muted">Advertencia: {warning}</p>)}

      {paginatedEntries.map((entry) => <article key={entry.id} className="legal-meta-block">
        <strong>{entry.heading || `Expediente ${entry.expedienteNumber}`}</strong>
        <p>{entry.source?.name || 'Fuente oficial'} · publicación: {dateLabel(entry.publicationDate || entry.publicationDateRaw)} · acuerdo: {dateLabel(entry.agreementDate || entry.agreementDateRaw)}</p>
        <p>Materia: {entry.matterLabel || 'No entregada'} · partido: {entry.judicialDistrict || 'No entregado'} · juzgado: {entry.court || entry.chamber || 'No entregado'}</p>
        <p>Expediente: {entry.expedienteNumber} · tipo: {entry.proceedingType || 'No entregado'} · boletín: {entry.bulletinNumber || 'No entregado'}</p>
        <p>{entry.extract || 'Sin extracto disponible.'}</p>
        <p className="document-muted">Primera detección: {dateLabel(entry.firstSeenAt)} · última verificación: {dateLabel(entry.lastVerifiedAt)} · verificación: {entry.verificationStatus || entry.origin || 'pendiente'}</p>
        {entry.notes && <p><strong>Notas:</strong> {entry.notes}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="btn-doc-secondary">Abrir publicación oficial</a>
          <button type="button" className="btn-doc-secondary" onClick={() => void updateEntry(entry.id, 'review')} disabled={busy || entry.reviewed}>{entry.reviewed ? 'Revisada' : 'Marcar como revisada'}</button>
          <button type="button" className="btn-doc-secondary" onClick={() => void updateEntry(entry.id, 'actuation')} disabled={busy || Boolean(entry.actuation)}>Agregar como actuación</button>
          <button type="button" className="btn-doc-secondary" onClick={() => void updateEntry(entry.id, 'notes')} disabled={busy}>Guardar notas</button>
        </div>
        {noteEntryId === entry.id && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submitNote(); if (e.key === 'Escape') setNoteEntryId(null); }}
              placeholder="Escribe la nota de revisión..."
              style={{ flex: 1 }}
              autoFocus
            />
            <button type="button" className="btn-doc-secondary" onClick={() => void submitNote()} disabled={busy}>Guardar</button>
            <button type="button" className="btn-doc-secondary" onClick={() => setNoteEntryId(null)}>Cancelar</button>
          </div>
        )}
      </article>)}

      {totalEntriesPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button className="btn-doc-secondary" onClick={() => setEntriesPage(p => Math.max(1, p - 1))} disabled={entriesPage === 1}>Anterior</button>
          <span>Página {entriesPage} de {totalEntriesPages}</span>
          <button className="btn-doc-secondary" onClick={() => setEntriesPage(p => Math.min(totalEntriesPages, p + 1))} disabled={entriesPage === totalEntriesPages}>Siguiente</button>
        </div>
      )}

      {!loading && !payload?.entries?.length && payload?.publicationStatus === 'NO_PUBLICATION_FOUND_AS_OF' && <p>No se encontró publicación al corte de {dateLabel(payload.checkedAt)}.</p>}

      {payload?.history?.length ? <details><summary>Ver historial</summary>
        <ul>{paginatedHistory.map((run) => <li key={run.id}>{dateLabel(run.startedAt)} · <StatusBadge type="query" status={run.queryStatus || run.status} /> · <StatusBadge type="publication" status={run.publicationStatus || 'UNKNOWN'} /> · resultados: {run.resultsFound} · nuevos: {run.newResults}</li>)}</ul>
        {totalHistoryPages > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button className="btn-doc-secondary" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}>Anterior</button>
            <span>Página {historyPage} de {totalHistoryPages}</span>
            <button className="btn-doc-secondary" onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages}>Siguiente</button>
          </div>
        )}
      </details> : null}
    </div>
  );
}
