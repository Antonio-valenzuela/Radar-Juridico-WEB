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
  const [mode, setMode] = useState<
    'Asistencia General' | 'Estrategia Procesal' | 'Resumen de Documento' | 'Análisis de Reforma' | 'Borrador Jurídico'
  >('Asistencia General');
  
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
      if (e.detail?.mode) setMode(e.detail.mode);
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
        contentText = fast.content || data.answer || data.displayAnswer || 'Respuesta generada.';
        citations = fast.citations || data.citations || [];
        issuesList = (fast.issues || data.issues || []).map((i: any) => ({ ...i, status: 'pending' }));
        consistencyProblems = fast.consistencyProblems || data.consistencyProblems || [];
        missingFields = fast.missingFields || data.missingFields || [];
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: contentText,
        contextLabel: activeDocument ? `Demanda / Borrador (${activeDocument.templateName || 'actual'})` : 'Consulta jurídica',
        provider: executionMode === 'deep' ? 'Multimodelo (Gemini+Groq+OpenRouter Juez)' : (data.data?.provider || 'IA Rápida'),
        executionMode,
        usedLocalData: true,
        citations,
        actions: data.suggestedActions || [
          { label: 'Aceptar sugerencias', type: 'accept_issues' },
          { label: 'Revisar contradicciones', type: 'review_contradictions' },
        ],
        issues: issuesList,
        consistencyProblems,
        missingFields,
        warnings: data.warnings || [],
        providerSummary,
        followUpQuestions: [
          '¿Deseas verificar los preceptos constitucionales?',
          '¿Quieres revisar los conceptos de violación?',
          '¿Deseas generar la versión mejorada del borrador?',
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

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-blue-700 text-white px-4 py-3 rounded-full shadow-xl hover:bg-blue-800 transition-all font-medium text-sm"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Asistente Multimodelo IA</span>
        </button>
      )}

      {/* Main Drawer Container */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] h-[680px] transition-all">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div>
                <h3 className="font-semibold text-sm">Asistente Legal Multimodelo (G0DM0D3)</h3>
                <p className="text-xs text-slate-300">Gemini • Groq • OpenRouter Juez • Local</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearHistory}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                title="Limpiar conversación"
              >
                Limpiar
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mode Selector Header */}
          <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700 text-xs">
            <span className="text-slate-300 font-medium">Modo de Procesamiento:</span>
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setExecutionMode('fast')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  executionMode === 'fast'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚡ Rápido (1 IA)
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode('deep')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  executionMode === 'deep'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🧠 Revisión Profunda (3 IA)
              </button>
            </div>
          </div>

          {/* Active Context Banner */}
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700 flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                {activeDocument
                  ? `Usando borrador: ${activeDocument.templateName || 'Documento activo'}`
                  : 'Sin borrador activo'}
              </span>
              <select
                value={contextMode}
                onChange={(e) => setContextMode(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-700 text-xs focus:ring-1 focus:ring-blue-600"
              >
                <option value="current_document">Usar borrador actual</option>
                <option value="none">Sin contexto</option>
              </select>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {messages.length === 0 && (
              <div className="text-center py-8 text-slate-500 space-y-3">
                <div className="text-2xl">⚖️</div>
                <p className="font-medium text-slate-700">¿Qué deseas revisar hoy?</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Selecciona <b>Revisión Profunda</b> para ejecutar Gemini y Groq en paralelo con OpenRouter actuando como Juez.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  <button
                    onClick={() => {
                      setExecutionMode('deep');
                      handleSend(undefined, 'revisa el machote que acabo de crear');
                    }}
                    className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-full transition"
                  >
                    🧠 &quot;Revisión profunda del machote actual&quot;
                  </button>
                  <button
                    onClick={() => {
                      setExecutionMode('fast');
                      handleSend(undefined, '¿qué le falta a esta demanda?');
                    }}
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-full transition"
                  >
                    ⚡ &quot;Revisión rápida de campos pendientes&quot;
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] p-3.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-blue-700 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                  }`}
                >
                  {/* Provider Header Badge */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 mb-2 text-[11px]">
                      <span className="font-semibold text-slate-600 flex items-center gap-1">
                        🤖 {msg.provider || 'IA'}
                      </span>
                      {msg.executionMode === 'deep' && (
                        <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px]">
                          REVISIÓN PROFUNDA 3 IA
                        </span>
                      )}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                  {/* Provider Execution Summary */}
                  {msg.providerSummary && (
                    <div className="mt-2.5 bg-slate-200/70 p-2 rounded-lg text-[11px] font-mono text-slate-700 flex flex-wrap gap-2 border border-slate-300/50">
                      <span>Gemini: {msg.providerSummary.geminiCompleted ? '✓ OK' : '✗ N/D'}</span>
                      <span>Groq: {msg.providerSummary.groqCompleted ? '✓ OK' : '✗ N/D'}</span>
                      <span>Juez OpenRouter: {msg.providerSummary.judgeCompleted ? '✓ OK' : ' Local Fallback'}</span>
                    </div>
                  )}

                  {/* Consistency & Contradiction Warnings */}
                  {msg.consistencyProblems && msg.consistencyProblems.length > 0 && (
                    <div className="mt-3 bg-amber-50 border border-amber-300 text-amber-900 p-2.5 rounded-lg text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        ⚠️ Contradicciones e Incongruencias Detectadas:
                      </p>
                      {msg.consistencyProblems.map((prob, i) => (
                        <p key={i} className="leading-normal">• {prob}</p>
                      ))}
                    </div>
                  )}

                  {/* Issues & Diffs */}
                  {msg.issues && msg.issues.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Propuestas de Cambio e Inspección:</p>
                      {msg.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className="bg-white border border-slate-300 rounded-lg p-2.5 text-xs space-y-1.5 shadow-sm text-slate-800"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className={issue.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}>
                              [{issue.severity.toUpperCase()}] {issue.title}
                            </span>
                            {issue.status === 'accepted' ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">
                                ACEPTADO
                              </span>
                            ) : issue.status === 'rejected' ? (
                              <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                                RECHAZADO
                              </span>
                            ) : null}
                          </div>
                          <p className="text-slate-600">{issue.explanation}</p>

                          {issue.modelAgreement && (
                            <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                              Coincidencia: {issue.modelAgreement === 'both' ? 'Gemini + Groq' : issue.modelAgreement}
                            </span>
                          )}

                          <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] space-y-1">
                            {issue.currentText && <p className="text-red-700 line-through">- {issue.currentText}</p>}
                            {issue.suggestedText && <p className="text-emerald-700">+ {issue.suggestedText}</p>}
                          </div>

                          {issue.status === 'pending' && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleApplyIssue(idx, issue.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[11px] font-medium"
                              >
                                Aceptar cambio
                              </button>
                              <button
                                onClick={() => handleRejectIssue(idx, issue.id)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded text-[11px]"
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
                    <div className="mt-3 pt-2 border-t border-slate-200/60 text-xs space-y-1">
                      <p className="font-semibold text-slate-600">Fuentes Oficiales Verificadas:</p>
                      {msg.citations.map((cit, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-blue-700 hover:underline">
                          <span>📜 {normalizeLegalDisplayText(cit.title)}</span>
                          <span className="text-slate-500">({normalizeLegalDisplayText(cit.fuente)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-600 text-xs p-3 bg-purple-50 border border-purple-200 rounded-xl animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-bounce" />
                <span className="font-medium">{loadingText}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-200 flex gap-2 bg-slate-50 rounded-b-2xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={executionMode === 'deep' ? 'Consulta para revisión profunda multimodelo (3 IA)...' : 'Escribe tu consulta jurídica rápida...'}
              disabled={loading}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`${
                executionMode === 'deep' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-blue-700 hover:bg-blue-800'
              } text-white px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5`}
            >
              <span>{executionMode === 'deep' ? 'Revisión Profunda' : 'Enviar'}</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
