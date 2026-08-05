'use client';

import { useState, useEffect, useRef } from 'react';
import { normalizeLegalDisplayText } from '@/lib/text/normalizeLegalDisplayText';
import { getAdminToken, getAdminTokenHeaders } from '@/lib/client/adminToken';
import { useLegalWorkspaceContext } from '@/context/LegalWorkspaceContext';

interface Citation {
  id?: string;
  title: string;
  url: string | null;
  fuente: string;
  materia: string;
}

interface ActionBtn {
  label: string;
  type: string;
  payload?: any;
}

interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'suggestion';
  section: string;
  fieldId?: string;
  title: string;
  explanation: string;
  currentText: string;
  suggestedText: string;
  sourceIds?: string[];
  modelAgreement?: 'both' | 'gemini_only' | 'groq_only' | 'judge_added';
  status?: 'pending' | 'accepted' | 'rejected';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  contextLabel?: string;
  provider?: string;
  executionMode?: 'fast' | 'deep';
  usedLocalData?: boolean;
  citations?: Citation[];
  actions?: ActionBtn[];
  issues?: Issue[];
  consistencyProblems?: string[];
  missingFields?: string[];
  warnings?: string[];
  providerSummary?: {
    geminiCompleted?: boolean;
    groqCompleted?: boolean;
    judgeCompleted?: boolean;
    fallbackUsed?: boolean;
  };
  followUpQuestions?: string[];
  isError?: boolean;
}

export default function FloatingLegalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Analizando contexto...');
  const [executionMode, setExecutionMode] = useState<'fast' | 'deep'>('fast');

  const {
    module: activeModule,
    contextMode,
    setContextMode,
    activeDocument,
    updateDocumentFields,
  } = useLegalWorkspaceContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('juridico_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }

    const handleOpenChat = (e: Event & { detail?: any }) => {
      setIsOpen(true);
      const executionModeFromEvent = e.detail?.executionMode as 'fast' | 'deep' | undefined;
      const contextModeFromEvent = e.detail?.contextMode as 'current_document' | 'current_case' | 'current_bulletin' | 'none' | undefined;
      if (executionModeFromEvent) setExecutionMode(executionModeFromEvent);
      if (contextModeFromEvent) setContextMode(contextModeFromEvent);
      if (e.detail?.query) {
        // Allow the panel to render first and then submit the review query automatically.
        setTimeout(() => {
          handleSend(undefined, e.detail.query, executionModeFromEvent, contextModeFromEvent);
        }, 50);
      }
    };

    window.addEventListener('open-legal-chat', handleOpenChat as any);
    return () => {
      window.removeEventListener('open-legal-chat', handleOpenChat as any);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSend = async (
    e?: React.FormEvent,
    customInput?: string,
    forcedExecutionMode?: 'fast' | 'deep',
    forcedContextMode?: 'current_document' | 'current_case' | 'current_bulletin' | 'none'
  ) => {
    if (e) e.preventDefault();
    const textToSend = customInput || input;
    if (!textToSend.trim() || loading) return;

    const effectiveExecutionMode = forcedExecutionMode || executionMode;
    const effectiveContextMode = forcedContextMode || contextMode;

    const userMsg: Message = { role: 'user', content: textToSend.trim(), executionMode: effectiveExecutionMode };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    const lowerQuery = textToSend.toLowerCase();
    const isSampleFillIntent = lowerQuery.includes('rellen') || lowerQuery.includes('llena') || lowerQuery.includes('ejemplo') || lowerQuery.includes('autollen');
    if (isSampleFillIntent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fill-sample-data'));
    }

    setLoading(true);

    if (executionMode === 'deep') {
      setLoadingText('✓ Gemini + Groq en paralelo... ⏳ Verificando con Juez OpenRouter...');
    } else {
      setLoadingText('Consultando proveedor rápido (Gemini → Groq → OpenRouter)...');
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const pageContext = {
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      module: activeModule,
      pageTitle: typeof document !== 'undefined' ? document.title : '',
      activeDocument: (contextMode === 'current_document' && activeDocument) ? {
        templateId: activeDocument.templateId,
        templateName: activeDocument.templateName,
        matter: activeDocument.matter,
        jurisdiction: activeDocument.jurisdiction,
        fields: activeDocument.fields,
        pendingMarkers: activeDocument.pendingMarkers,
      } : null,
    };

    try {
      const endpoint = executionMode === 'deep' ? '/api/ai/deep-review' : '/api/ai/generate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAdminTokenHeaders({ 'Content-Type': 'application/json' }, getAdminToken()),
        signal: controller.signal,
        body: JSON.stringify({
          message: userMsg.content,
          mode: executionMode,
          contextMode,
          activeDocument: contextMode === 'current_document' ? activeDocument : null,
          module: activeModule,
          pageContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.friendlyMessage || data.error || 'No se pudo generar la respuesta.');
      }

      let contentText = '';
      let issuesList: Issue[] = [];
      let consistencyProblems: string[] = [];
      let missingFields: string[] = [];
      let citations: Citation[] = [];
      let providerSummary: any = null;

      if (executionMode === 'deep' && data.data) {
        const deep = data.data;
        contentText = deep.summary || 'Revisión profunda multimodelo completada.';
        issuesList = (deep.issues || []).map((i: any) => ({ ...i, status: 'pending' }));
        consistencyProblems = deep.contradictions || [];
        missingFields = deep.missingFields || [];
        citations = (deep.sourcesUsed || []).map((s: any) => ({
          title: s.title,
          fuente: s.sourceType || 'Oficial',
          materia: 'Legal',
          url: s.officialUrl || null,
        }));
        providerSummary = deep.providerSummary;
      } else {
        const fast = data.data || {};
        const rawContent = fast.content || data.answer || data.displayAnswer || 'Respuesta generada.';
        contentText = rawContent.replace(/```json\n?|```/g, '').trim();
        const rawCitations = fast.citations || data.citations || [];
        citations = rawCitations.filter((c: any) => {
          const title = c.title?.toString().toUpperCase() || '';
          const fuente = c.fuente?.toString().toUpperCase() || '';
          return !title.includes('SENADO_WEB') && !fuente.includes('SENADO_WEB');
        });
        issuesList = (fast.issues || data.issues || []).map((i: any) => ({ ...i, status: 'pending' }));
        consistencyProblems = fast.consistencyProblems || data.consistencyProblems || [];
        missingFields = fast.missingFields || data.missingFields || [];
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: contentText,
        contextLabel: (contextMode === 'current_document' && activeDocument) ? `Demanda / Borrador (${activeDocument.templateName || 'actual'})` : 'Consulta de pantalla',
        provider: executionMode === 'deep' ? 'Multimodelo (3 IA)' : (data.data?.provider || 'IA Rápida'),
        executionMode,
        usedLocalData: true,
        citations,
        actions: data.suggestedActions || [],
        issues: issuesList,
        consistencyProblems,
        missingFields,
        warnings: (data.warnings || []).filter((w: string) => {
          const lower = w.toLowerCase();
          return !lower.includes('religioso') && !lower.includes('curp');
        }),
        providerSummary,
        followUpQuestions: [
          '¿Deseas verificar los preceptos constitucionales?',
          '¿Quieres revisar los conceptos de violación?',
        ],
      };

      const updated = [...newMessages, assistantMsg];
      setMessages(updated);
      sessionStorage.setItem('juridico_chat_history', JSON.stringify(updated));
    } catch (err: any) {
      let errorMsgText = 'No pude procesar la consulta en este momento.';
      if (err.name === 'AbortError') {
        errorMsgText = 'La consulta excedió el tiempo límite.';
      } else if (err.message) {
        errorMsgText = err.message;
      }

      const errorMsg: Message = {
        role: 'assistant',
        content: errorMsgText,
        provider: 'Sistema',
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleApplyIssue = (msgIndex: number, issueId: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const msg = updated[msgIndex];
      if (msg && msg.issues) {
        const issue = msg.issues.find((i) => i.id === issueId);
        if (issue && activeDocument) {
          issue.status = 'accepted';
          if (issue.fieldId) {
            updateDocumentFields({ [issue.fieldId]: issue.suggestedText });
          }
        }
      }
      sessionStorage.setItem('juridico_chat_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRejectIssue = (msgIndex: number, issueId: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const msg = updated[msgIndex];
      if (msg && msg.issues) {
        const issue = msg.issues.find((i) => i.id === issueId);
        if (issue) issue.status = 'rejected';
      }
      sessionStorage.setItem('juridico_chat_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearHistory = () => {
    setMessages([]);
    sessionStorage.removeItem('juridico_chat_history');
  };

  const handleKeyDownTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Closed Trigger Button Apple */}
      {!isOpen && (
        <button
          id="floating-legal-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente legal"
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '9999px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(0, 122, 255, 0.35)',
            backgroundColor: '#007AFF',
            color: '#ffffff',
            border: 'none',
            fontSize: '24px',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s',
          }}
        >
          ⚖️
        </button>
      )}

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.20)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 99998,
          }}
          aria-hidden="true"
        />
      )}

      {/* Floating Card Panel Apple HIG */}
      {isOpen && (
        <div
          id="floating-legal-panel"
          role="dialog"
          aria-label="Asistente Legal"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '440px',
            maxWidth: 'calc(100vw - 32px)',
            height: '650px',
            maxHeight: 'calc(100vh - 48px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
            boxSizing: 'border-box',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              backgroundColor: '#FAFAFC',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#1D1D1F',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>⚖️</span>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                Asistente Legal
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6E6E73',
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px',
              }}
              aria-label="Cerrar asistente legal"
            >
              ✕
            </button>
          </div>

          {/* Subheader Controls Section */}
          <div style={{ padding: '16px 20px 12px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            {/* Subtitle & Limpiar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#6E6E73', fontWeight: 500 }}>
                Consulta y revisión asistida por IA
              </span>
              <button
                onClick={handleClearHistory}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#F5F5F7',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  borderRadius: '10px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  color: '#6E6E73',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <span>🗑️</span>
                <span>Limpiar</span>
              </button>
            </div>

            {/* Modo de Análisis */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F' }}>Modo de Análisis:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setExecutionMode('fast')}
                  style={{
                    backgroundColor: executionMode === 'fast' ? '#007AFF' : '#F5F5F7',
                    color: executionMode === 'fast' ? '#FFFFFF' : '#1D1D1F',
                    border: executionMode === 'fast' ? '1px solid #007AFF' : '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '12px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>⚡</span>
                  <span>Consulta rápida</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionMode('deep')}
                  style={{
                    backgroundColor: executionMode === 'deep' ? '#007AFF' : '#F5F5F7',
                    color: executionMode === 'deep' ? '#FFFFFF' : '#1D1D1F',
                    border: executionMode === 'deep' ? '1px solid #007AFF' : '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '12px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🧠</span>
                  <span>Revisión profunda</span>
                </button>
              </div>
            </div>

            {/* Contexto activo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F' }}>Contexto activo:</span>
              <select
                id="context-select"
                value={contextMode}
                onChange={(e) => setContextMode(e.target.value as any)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  borderRadius: '10px',
                  padding: '4px 10px',
                  fontSize: '13px',
                  color: '#1D1D1F',
                  outline: 'none',
                  flex: 1,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <option value="none">Sin contexto</option>
                <option value="current_document">Usar borrador actual</option>
              </select>
            </div>
            {activeDocument && contextMode === 'current_document' && (
              <p style={{ margin: 0, fontSize: '12px', color: '#4a5568', fontWeight: 500 }}>
                📄 Borrador activo: <span style={{ fontWeight: 700, color: '#1c385c' }}>{activeDocument.templateName || 'Machote'}</span>
              </p>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.length === 0 && (
              <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Mini Badges */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ backgroundColor: '#dce7f5', borderRadius: '10px', padding: '2px 8px', fontSize: '14px' }}>⚖️</span>
                  <span style={{ backgroundColor: '#dce7f5', borderRadius: '10px', padding: '2px 8px', fontSize: '12px', fontWeight: 700, color: '#1c385c' }}>AI</span>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: '#1a202c' }}>
                    ¿Qué deseas consultar hoy?
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: 1.4 }}>
                    Selecciona una sugerencia o escribe directamente tu consulta legal.
                  </p>
                </div>

                {/* Suggestion Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <button
                    onClick={() => {
                      setExecutionMode('deep');
                      handleSend(undefined, 'revisa el machote que acabo de crear');
                    }}
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      color: '#1a202c',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 500,
                    }}
                  >
                    <span>🧠</span>
                    <span>&quot;Revisión profunda del machote actual&quot;</span>
                  </button>

                  <button
                    onClick={() => {
                      setExecutionMode('fast');
                      handleSend(undefined, '¿qué le falta a esta demanda?');
                    }}
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      color: '#1a202c',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 500,
                    }}
                  >
                    <span>⚡</span>
                    <span>&quot;Revisión rápida de campos pendientes&quot;</span>
                  </button>

                  <button
                    onClick={() => {
                      setExecutionMode('fast');
                      handleSend(undefined, 'explicar los fundamentos constitucionales de procedencia');
                    }}
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      color: '#1a202c',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 500,
                    }}
                  >
                    <span>📜</span>
                    <span>&quot;Explicar fundamentos constitucionales&quot;</span>
                  </button>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '92%',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    backgroundColor: msg.role === 'user' ? '#007AFF' : '#F5F5F7',
                    color: msg.role === 'user' ? '#FFFFFF' : '#1D1D1F',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: msg.role === 'user' ? '0 2px 8px rgba(0, 122, 255, 0.22)' : '0 1px 4px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', paddingBottom: '6px', marginBottom: '8px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: '#007AFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🤖 {msg.provider || 'Asistente Legal'}
                      </span>
                      {msg.executionMode === 'deep' && (
                        <span style={{ backgroundColor: 'rgba(52, 199, 89, 0.12)', color: '#34C759', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', fontSize: '10px' }}>
                          PROFUNDA 3 IA
                        </span>
                      )}
                    </div>
                  )}

                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '14px' }}>{msg.content}</p>

                  {/* Provider summary */}
                  {msg.providerSummary && (
                    <div style={{ marginTop: '10px', backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', color: '#1D1D1F', border: '1px solid rgba(0, 0, 0, 0.08)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Gemini: {msg.providerSummary.geminiCompleted ? '✓ OK' : '✗ N/D'}</span>
                      <span>Groq: {msg.providerSummary.groqCompleted ? '✓ OK' : '✗ N/D'}</span>
                      <span>Juez: {msg.providerSummary.judgeCompleted ? '✓ OK' : 'Local'}</span>
                    </div>
                  )}

                  {/* Consistency Problems */}
                  {msg.consistencyProblems && msg.consistencyProblems.length > 0 && (
                    <div style={{ marginTop: '10px', backgroundColor: 'rgba(255, 159, 10, 0.10)', border: '1px solid rgba(255, 159, 10, 0.3)', color: '#946200', padding: '10px', borderRadius: '10px', fontSize: '12px' }}>
                      <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>⚠️ Contradicciones Detectadas:</p>
                      {msg.consistencyProblems.map((prob, i) => (
                        <p key={i} style={{ margin: 0 }}>• {prob}</p>
                      ))}
                    </div>
                  )}

                  {/* Issues & Suggestions */}
                  {msg.issues && msg.issues.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D1D1F', margin: 0 }}>Propuestas de Cambio:</p>
                      {msg.issues.map((issue) => (
                        <div
                          key={issue.id}
                          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '12px', padding: '10px', fontSize: '12px', color: '#1D1D1F', display: 'flex', flexDirection: 'column', gap: '6px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span style={{ color: issue.severity === 'critical' ? '#FF453A' : '#FF9F0A' }}>
                              [{issue.severity.toUpperCase()}] {issue.title}
                            </span>
                            {issue.status === 'accepted' ? (
                              <span style={{ backgroundColor: 'rgba(52, 199, 89, 0.12)', color: '#34C759', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                                ACEPTADO
                              </span>
                            ) : issue.status === 'rejected' ? (
                              <span style={{ backgroundColor: '#F5F5F7', color: '#6E6E73', padding: '2px 6px', borderRadius: '6px', fontSize: '10px' }}>
                                RECHAZADO
                              </span>
                            ) : null}
                          </div>
                          <p style={{ margin: 0, color: '#6E6E73' }}>{issue.explanation}</p>
                          <div style={{ backgroundColor: '#F5F5F7', padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.06)', fontFamily: 'monospace', fontSize: '11px' }}>
                            {issue.currentText && <p style={{ color: '#FF453A', textDecoration: 'line-through', margin: 0 }}>- {issue.currentText}</p>}
                            {issue.suggestedText && <p style={{ color: '#34C759', margin: 0 }}>+ {issue.suggestedText}</p>}
                          </div>
                          {issue.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
                              <button
                                onClick={() => handleApplyIssue(idx, issue.id)}
                                style={{ backgroundColor: '#34C759', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Aceptar cambio
                              </button>
                              <button
                                onClick={() => handleRejectIssue(idx, issue.id)}
                                style={{ backgroundColor: '#F5F5F7', color: '#6E6E73', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(0, 0, 0, 0.06)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <p style={{ fontWeight: 700, color: '#6E6E73', margin: 0 }}>Fuentes Oficiales Verificadas:</p>
                      {msg.citations.map((cit, i) => (
                        <div key={i} style={{ color: '#007AFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>📜 {normalizeLegalDisplayText(cit.title)}</span>
                          <span style={{ color: '#6E6E73' }}>({normalizeLegalDisplayText(cit.fuente)} • {normalizeLegalDisplayText(cit.materia)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#007AFF', fontSize: '13px', padding: '12px 16px', backgroundColor: 'rgba(0, 122, 255, 0.08)', border: '1px solid rgba(0, 122, 255, 0.16)', borderRadius: '14px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#007AFF' }} />
                <span style={{ fontWeight: 600 }}>{loadingText}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Composer Container */}
          <div style={{ padding: '0 20px 16px 20px' }}>
            <form
              onSubmit={handleSend}
              style={{
                backgroundColor: '#F5F5F7',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '18px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDownTextarea}
                  placeholder="Escribe tu consulta jurídica aquí..."
                  disabled={loading}
                  rows={2}
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#1D1D1F',
                    outline: 'none',
                    resize: 'none',
                    minHeight: '48px',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  style={{
                    backgroundColor: '#007AFF',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '14px',
                    width: '46px',
                    height: '46px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: loading || !input.trim() ? 0.45 : 1,
                    transition: 'background-color 0.15s, opacity 0.15s',
                  }}
                  aria-label="Enviar consulta"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>

              <span style={{ fontSize: '11px', color: '#6E6E73', paddingLeft: '2px', fontWeight: 500 }}>
                Enter para enviar, Shift + Enter para línea nueva
              </span>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
