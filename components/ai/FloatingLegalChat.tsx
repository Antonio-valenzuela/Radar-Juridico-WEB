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
      if (e.detail?.executionMode) setExecutionMode(e.detail.executionMode);
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

  const handleSend = async (e?: React.FormEvent, customInput?: string) => {
    if (e) e.preventDefault();
    const textToSend = customInput || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: textToSend.trim(), executionMode };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    if (executionMode === 'deep') {
      setLoadingText('✓ Gemini + Groq en paralelo... ⏳ Verificando con Juez OpenRouter...');
    } else {
      setLoadingText('Consultando proveedor rápido (Gemini → Groq → OpenRouter)...');
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

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
          activeDocument,
          module: activeModule,
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
        contextLabel: activeDocument ? `Demanda / Borrador (${activeDocument.templateName || 'actual'})` : 'Consulta jurídica',
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
      {/* Floating Closed Trigger Button */}
      {!isOpen && (
        <button
          id="floating-legal-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente legal"
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '9999px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(28, 56, 92, 0.4)',
            backgroundColor: '#1c385c',
            color: '#ffffff',
            border: '2px solid #ffffff',
            fontSize: '26px',
            transition: 'transform 0.2s, background-color 0.2s',
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
            backgroundColor: 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(2px)',
            zIndex: 99998,
          }}
          aria-hidden="true"
        />
      )}

      {/* Floating Card Panel with Pure Inline Styles */}
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
            height: '640px',
            maxHeight: 'calc(100vh - 48px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f0f4f8',
            borderRadius: '20px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 20px 48px rgba(15, 30, 50, 0.3)',
            overflow: 'hidden',
            boxSizing: 'border-box',
            fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              backgroundColor: '#1c385c',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px', lineHeight: 1 }}>⚖️</span>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                Asistente Legal
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
              aria-label="Cerrar asistente legal"
            >
              ✕
            </button>
          </div>

          {/* Subheader Controls Section */}
          <div style={{ padding: '16px 20px 12px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Subtitle & Limpiar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', color: '#2d3748', fontWeight: 500 }}>
                Consulta y revisión asistida por IA
              </span>
              <button
                onClick={handleClearHistory}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '13px',
                  color: '#2d3748',
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
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a202c' }}>Modo de Análisis:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setExecutionMode('fast')}
                  style={{
                    backgroundColor: executionMode === 'fast' ? '#38b2ac' : '#ffffff',
                    color: executionMode === 'fast' ? '#1a202c' : '#2d3748',
                    border: executionMode === 'fast' ? '1px solid #319795' : '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '6px 12px',
                    fontSize: '13px',
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
                    backgroundColor: executionMode === 'deep' ? '#38b2ac' : '#ffffff',
                    color: executionMode === 'deep' ? '#1a202c' : '#2d3748',
                    border: executionMode === 'deep' ? '1px solid #319795' : '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '6px 12px',
                    fontSize: '13px',
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
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a202c' }}>Contexto activo:</span>
              <select
                id="context-select"
                value={contextMode}
                onChange={(e) => setContextMode(e.target.value as any)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '6px 14px',
                  fontSize: '14px',
                  color: '#1a202c',
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
                    padding: '14px 16px',
                    borderRadius: '16px',
                    backgroundColor: msg.role === 'user' ? '#1c385c' : '#ffffff',
                    color: msg.role === 'user' ? '#ffffff' : '#1a202c',
                    border: msg.role === 'user' ? 'none' : '1px solid #cbd5e1',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#1c385c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🤖 {msg.provider || 'Asistente Legal'}
                      </span>
                      {msg.executionMode === 'deep' && (
                        <span style={{ backgroundColor: '#e6fffa', color: '#234e52', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', fontSize: '10px' }}>
                          PROFUNDA 3 IA
                        </span>
                      )}
                    </div>
                  )}

                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '14px' }}>{msg.content}</p>

                  {/* Provider summary */}
                  {msg.providerSummary && (
                    <div style={{ marginTop: '10px', backgroundColor: '#edf2f7', padding: '8px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', color: '#1a202c', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Gemini: {msg.providerSummary.geminiCompleted ? '✓ OK' : '✗ N/D'}</span>
                      <span>Groq: {msg.providerSummary.groqCompleted ? '✓ OK' : '✗ N/D'}</span>
                      <span>Juez: {msg.providerSummary.judgeCompleted ? '✓ OK' : 'Local'}</span>
                    </div>
                  )}

                  {/* Consistency Problems */}
                  {msg.consistencyProblems && msg.consistencyProblems.length > 0 && (
                    <div style={{ marginTop: '10px', backgroundColor: '#fffaf0', border: '1px solid #fbd38d', color: '#744210', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
                      <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>⚠️ Contradicciones Detectadas:</p>
                      {msg.consistencyProblems.map((prob, i) => (
                        <p key={i} style={{ margin: 0 }}>• {prob}</p>
                      ))}
                    </div>
                  )}

                  {/* Issues & Suggestions */}
                  {msg.issues && msg.issues.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a202c', margin: 0 }}>Propuestas de Cambio:</p>
                      {msg.issues.map((issue) => (
                        <div
                          key={issue.id}
                          style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#1a202c', display: 'flex', flexDirection: 'column', gap: '6px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span style={{ color: issue.severity === 'critical' ? '#c53030' : '#dd6b20' }}>
                              [{issue.severity.toUpperCase()}] {issue.title}
                            </span>
                            {issue.status === 'accepted' ? (
                              <span style={{ backgroundColor: '#c6f6d5', color: '#22543d', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                ACEPTADO
                              </span>
                            ) : issue.status === 'rejected' ? (
                              <span style={{ backgroundColor: '#edf2f7', color: '#718096', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                RECHAZADO
                              </span>
                            ) : null}
                          </div>
                          <p style={{ margin: 0, color: '#4a5568' }}>{issue.explanation}</p>
                          <div style={{ backgroundColor: '#f7fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '11px' }}>
                            {issue.currentText && <p style={{ color: '#e53e3e', textDecoration: 'line-through', margin: 0 }}>- {issue.currentText}</p>}
                            {issue.suggestedText && <p style={{ color: '#276749', margin: 0 }}>+ {issue.suggestedText}</p>}
                          </div>
                          {issue.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
                              <button
                                onClick={() => handleApplyIssue(idx, issue.id)}
                                style={{ backgroundColor: '#2f855a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Aceptar cambio
                              </button>
                              <button
                                onClick={() => handleRejectIssue(idx, issue.id)}
                                style={{ backgroundColor: '#e2e8f0', color: '#4a5568', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
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
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <p style={{ fontWeight: 700, color: '#4a5568', margin: 0 }}>Fuentes Oficiales Verificadas:</p>
                      {msg.citations.map((cit, i) => (
                        <div key={i} style={{ color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>📜 {normalizeLegalDisplayText(cit.title)}</span>
                          <span style={{ color: '#718096' }}>({normalizeLegalDisplayText(cit.fuente)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1c385c', fontSize: '13px', padding: '12px 16px', backgroundColor: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: '14px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: '#1c385c' }} />
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
                backgroundColor: '#e2e8f0',
                border: '1px solid #cbd5e1',
                borderRadius: '16px',
                padding: '12px',
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
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#1a202c',
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
                    backgroundColor: '#3b5e7e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    width: '46px',
                    height: '46px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: loading || !input.trim() ? 0.6 : 1,
                    transition: 'background-color 0.15s',
                  }}
                  aria-label="Enviar consulta"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>

              <span style={{ fontSize: '12px', color: '#4a5568', paddingLeft: '2px', fontWeight: 500 }}>
                Enter para enviar, Shift + Enter para línea nueva
              </span>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
