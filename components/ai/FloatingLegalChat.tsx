'use client';

import { useState, useEffect, useRef } from 'react';

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
  payload: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  usedLocalData?: boolean;
  citations?: Citation[];
  actions?: ActionBtn[];
  followUpQuestions?: string[];
  isError?: boolean;
}

export default function FloatingLegalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Analizando documentos...');
  const [mode, setMode] = useState<
    'Asistencia General' | 'Estrategia Procesal' | 'Resumen de Documento' | 'Análisis de Reforma' | 'Borrador Jurídico'
  >('Asistencia General');
  const [context, setContext] = useState<any>(null);

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

    // Listen to open-chat custom events
    const handleOpenChat = (e: Event & { detail?: any }) => {
      setIsOpen(true);
      if (e.detail) {
        const { mode: newMode, query, filters, resultCount, documentId } = e.detail;
        if (newMode) setMode(newMode);
        setContext(e.detail);

        if (newMode === 'empty_search_assistant') {
          const introMsg: Message = {
            role: 'assistant',
            content: `Hola. He detectado que tu búsqueda para "${query || ''}" no arrojó resultados locales. ¿Te gustaría que analice términos alternativos o te sugiera fuentes oficiales para este tema?`,
            provider: 'Sistema',
            actions: [
              { label: 'Analizar Derecho Familiar', type: 'search_query', payload: { query: 'derecho familiar' } },
              { label: 'Quitar filtros', type: 'clear_filters', payload: {} }
            ]
          };
          setMessages((prev) => {
            const updated = [...prev, introMsg];
            sessionStorage.setItem('juridico_chat_history', JSON.stringify(updated));
            return updated;
          });
        }
      }
    };

    const handleQueryChanged = (e: Event & { detail?: any }) => {
      if (e.detail) {
        setContext((prev: any) => ({
          ...(prev || {}),
          query: e.detail.query,
          filters: e.detail.filters,
          resultCount: e.detail.resultCount
        }));
      }
    };

    window.addEventListener('open-legal-chat', handleOpenChat as any);
    window.addEventListener('search-query-changed', handleQueryChanged as any);
    return () => {
      window.removeEventListener('open-legal-chat', handleOpenChat as any);
      window.removeEventListener('search-query-changed', handleQueryChanged as any);
    };
  }, []);

  // Scroll to bottom when messages change
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
    setLoadingText('Analizando documentos...');

    const statusInterval = setInterval(() => {
      setLoadingText('Preparando respuesta...');
    }, 2000);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Timeout de 30 segundos
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    try {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const token = localStorage.getItem('juridico_admin_token') || 'dev-admin-token';

      const res = await fetch('/api/ai/chat-bubble', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: userMsg.content,
          currentPath,
          mode,
          query: context?.query || '',
          filters: context?.filters || {},
          resultCount: context?.resultCount ?? null,
          documentId: context?.documentId || null,
        }),
      });

      clearTimeout(timeoutId);
      clearInterval(statusInterval);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.friendlyMessage || data.error || 'No se pudo generar la respuesta.');
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.answer ?? '',
        provider: data.technical?.provider || 'IA',
        usedLocalData: data.usedLocalData,
        citations: data.sources || [],
        actions: data.actions || [],
        followUpQuestions: data.followUpQuestions || []
      };

      const updated = [...newMessages, assistantMsg];
      setMessages(updated);
      sessionStorage.setItem('juridico_chat_history', JSON.stringify(updated));
    } catch (err: any) {
      clearTimeout(timeoutId);
      clearInterval(statusInterval);

      let errorMsgText = 'No pude generar la respuesta en este momento. Intenta reformular tu pregunta o verifica tu conexión.';
      if (err.name === 'AbortError') {
        errorMsgText = 'La consulta excedió el tiempo límite de espera (30s). ¿Deseas reintentar?';
      } else if (err.message) {
        errorMsgText = err.message;
      }

      const errorMsg: Message = {
        role: 'assistant',
        content: errorMsgText,
        provider: 'Sistema',
        isError: true
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleActionClick = (action: ActionBtn) => {
    const { type, payload } = action;

    if (type === 'clear_filters') {
      window.dispatchEvent(new CustomEvent('chat-action-clear'));
    } else if (type === 'search_query' || type === 'search_source' || type === 'search') {
      const detail = {
        query: payload?.query || '',
        matter: payload?.matter || '',
        source: payload?.source || '',
        dateRange: payload?.dateRange || '',
      };
      if (window.location.pathname === '/search') {
        window.dispatchEvent(new CustomEvent('chat-action-query', { detail }));
      } else {
        const params = new URLSearchParams();
        if (detail.query) params.set('query', detail.query);
        if (detail.matter) params.set('matter', detail.matter);
        if (detail.source) params.set('source', detail.source);
        if (detail.dateRange) params.set('dateRange', detail.dateRange);
        params.set('auto', '1');
        window.location.href = `/search?${params.toString()}`;
      }
    } else if (type === 'force_textual') {
      window.dispatchEvent(new CustomEvent('chat-action-mode', { detail: { mode: 'text' } }));
    } else if (type === 'add_link' || type === 'add_source_url') {
      const urlParam = payload?.url || '';
      window.location.href = `/admin/ingest/manual-url?url=${encodeURIComponent(urlParam)}`;
    } else if (type === 'create_alert') {
      const params = new URLSearchParams();
      params.set('query', payload?.query || '');
      if (payload?.matter) params.set('matter', payload.matter);
      window.location.href = `/watchlists?${params.toString()}`;
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setContext(null);
    setMode('Asistencia General');
    sessionStorage.removeItem('juridico_chat_history');
  };

  function renderMarkdown(text: string) {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return (
          <h5 key={idx} style={{ margin: '0.75rem 0 0.25rem 0', color: '#c5a880', fontWeight: '700', fontSize: '0.92rem' }}>
            {trimmed.slice(2, -2)}
          </h5>
        );
      }
      if (trimmed.startsWith('- ')) {
        return (
          <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'disc', marginBottom: '0.2rem' }}>
            {renderInlineMarkdown(trimmed.slice(2))}
          </li>
        );
      }
      const listMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (listMatch) {
        return (
          <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'decimal', marginBottom: '0.2rem' }}>
            {renderInlineMarkdown(listMatch[2])}
          </li>
        );
      }
      if (!trimmed) {
        return <div key={idx} style={{ height: '0.5rem' }} />;
      }
      return (
        <p key={idx} style={{ margin: '0 0 0.5rem 0' }}>
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  }

  function renderInlineMarkdown(text: string) {
    const parts = [];
    let remaining = text;
    while (remaining.includes('**')) {
      const startIdx = remaining.indexOf('**');
      const endIdx = remaining.indexOf('**', startIdx + 2);
      if (endIdx === -1) break;

      if (startIdx > 0) {
        parts.push(remaining.substring(0, startIdx));
      }
      parts.push(<strong key={startIdx} style={{ color: '#ffffff' }}>{remaining.substring(startIdx + 2, endIdx)}</strong>);
      remaining = remaining.substring(endIdx + 2);
    }
    if (remaining) {
      parts.push(remaining);
    }
    return parts.length > 0 ? parts : text;
  }

  return (
    <div className="floating-chat-root">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button className="chat-toggle-btn" onClick={() => setIsOpen(true)} title="Asistente IA">
          <span className="pulse-ring"></span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="chat-panel">
          <header className="chat-header">
            <div className="header-info">
              <span className="status-dot"></span>
              <div>
                <h4>Asistente Legal IA</h4>
                <div style={{ marginTop: '0.2rem' }}>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                    className="mode-select"
                  >
                    <option value="Asistencia General">Asistencia General</option>
                    <option value="Estrategia Procesal">Estrategia Procesal</option>
                    <option value="Resumen de Documento">Resumen de Documento</option>
                    <option value="Análisis de Reforma">Análisis de Reforma</option>
                    <option value="Borrador Jurídico">Borrador Jurídico</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="header-actions">
              <button className="clear-btn" onClick={handleClearHistory} title="Limpiar historial">🗑️</button>
              <button className="close-btn" onClick={() => setIsOpen(false)} title="Cerrar">✕</button>
            </div>
          </header>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-chat-state">
                <span className="balance-icon">⚖️</span>
                <p>Bienvenido al Asistente Jurídico de Jurídico Radar.</p>
                <p className="empty-sub">Pregúntame sobre normativas, amparos, reformas o borradores.</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`message-row ${msg.role}`}>
                  <div className="message-bubble">
                    <div className="message-content">
                      {renderMarkdown(msg.content)}
                    </div>

                    {/* Citations List as Discrete Cards */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="citations-container">
                        <strong className="citations-title">Documentos consultados:</strong>
                        <div className="citations-grid">
                          {msg.citations.map((cit, idx) => (
                            <div key={idx} className="citation-card">
                              <div className="cit-header">
                                <span className="cit-source">{cit.fuente}</span>
                                <span className="cit-matter">{cit.materia}</span>
                              </div>
                              <div className="cit-title">{cit.title}</div>
                              {cit.url && (
                                <a href={cit.url} target="_blank" rel="noopener noreferrer" className="cit-link">
                                  Ver Oficial &rarr;
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick action buttons */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="actions-container">
                        {msg.actions.map((act, idx) => (
                          <button key={idx} className="action-button" onClick={() => handleActionClick(act)}>
                            ⚡ {act.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Follow-up suggestion buttons */}
                    {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                      <div className="followups-container">
                        {msg.followUpQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            className="followup-button"
                            onClick={() => handleSend(undefined, q)}
                          >
                            💬 {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="message-row assistant">
                <div className="message-bubble loading-bubble">
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: '500' }}>
                    {loadingText}
                  </div>
                  <div className="loading-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="disclaimer-area">
            Respuesta generada con apoyo de IA. Contrasta con la fuente oficial y el caso concreto.
          </div>

          <form onSubmit={(e) => handleSend(e)} className="chat-input-form">
            <input
              type="text"
              placeholder="Escribe tu consulta jurídica aquí..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="chat-input-field"
              disabled={loading}
              required
            />
            {loading ? (
              <button type="button" className="chat-cancel-btn" onClick={handleCancel}>
                ✕
              </button>
            ) : (
              <button type="submit" className="chat-send-btn">
                Enviar
              </button>
            )}
          </form>
        </div>
      )}

      <style jsx global>{`
        .floating-chat-root {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
          font-family: 'Outfit', sans-serif;
        }

        .chat-toggle-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #c5a880 0%, #b3956b 100%);
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 30px rgba(197, 168, 128, 0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .chat-toggle-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 35px rgba(197, 168, 128, 0.5);
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid #c5a880;
          animation: pulse 2s infinite;
          opacity: 0;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        .chat-panel {
          width: 420px;
          height: 580px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(197, 168, 128, 0.25);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(20px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .chat-header {
          padding: 0.85rem 1rem;
          background: rgba(9, 13, 22, 0.8);
          border-bottom: 1px solid rgba(197, 168, 128, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .header-info h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #ffffff;
        }

        .mode-select {
          background: #1e293b;
          color: #ffffff;
          border: 1px solid rgba(197, 168, 128, 0.3);
          border-radius: 4px;
          padding: 0.2rem 0.4rem;
          font-size: 0.75rem;
          outline: none;
          cursor: pointer;
        }

        .header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .clear-btn, .close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          font-size: 0.9rem;
          transition: color 0.2s;
        }

        .clear-btn:hover { color: #ef4444; }
        .close-btn:hover { color: #ffffff; }

        .chat-messages {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .empty-chat-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: #94a3b8;
          padding: 1.5rem;
        }

        .balance-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          color: #c5a880;
        }

        .empty-chat-state p {
          font-size: 0.9rem;
          margin: 0 0 0.5rem 0;
          font-weight: 500;
        }

        .empty-chat-state .empty-sub {
          font-size: 0.8rem;
          color: #64748b;
        }

        .message-row {
          display: flex;
          width: 100%;
        }

        .message-row.user {
          justify-content: flex-end;
        }

        .message-row.assistant {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 88%;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          font-size: 0.88rem;
          line-height: 1.45;
          position: relative;
        }

        .message-row.user .message-bubble {
          background: linear-gradient(135deg, #c5a880 0%, #b3956b 100%);
          color: #0f172a;
          font-weight: 500;
          border-bottom-right-radius: 2px;
        }

        .message-row.assistant .message-bubble {
          background: #1e293b;
          color: #cbd5e1;
          border-bottom-left-radius: 2px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Citations grid as discrete cards */
        .citations-container {
          margin-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 0.75rem;
        }

        .citations-title {
          font-size: 0.72rem;
          color: #c5a880;
          text-transform: uppercase;
          font-weight: 700;
          display: block;
          margin-bottom: 0.4rem;
        }

        .citations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
        }

        .citation-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(197, 168, 128, 0.2);
          border-radius: 8px;
          padding: 0.6rem;
          font-size: 0.75rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .cit-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.62rem;
          margin-bottom: 0.25rem;
        }

        .cit-source {
          color: #c5a880;
          font-weight: 700;
        }

        .cit-matter {
          color: #64748b;
        }

        .cit-title {
          color: #f1f5f9;
          font-weight: 600;
          line-height: 1.25;
          margin-bottom: 0.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cit-link {
          color: #38bdf8;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.7rem;
        }

        .cit-link:hover {
          text-decoration: underline;
        }

        /* Follow-ups buttons */
        .followups-container {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 0.75rem;
        }

        .followup-button {
          width: 100%;
          text-align: left;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(197, 168, 128, 0.25);
          color: #f8fafc;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }

        .followup-button:hover {
          background: rgba(197, 168, 128, 0.08);
          border-color: #c5a880;
        }

        /* Actions container */
        .actions-container {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 0.75rem;
        }

        .action-button {
          width: 100%;
          text-align: left;
          background: rgba(197, 168, 128, 0.1);
          border: 1px solid #c5a880;
          color: #ffffff;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
        }

        /* Loading bubble */
        .loading-bubble {
          padding: 0.75rem 1rem;
        }

        .loading-dots {
          display: flex;
          gap: 4px;
        }

        .loading-dots span {
          width: 6px;
          height: 6px;
          background: #94a3b8;
          border-radius: 50%;
          animation: dotBounce 1.4s infinite ease-in-out both;
        }

        .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
        .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .disclaimer-area {
          font-size: 0.72rem;
          color: #64748b;
          text-align: center;
          padding: 0.6rem;
          background: rgba(9, 13, 22, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.03);
          font-weight: 600;
          line-height: 1.3;
        }

        .chat-input-form {
          display: flex;
          padding: 0.75rem;
          background: #0f172a;
          border-top: 1px solid rgba(197, 168, 128, 0.15);
          gap: 0.5rem;
        }

        .chat-input-field {
          flex: 1;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 0.65rem 0.85rem;
          color: #ffffff;
          font-size: 0.88rem;
        }

        .chat-input-field:focus {
          outline: none;
          border-color: #c5a880;
        }

        .chat-send-btn {
          background: #c5a880;
          color: #0f172a;
          border: none;
          padding: 0.65rem 1rem;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }

        .chat-send-btn:hover {
          background: #b3956b;
        }

        .chat-cancel-btn {
          background: #334155;
          color: #ffffff;
          border: none;
          width: 38px;
          height: 38px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          font-weight: 700;
          transition: background 0.2s;
        }

        .chat-cancel-btn:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}
