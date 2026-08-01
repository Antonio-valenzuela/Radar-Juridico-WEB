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
  status?: 'pending' | 'accepted' | 'rejected';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  contextLabel?: string;
  provider?: string;
  usedLocalData?: boolean;
  citations?: Citation[];
  actions?: ActionBtn[];
  issues?: Issue[];
  consistencyProblems?: string[];
  missingFields?: string[];
  warnings?: string[];
  followUpQuestions?: string[];
  isError?: boolean;
}

export default function FloatingLegalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Analizando contexto...');
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

  // Restore history from sessionStorage on load
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

    const userMsg: Message = { role: 'user', content: textToSend.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setLoadingText('Analizando documento y leyes vigentes...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/ai/legal-assistant', {
        method: 'POST',
        headers: getAdminTokenHeaders({ 'Content-Type': 'application/json' }, getAdminToken()),
        signal: controller.signal,
        body: JSON.stringify({
          message: userMsg.content,
          contextMode,
          activeDocument,
          module: activeModule,
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.friendlyMessage || data.error || 'No se pudo generar la respuesta.');
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.answer || data.displayAnswer || 'Respuesta generada.',
        contextLabel: data.contextLabel,
        provider: data.technical?.provider || 'IA Jurídica',
        usedLocalData: true,
        citations: data.citations || [],
        actions: data.suggestedActions || [],
        issues: (data.issues || []).map((i: any) => ({ ...i, status: 'pending' })),
        consistencyProblems: data.consistencyProblems || [],
        missingFields: data.missingFields || [],
        warnings: data.warnings || [],
        followUpQuestions: data.followUpQuestions || [
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
          <span>Asistente Legal IA</span>
        </button>
      )}

      {/* Main Drawer Container */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] h-[650px] transition-all">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div>
                <h3 className="font-semibold text-sm">Asistente Legal Jurídico Radar</h3>
                <p className="text-xs text-slate-300">Contexto en tiempo real</p>
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

          {/* Active Context Banner */}
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                {activeDocument
                  ? `Usando contexto: ${activeDocument.templateName || 'Borrador actual'}`
                  : 'Sin documento activo'}
              </span>
              <select
                value={contextMode}
                onChange={(e) => setContextMode(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-700 text-xs focus:ring-1 focus:ring-blue-600"
              >
                <option value="current_document">Usar documento actual</option>
                <option value="none">No usar contexto</option>
                <option value="current_case">Usar expediente activo</option>
              </select>
            </div>
            {activeDocument && contextMode === 'current_document' && (
              <p className="text-slate-500 truncate">
                Materia: {activeDocument.matter || 'General'} | Jurisdicción: {activeDocument.jurisdiction || 'federal'} | {activeDocument.pendingMarkers?.length || 0} campos pendientes
              </p>
            )}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {messages.length === 0 && (
              <div className="text-center py-10 text-slate-500 space-y-3">
                <div className="text-2xl">⚖️</div>
                <p className="font-medium text-slate-700">¿En qué puedo ayudarte hoy?</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Pregunta sobre el documento activo, revisa incongruencias o redacta conceptos de violación.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  <button
                    onClick={() => handleSend(undefined, 'revisa el machote que acabo de crear')}
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-full transition"
                  >
                    "Revisa el machote que acabo de crear"
                  </button>
                  <button
                    onClick={() => handleSend(undefined, '¿qué le falta a esta demanda?')}
                    className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-full transition"
                  >
                    "¿Qué le falta a esta demanda?"
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
                  className={`max-w-[90%] p-3.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-blue-700 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                  {/* Consistency Warnings */}
                  {msg.consistencyProblems && msg.consistencyProblems.length > 0 && (
                    <div className="mt-3 bg-amber-50 border border-amber-300 text-amber-900 p-2.5 rounded-lg text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        ⚠️ Advertencia de Incongruencia Jurídica:
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
                          <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] space-y-1">
                            <p className="text-red-700 line-through">- {issue.currentText}</p>
                            <p className="text-emerald-700">+ {issue.suggestedText}</p>
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
                      {msg.citations.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-blue-700 hover:underline">
                          <span>📜 {c.title}</span>
                          <span className="text-slate-500">({c.fuente})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs p-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                <span>{loadingText}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-200 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu consulta jurídica..."
              disabled={loading}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
