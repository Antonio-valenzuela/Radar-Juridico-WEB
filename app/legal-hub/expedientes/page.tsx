"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BulletinWatchPanel from '@/app/components/BulletinWatchPanel';
import { useLegalWorkspaceContext } from '@/context/LegalWorkspaceContext';
import { deadlineStatus, proceduralDateLabel, MEXICO_CITY_TIMEZONE } from '@/lib/cases/deadlineDates';
import { adminFetch, getAdminToken, setAdminToken } from '@/lib/client/adminToken';
import { AdminTokenGate } from '@/components/shared/AdminTokenGate';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface Party {
  id: string;
  role: string;
  name: string;
  rfc?: string | null;
  notes?: string | null;
}

interface Actuation {
  id: string;
  date: string;
  type: string;
  summary: string;
  sourceUrl?: string | null;
  reviewed: boolean;
}

interface Deadline {
  id: string;
  title: string;
  dueDate: string;
  type: string;
  completed: boolean;
  notes?: string | null;
  timezone?: string | null;
  calculationNote?: string | null;
}

interface CaseFile {
  id: string;
  title: string;
  fileType: string;
  url?: string | null;
  notes?: string | null;
}

interface CaseData {
  id: string;
  title: string;
  description?: string | null;
  status: 'open' | 'closed' | 'archived';
  matter?: string | null;
  reference?: string | null;
  jurisdiction?: string | null;
  court?: string | null;
  caseNumber?: string | null;
  lastReviewedAt?: string | null;
  parties?: Party[];
  actuations?: Actuation[];
  deadlines?: Deadline[];
  caseFiles?: CaseFile[];
  _count?: {
    parties: number;
    actuations: number;
    deadlines: number;
    caseFiles: number;
    caseAlerts: number;
  };
}

interface CaseForm {
  id?: string;
  title: string;
  jurisdiction: string;
  court: string;
  caseNumber: string;
  matter: string;
  reference: string;
  status: 'open' | 'closed' | 'archived';
  notes: string;
}

const emptyCase: CaseForm = {
  title: '',
  jurisdiction: '',
  court: '',
  caseNumber: '',
  matter: '',
  reference: '',
  status: 'open',
  notes: '',
};

const DRAFT_KEY = 'juridico_case_draft';

export default function ExpedientesPage() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [formValues, setFormValues] = useState<CaseForm>(emptyCase);
  const [activeTab, setActiveTab] = useState('general');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{
    tone: 'error' | 'success' | 'warning';
    text: string;
  } | null>(null);
  const [partyForm, setPartyForm] = useState({ role: '', name: '', rfc: '', notes: '' });
  const [actuationForm, setActuationForm] = useState({
    date: '',
    type: '',
    summary: '',
    sourceUrl: '',
  });
  const [deadlineForm, setDeadlineForm] = useState({
    title: '',
    dueDate: '',
    type: '',
    notes: '',
  });
  const [documentForm, setDocumentForm] = useState({
    title: '',
    fileType: 'general',
    url: '',
    notes: '',
  });

  const { setActiveCase, clearActiveCase, setContextMode, setPageTitle } = useLegalWorkspaceContext();

  const authorizedFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = getAdminToken();
    if (!token) throw new Error('ADMIN_TOKEN_REQUIRED');
    return adminFetch(input, init);
  };

  const errorFromResponse = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error || fallback;
    } catch {
      return fallback;
    }
  };

  const friendlyError = (error: unknown, fallback: string) =>
    error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED'
      ? 'Ingresa el token administrativo para gestionar expedientes.'
      : error instanceof Error ? error.message : fallback;

  const fetchCases = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await authorizedFetch('/api/cases');
      if (!response.ok) {
        throw new Error(await errorFromResponse(response, 'No fue posible consultar los expedientes.'));
      }
      const payload = (await response.json()) as { data?: CaseData[] };
      setCases(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      setCases([]);
      setMessage({
        tone: 'error',
        text: friendlyError(error, 'No fue posible consultar los expedientes.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await authorizedFetch(`/api/cases/${id}`);
      if (!response.ok) {
        throw new Error(await errorFromResponse(response, 'No fue posible abrir el expediente.'));
      }
      setSelectedCase((await response.json()) as CaseData);
      setView('detail');
    } catch (error) {
      setMessage({
        tone: 'error',
        text: friendlyError(error, 'No fue posible abrir el expediente.'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCases();
  }, []);

  useEffect(() => {
    if (view !== 'form' || formValues.id) return;
    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) return;
    try {
      setFormValues({ ...emptyCase, ...(JSON.parse(draft) as Partial<CaseForm>) });
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [view, formValues.id]);

  useEffect(() => {
    setPageTitle(view === 'detail' && selectedCase ? `Expediente ${selectedCase.caseNumber || selectedCase.title}` : 'Gestión de Expedientes');
  }, [view, selectedCase, setPageTitle]);

  useEffect(() => {
    if (view === 'detail' && selectedCase) {
      setActiveCase({
        caseId: selectedCase.id,
        expedienteNumber: selectedCase.caseNumber || '',
        court: selectedCase.court || '',
        actor:
          selectedCase.parties?.find((party) => /actor|actora|parte actora/i.test(party.role))?.name ||
          selectedCase.parties?.[0]?.name ||
          '',
        demandado:
          selectedCase.parties?.find((party) => /demandado|parte demandada/i.test(party.role))?.name ||
          selectedCase.parties?.[1]?.name ||
          '',
        matter: selectedCase.matter || '',
      });
      setContextMode('current_case');
      return;
    }

    clearActiveCase();
    setContextMode('none');
  }, [view, selectedCase, setActiveCase, clearActiveCase, setContextMode]);

  useEffect(() => {
    if (view === 'form' && !formValues.id) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues));
    }
  }, [formValues, view]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const url = formValues.id ? `/api/cases/${formValues.id}` : '/api/cases';
      const response = await authorizedFetch(url, {
        method: formValues.id ? 'PUT' : 'POST',
        body: JSON.stringify(formValues),
      });
      if (!response.ok) {
        throw new Error(await errorFromResponse(response, 'No fue posible guardar el expediente.'));
      }
      const saved = (await response.json()) as CaseData;
      localStorage.removeItem(DRAFT_KEY);
      await fetchCases();
      await openDetail(saved.id);
      setMessage({ tone: 'success', text: 'Expediente guardado correctamente.' });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: friendlyError(error, 'No fue posible guardar el expediente.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCase = async () => {
    if (!selectedCase?.id) return;
    setConfirmDeleteOpen(true);
  };

  const doDeleteCase = async () => {
    setConfirmDeleteOpen(false);
    if (!selectedCase?.id) return;
    try {
      const response = await authorizedFetch(`/api/cases/${selectedCase.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setMessage({
          tone: 'error',
          text: await errorFromResponse(response, 'No fue posible eliminar el expediente.'),
        });
        return;
      }
      setSelectedCase(null);
      setView('list');
      await fetchCases();
      setMessage({ tone: 'success', text: 'Expediente eliminado.' });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: friendlyError(error, 'No fue posible eliminar el expediente.'),
      });
    }
  };

  const handleExport = async (id: string) => {
    try {
      const response = await authorizedFetch(`/api/cases/${id}/export`);
      if (!response.ok) {
        setMessage({
          tone: 'error',
          text: await errorFromResponse(response, 'No fue posible exportar el expediente.'),
        });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `expediente-${selectedCase?.caseNumber || id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({
        tone: 'error',
        text: friendlyError(error, 'No fue posible exportar el expediente.'),
      });
    }
  };

  const mutateChild = async (
    segment: 'parties' | 'actuations' | 'deadlines' | 'documents',
    method: 'POST' | 'PUT' | 'DELETE',
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!selectedCase?.id) return false;
    try {
      const response = await authorizedFetch(`/api/cases/${selectedCase.id}/${segment}`, {
        method,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setMessage({
          tone: 'error',
          text: await errorFromResponse(response, 'No fue posible guardar el cambio.'),
        });
        return false;
      }
      await openDetail(selectedCase.id);
      setMessage({ tone: 'success', text: successMessage });
      return true;
    } catch (error) {
      setMessage({
        tone: 'error',
        text: friendlyError(error, 'No fue posible guardar el cambio.'),
      });
      return false;
    }
  };

  const markCaseReviewed = async () => {
    if (!selectedCase?.id) return;
    try {
      const response = await authorizedFetch(`/api/cases/${selectedCase.id}`, {
        method: 'PUT',
        body: JSON.stringify({ markReviewed: true }),
      });
      if (!response.ok) {
        setMessage({
          tone: 'error',
          text: await errorFromResponse(response, 'No fue posible marcar la revisión.'),
        });
        return;
      }
      await openDetail(selectedCase.id);
      setMessage({ tone: 'success', text: 'Revisión del expediente registrada.' });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: friendlyError(error, 'No fue posible marcar la revisión.'),
      });
    }
  };

  const filteredCases = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return cases.filter((item) =>
      [item.caseNumber, item.court, item.matter, item.title]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [cases, searchTerm]);

  const editSelected = () => {
    if (!selectedCase) return;
    setFormValues({
      id: selectedCase.id,
      title: selectedCase.title,
      jurisdiction: selectedCase.jurisdiction || '',
      court: selectedCase.court || '',
      caseNumber: selectedCase.caseNumber || '',
      matter: selectedCase.matter || '',
      reference: selectedCase.reference || '',
      status: selectedCase.status,
      notes: selectedCase.description || '',
    });
    setView('form');
  };

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell">
        <nav className="document-nav">
          <Link href="/legal-hub">Volver al Centro Jurídico</Link>
        </nav>

        <section className="legal-hub-hero" style={{ paddingBottom: '1rem' }}>
          <span className="badge">Control de expedientes</span>
          <h1>Gestión de litigios</h1>
          <p className="subtitle">Expedientes, plazos, partes, actuaciones y documentos aislados por organización.</p>
        </section>

        {message && (
          <div
            role={message.tone === 'error' ? 'alert' : 'status'}
            className="glass-card"
            style={{ padding: '0.875rem 1rem', marginBottom: '1rem' }}
          >
            {message.text}
          </div>
        )}
        {message && message.text.includes('token administrativo') && (
          <AdminTokenGate context="para gestionar expedientes" onTokenSaved={() => void fetchCases()} />
        )}
        
        <ConfirmDialog
          isOpen={confirmDeleteOpen}
          title="Eliminar expediente"
          message="¿Eliminar este expediente y todos sus registros asociados? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          isDanger
          onConfirm={() => void doDeleteCase()}
          onCancel={() => setConfirmDeleteOpen(false)}
        />

        {view === 'list' && (
          <>
            <div className="legal-actions-row" style={{ marginBottom: '2rem', justifyContent: 'space-between' }}>
              <label>
                Buscar expediente
                <input
                  type="search"
                  placeholder="Número, órgano o materia"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setFormValues(emptyCase);
                  setView('form');
                }}
                className="btn-doc-primary"
                style={{ minHeight: '44px' }}
              >
                Nuevo expediente
              </button>
            </div>

            {loading ? (
              <div className="glass-card legal-wide-card" style={{ padding: '2rem' }} role="status">
                Cargando expedientes…
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="glass-card legal-wide-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>No se encontraron expedientes.</p>
              </div>
            ) : (
              <div className="legal-hub-grid">
                {filteredCases.map((item) => (
                  <article key={item.id} className="glass-card legal-hub-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span className="document-label">{item.matter || 'Sin materia'}</span>
                      <span>{item.status === 'open' ? 'Abierto' : item.status === 'closed' ? 'Concluido' : 'Archivado'}</span>
                    </div>
                    <h2 className="legal-hub-card-title">{item.caseNumber || item.title}</h2>
                    <p className="document-muted">{item.court || 'Órgano no registrado'}</p>
                    <p className="document-muted">{item.jurisdiction || 'Jurisdicción no registrada'}</p>
                    <p className="document-muted">
                      Partes: {item._count?.parties || 0} · Plazos: {item._count?.deadlines || 0} · Alertas: {item._count?.caseAlerts || 0}
                    </p>
                    <button
                      type="button"
                      className="btn-doc-secondary"
                      style={{ minHeight: '44px', width: '100%' }}
                      onClick={() => void openDetail(item.id)}
                    >
                      Abrir expediente
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'detail' && selectedCase && (
          <section className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <button type="button" onClick={() => setView('list')} className="btn-doc-secondary" style={{ minHeight: '44px', marginBottom: '1rem' }}>Volver</button>
                <h1>Expediente: {selectedCase.caseNumber || selectedCase.title}</h1>
                <p className="document-muted">{selectedCase.court || 'Órgano no registrado'} · {selectedCase.jurisdiction || 'Jurisdicción no registrada'}</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
                <button type="button" onClick={editSelected} className="btn-doc-primary" style={{ minHeight: '44px' }}>Editar</button>
                <button type="button" onClick={() => void markCaseReviewed()} className="btn-doc-secondary" style={{ minHeight: '44px' }}>Marcar revisión</button>
                <button type="button" onClick={() => void handleExport(selectedCase.id)} className="btn-doc-secondary" style={{ minHeight: '44px' }}>Exportar JSON</button>
                <button type="button" onClick={() => void handleDeleteCase()} className="btn-doc-secondary" style={{ minHeight: '44px' }}>Eliminar</button>
              </div>
            </div>

            <div className="legal-hub-tabs" role="tablist">
              {['general', 'partes', 'actuaciones', 'plazos', 'documentos', 'boletin'].map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  key={tab}
                  className={`legal-hub-tab ${activeTab === tab ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                  style={{ textTransform: 'capitalize', minHeight: '44px' }}
                >
                  {tab === 'boletin' ? 'Boletín Judicial' : tab}
                </button>
              ))}
            </div>

            <div style={{ marginTop: '2rem' }}>
              {activeTab === 'general' && (
                <div className="legal-form-grid">
                  <div className="legal-meta-block"><strong>Materia:</strong> {selectedCase.matter || 'Sin clasificar'}</div>
                  <div className="legal-meta-block"><strong>Estado:</strong> {selectedCase.status}</div>
                  <div className="legal-meta-block"><strong>Última revisión:</strong> {selectedCase.lastReviewedAt ? new Date(selectedCase.lastReviewedAt).toLocaleString('es-MX') : 'No registrada'}</div>
                  <div className="legal-meta-block legal-wide-card"><strong>Notas:</strong><p>{selectedCase.description || 'Sin notas.'}</p></div>
                </div>
              )}

              {activeTab === 'partes' && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div className="legal-form-grid">
                    <label>Rol<input value={partyForm.role} onChange={(event) => setPartyForm({ ...partyForm, role: event.target.value })} /></label>
                    <label>Nombre<input value={partyForm.name} onChange={(event) => setPartyForm({ ...partyForm, name: event.target.value })} /></label>
                    <label>RFC opcional<input value={partyForm.rfc} onChange={(event) => setPartyForm({ ...partyForm, rfc: event.target.value })} /></label>
                    <button type="button" className="btn-doc-primary" style={{ minHeight: '44px' }} onClick={async () => {
                      if (await mutateChild('parties', 'POST', partyForm, 'Parte agregada.')) setPartyForm({ role: '', name: '', rfc: '', notes: '' });
                    }}>Agregar parte</button>
                  </div>
                  {selectedCase.parties?.map((party) => (
                    <div key={party.id} className="legal-meta-block" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span><strong>{party.name}</strong> · {party.role} {party.rfc ? `· ${party.rfc}` : ''}</span>
                      <button type="button" className="btn-doc-secondary" onClick={() => void mutateChild('parties', 'DELETE', { partyId: party.id }, 'Parte eliminada.')}>Eliminar</button>
                    </div>
                  ))}
                  {!selectedCase.parties?.length && <p>No hay partes registradas.</p>}
                </div>
              )}

              {activeTab === 'actuaciones' && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div className="legal-form-grid">
                    <label>Fecha<input type="date" value={actuationForm.date} onChange={(event) => setActuationForm({ ...actuationForm, date: event.target.value })} /></label>
                    <label>Tipo<input value={actuationForm.type} onChange={(event) => setActuationForm({ ...actuationForm, type: event.target.value })} /></label>
                    <label className="legal-wide-card">Resumen<textarea value={actuationForm.summary} onChange={(event) => setActuationForm({ ...actuationForm, summary: event.target.value })} /></label>
                    <label className="legal-wide-card">URL HTTPS opcional<input type="url" value={actuationForm.sourceUrl} onChange={(event) => setActuationForm({ ...actuationForm, sourceUrl: event.target.value })} /></label>
                    <button type="button" className="btn-doc-primary" style={{ minHeight: '44px' }} onClick={async () => {
                      if (await mutateChild('actuations', 'POST', actuationForm, 'Actuación agregada.')) setActuationForm({ date: '', type: '', summary: '', sourceUrl: '' });
                    }}>Agregar actuación</button>
                  </div>
                  {selectedCase.actuations?.map((actuation) => (
                    <div key={actuation.id} className="legal-meta-block">
                      <strong>{new Date(actuation.date).toLocaleDateString('es-MX')} · {actuation.type}</strong>
                      <p>{actuation.summary}</p>
                      <p>{actuation.reviewed ? 'Revisada' : 'Pendiente de revisión'}</p>
                      {actuation.sourceUrl && <a href={actuation.sourceUrl} target="_blank" rel="noreferrer">Ver fuente</a>}
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <button type="button" className="btn-doc-secondary" onClick={() => void mutateChild('actuations', 'PUT', { actuationId: actuation.id, reviewed: !actuation.reviewed }, 'Estado de revisión actualizado.')}>{actuation.reviewed ? 'Reabrir revisión' : 'Marcar revisada'}</button>
                        <button type="button" className="btn-doc-secondary" onClick={() => void mutateChild('actuations', 'DELETE', { actuationId: actuation.id }, 'Actuación eliminada.')}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                  {!selectedCase.actuations?.length && <p>No hay actuaciones registradas.</p>}
                </div>
              )}

              {activeTab === 'plazos' && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div className="legal-form-grid">
                    <label>Título<input value={deadlineForm.title} onChange={(event) => setDeadlineForm({ ...deadlineForm, title: event.target.value })} /></label>
                    <label>Vencimiento<input type="date" value={deadlineForm.dueDate} onChange={(event) => setDeadlineForm({ ...deadlineForm, dueDate: event.target.value })} /></label>
                    <label>Tipo<input value={deadlineForm.type} onChange={(event) => setDeadlineForm({ ...deadlineForm, type: event.target.value })} /></label>
                    <button type="button" className="btn-doc-primary" style={{ minHeight: '44px' }} onClick={async () => {
                      if (await mutateChild('deadlines', 'POST', deadlineForm, 'Plazo agregado.')) setDeadlineForm({ title: '', dueDate: '', type: '', notes: '' });
                    }}>Agregar plazo</button>
                  </div>
                  {selectedCase.deadlines?.map((deadline) => {
                    const overdue = !deadline.completed && deadlineStatus(new Date(deadline.dueDate), { timezone: deadline.timezone || MEXICO_CITY_TIMEZONE }) === 'overdue';
                    return (
                      <div key={deadline.id} className="legal-meta-block">
                        <strong>{deadline.title}</strong>
                        <p>{proceduralDateLabel(new Date(deadline.dueDate), deadline.timezone || MEXICO_CITY_TIMEZONE)} · {deadline.type}</p>
                        <p>{deadline.completed ? 'Completado' : overdue ? 'Vencido' : 'Pendiente'}</p>
                        {!deadline.completed && <p className="document-muted">{deadline.calculationNote || 'Cálculo preliminar. Requiere validación profesional.'}</p>}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button type="button" className="btn-doc-secondary" onClick={() => void mutateChild('deadlines', 'PUT', { deadlineId: deadline.id, completed: !deadline.completed }, 'Estado del plazo actualizado.')}>{deadline.completed ? 'Reabrir' : 'Completar'}</button>
                          <button type="button" className="btn-doc-secondary" onClick={() => void mutateChild('deadlines', 'DELETE', { deadlineId: deadline.id }, 'Plazo eliminado.')}>Eliminar</button>
                        </div>
                      </div>
                    );
                  })}
                  {!selectedCase.deadlines?.length && <p>No hay plazos registrados.</p>}
                </div>
              )}

              {activeTab === 'documentos' && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div className="legal-form-grid">
                    <label>Título<input value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} /></label>
                    <label>Tipo<input value={documentForm.fileType} onChange={(event) => setDocumentForm({ ...documentForm, fileType: event.target.value })} /></label>
                    <label className="legal-wide-card">URL HTTPS opcional<input type="url" value={documentForm.url} onChange={(event) => setDocumentForm({ ...documentForm, url: event.target.value })} /></label>
                    <button type="button" className="btn-doc-primary" style={{ minHeight: '44px' }} onClick={async () => {
                      if (await mutateChild('documents', 'POST', documentForm, 'Documento agregado.')) setDocumentForm({ title: '', fileType: 'general', url: '', notes: '' });
                    }}>Agregar documento</button>
                  </div>
                  {selectedCase.caseFiles?.map((document) => (
                    <div key={document.id} className="legal-meta-block" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span><strong>{document.title}</strong> · {document.fileType}</span>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {document.url && <a href={document.url} target="_blank" rel="noreferrer" className="btn-doc-secondary">Abrir</a>}
                        <button type="button" className="btn-doc-secondary" onClick={() => void mutateChild('documents', 'DELETE', { documentId: document.id }, 'Documento eliminado.')}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                  {!selectedCase.caseFiles?.length && <p>No hay documentos registrados.</p>}
                </div>
              )}

              {activeTab === 'boletin' && (
                <BulletinWatchPanel
                  matterId={selectedCase.id}
                  caseNumber={selectedCase.caseNumber}
                  matter={selectedCase.matter}
                  court={selectedCase.court}
                />
              )}
            </div>
          </section>
        )}

        {view === 'form' && (
          <section className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <h2>{formValues.id ? 'Editar expediente' : 'Nuevo expediente'}</h2>
              <button type="button" onClick={() => setView(formValues.id ? 'detail' : 'list')} className="btn-doc-secondary" style={{ minHeight: '44px' }}>Cancelar</button>
            </div>
            <div className="legal-form-grid">
              <label>Título opcional<input value={formValues.title} onChange={(event) => setFormValues({ ...formValues, title: event.target.value })} /></label>
              <label>Número de expediente<input value={formValues.caseNumber} onChange={(event) => setFormValues({ ...formValues, caseNumber: event.target.value })} required /></label>
              <label>Juzgado u órgano<input value={formValues.court} onChange={(event) => setFormValues({ ...formValues, court: event.target.value })} required /></label>
              <label>Jurisdicción<input value={formValues.jurisdiction} onChange={(event) => setFormValues({ ...formValues, jurisdiction: event.target.value })} required /></label>
              <label>Materia<input value={formValues.matter} onChange={(event) => setFormValues({ ...formValues, matter: event.target.value })} required /></label>
              <label>Referencia interna<input value={formValues.reference} onChange={(event) => setFormValues({ ...formValues, reference: event.target.value })} /></label>
              {formValues.id && (
                <label>Estado<select value={formValues.status} onChange={(event) => setFormValues({ ...formValues, status: event.target.value as CaseForm['status'] })}>
                  <option value="open">Abierto</option>
                  <option value="closed">Concluido</option>
                  <option value="archived">Archivado</option>
                </select></label>
              )}
              <label className="legal-wide-card">Notas<textarea value={formValues.notes} onChange={(event) => setFormValues({ ...formValues, notes: event.target.value })} rows={4} /></label>
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => void handleSave()} disabled={saving} className="btn-doc-primary" style={{ minHeight: '44px' }}>
                {saving ? 'Guardando…' : 'Guardar expediente'}
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
