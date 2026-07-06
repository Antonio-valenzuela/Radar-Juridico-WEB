'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ManualIngestPage() {
  const [url, setUrl] = useState('');
  const [matter, setMatter] = useState('constitucional');
  const [jurisdiction, setJurisdiction] = useState('federal');
  const [sourceOptional, setSourceOptional] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [indexNow, setIndexNow] = useState(true);
  const [token, setToken] = useState('dev-admin-token');

  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [technicalDetails, setTechnicalDetails] = useState<any>(null);

  // Load token and url param from query string if available
  useEffect(() => {
    const saved = localStorage.getItem('juridico_admin_token');
    if (saved) setToken(saved);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryUrl = params.get('url');
      if (queryUrl) {
        setUrl(queryUrl);
      }
    }

    // Append Google Font Outfit dynamically
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Simulate premium lawyer terminal stages when loading
  useEffect(() => {
    if (!loading) {
      setProgressStep(0);
      return;
    }

    const timers = [
      setTimeout(() => setProgressStep(1), 500),
      setTimeout(() => setProgressStep(2), 1500),
      setTimeout(() => setProgressStep(3), 3000),
      setTimeout(() => setProgressStep(4), 4500),
      setTimeout(() => setProgressStep(5), 6500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [loading]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTechnicalDetails(null);
    setResult(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const res = await fetch('/api/admin/ingest/manual-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token.trim(),
        },
        body: JSON.stringify({
          url: url.trim(),
          matter,
          jurisdiction,
          sourceName: sourceOptional.trim() || undefined,
          tags,
          indexNow,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        const message = data?.error || data?.message || `No se pudo procesar la URL. HTTP ${res.status}`;
        setTechnicalDetails(data?.detail || data?.raw || data);
        throw new Error(message);
      }

      setResult(data);
      localStorage.setItem('juridico_admin_token', token.trim());
    } catch (err: any) {
      setError(err.message || 'Error desconocido al procesar la URL.');
    } finally {
      setLoading(false);
    }
  };

  async function safeJson(response: Response) {
    const raw = await response.text();
    if (!raw) {
      return {
        ok: false,
        error: `Respuesta vacía del servidor. HTTP ${response.status}`,
      };
    }

    try {
      return JSON.parse(raw);
    } catch {
      return {
        ok: false,
        error: response.status === 401
          ? 'Token de administrador no autorizado.'
          : 'El servidor no devolvió JSON válido.',
        raw: raw.slice(0, 500),
        status: response.status,
      };
    }
  }

  return (
    <div className="lawyer-theme-container">
      <div className="accent-glow-1"></div>
      <div className="accent-glow-2"></div>

      <div className="container" style={{ position: 'relative', zIndex: 2, padding: '3rem 1.5rem', maxWidth: '850px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '2.5rem' }}>
          <Link href="/" className="back-link">
            <span className="arrow">←</span> Volver al Dashboard principal
          </Link>
        </div>

        {/* Header and description */}
        <header style={{ marginBottom: '3rem' }}>
          <div className="admin-badge">ADMINISTRACIÓN DE FUENTES</div>
          <h1 className="lawyer-title">Ingesta manual por URL</h1>
          <p className="lawyer-subtitle">
            Pega una URL oficial o jurídica. El sistema valida políticas SSRF, descarga el contenido, limpia menús de navegación/login, clasifica el texto y lo indexa de forma inmediata para búsquedas híbridas, Consultor RAG y radar de alertas.
          </p>
        </header>

        {/* Main Content Form */}
        <div className="glass-card lawyer-card">
          <form onSubmit={handleIngest}>
            {/* Row 1: URL input */}
            <div className="form-group">
              <label className="lawyer-label">URL del Documento Oficial / Jurídico *</label>
              <div className="input-wrapper">
                <span className="input-icon">🌐</span>
                <input
                  type="url"
                  placeholder="https://www.dof.gob.mx/nota_detalle.php?codigo=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="lawyer-input"
                  required
                />
              </div>
            </div>

            {/* Row 2: Grid for Matter, Jurisdiction, Source */}
            <div className="lawyer-grid-3">
              <div className="form-group">
                <label className="lawyer-label">Materia Jurídica</label>
                <select value={matter} onChange={(e) => setMatter(e.target.value)} className="lawyer-select">
                  <option value="constitucional">Constitucional</option>
                  <option value="civil">Civil</option>
                  <option value="mercantil">Mercantil</option>
                  <option value="aduanal">Aduanal</option>
                  <option value="fiscal">Fiscal</option>
                  <option value="laboral">Laboral</option>
                  <option value="salud">Salud</option>
                  <option value="ambiental">Ambiental</option>
                  <option value="energia">Energía</option>
                  <option value="financiero">Financiero</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="comercio_exterior">Comercio exterior</option>
                  <option value="proteccion_datos">Protección de datos</option>
                  <option value="otro">Otro / General</option>
                </select>
              </div>

              <div className="form-group">
                <label className="lawyer-label">Jurisdicción básica</label>
                <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="lawyer-select">
                  <option value="federal">Federal</option>
                  <option value="estatal">Estatal</option>
                  <option value="SAT">SAT</option>
                  <option value="SCJN">SCJN</option>
                  <option value="SJF">SJF</option>
                  <option value="DOF">DOF</option>
                  <option value="manual">Manual / Otro</option>
                </select>
              </div>

              <div className="form-group">
                <label className="lawyer-label">Fuente específica (opcional)</label>
                <input
                  type="text"
                  placeholder="ej. DOF, SCJN, Congreso local..."
                  value={sourceOptional}
                  onChange={(e) => setSourceOptional(e.target.value)}
                  className="lawyer-input"
                />
              </div>
            </div>

            {/* Row 3: Grid for Tags & Admin Token */}
            <div className="lawyer-grid-2">
              <div className="form-group">
                <label className="lawyer-label">Tags u etiquetas opcionales</label>
                <input
                  type="text"
                  placeholder="ej. sat, laboral, cliente-x"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="lawyer-input"
                />
              </div>

              <div className="form-group">
                <label className="lawyer-label">Token de administrador *</label>
                <input
                  type="password"
                  placeholder="•••••••••••••••"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="lawyer-input"
                  required
                />
              </div>
            </div>

            {/* Row 4: Custom switch for IndexNow */}
            <div className="switch-container">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={indexNow}
                  onChange={(e) => setIndexNow(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
              <div className="switch-text-container">
                <span className="switch-title">Indexar ahora para búsqueda híbrida y RAG</span>
                <span className="switch-desc">Genera embeddings semánticos en pgvector de inmediato para consultas con IA.</span>
              </div>
            </div>

            {/* Submit button */}
            <div style={{ marginTop: '2.5rem' }}>
              <button type="submit" className="lawyer-btn-submit" disabled={loading}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <span className="btn-spinner"></span>
                    Ingestando documento...
                  </span>
                ) : (
                  'Procesar URL'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Loading Terminal Progress Console */}
        {loading && (
          <div className="glass-card terminal-card">
            <div className="terminal-header">
              <span className="terminal-dot red"></span>
              <span className="terminal-dot yellow"></span>
              <span className="terminal-dot green"></span>
              <span className="terminal-title">Bitácora de Ingesta en tiempo real</span>
            </div>
            <div className="terminal-body">
              <div className="terminal-line active">⚡ Ingesta manual iniciada...</div>
              {progressStep >= 1 && <div className="terminal-line active">🛡️ Validando políticas de seguridad SSRF y DNS...</div>}
              {progressStep >= 2 && <div className="terminal-line active">🌐 Conectando al servidor oficial remoto...</div>}
              {progressStep >= 3 && <div className="terminal-line active">📥 Descargando cuerpo del documento (HTML/PDF)...</div>}
              {progressStep >= 4 && <div className="terminal-line active">🧹 Extrayendo texto y depurando scripts / menús...</div>}
              {progressStep >= 5 && <div className="terminal-line active">🤖 Clasificando materia e indexando chunks en base vectorial...</div>}
            </div>
          </div>
        )}

        {/* Success / Failure Result Card */}
        {error && (
          <div className="result-card error-card">
            <div className="result-icon">⚠️</div>
            <div className="result-content">
              <h3>Fallo en el Procesamiento</h3>
              <p>{error}</p>
              {technicalDetails && (
                <details className="technical-details">
                  <summary>Ver detalles técnicos</summary>
                  <pre>{typeof technicalDetails === 'string' ? technicalDetails : JSON.stringify(technicalDetails, null, 2)}</pre>
                </details>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="result-card success-card">
            <div className="result-header">
              <span className="success-icon">✓</span>
              <div>
                <h3 className="success-title">Procesamiento Completado</h3>
                <span className="status-badge">Estado: {result.status}</span>
                <span className="status-help">Estados posibles: stored, quarantined, failed; cuarentena requiere revisión.</span>
              </div>
            </div>

            <p className="success-msg">{result.message}</p>

            {(result.found !== undefined || result.saved !== undefined || result.duplicates !== undefined) && (
              <div className="result-counts">
                <span>Encontrados: {result.found ?? 1}</span>
                <span>Guardados: {result.saved ?? (result.status === 'stored' ? 1 : 0)}</span>
                <span>Duplicados: {result.duplicates ?? 0}</span>
              </div>
            )}

            {result.warnings?.length > 0 && (
              <div className="warning-list">
                {result.warnings.map((warning: string) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <div className="result-details">
              <div className="detail-row">
                <span className="detail-label">Código ID del Documento</span>
                <span className="detail-value">{result.documentId || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Versión Asignada</span>
                <span className="detail-value">{result.versionId || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Embeddings Generados (pgvector)</span>
                <span className="detail-value">{result.indexed ? 'Sí' : 'Pendiente (Segundo Plano)'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Habilitado en Consultor RAG</span>
                <span className="detail-value">{result.ragReady ? 'Sí' : 'No'}</span>
              </div>
            </div>

            <div className="action-row">
              <Link href="/search" className="btn-action-primary">
                Ir a Búsqueda Avanzada
              </Link>
              <Link href="/rag" className="btn-action-secondary">
                Abrir RAG Legal
              </Link>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* Law Theme Styling Variables */
        :root {
          --lawyer-gold: #c5a880;
          --lawyer-gold-hover: #b4966e;
          --lawyer-bg: #090d16;
          --lawyer-card-bg: rgba(15, 23, 42, 0.6);
          --lawyer-input-bg: rgba(15, 23, 42, 0.85);
          --lawyer-accent: #3b82f6;
          --lawyer-card-border: rgba(197, 168, 128, 0.15);
        }

        .lawyer-theme-container {
          background-color: var(--lawyer-bg);
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
          color: #e2e8f0;
          position: relative;
          overflow: hidden;
        }

        /* Accent glows */
        .accent-glow-1 {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(197, 168, 128, 0.04) 0%, transparent 70%);
          top: -200px;
          right: -200px;
          z-index: 1;
        }

        .accent-glow-2 {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.03) 0%, transparent 70%);
          bottom: -300px;
          left: -300px;
          z-index: 1;
        }

        /* Breadcrumb links */
        .back-link {
          color: var(--lawyer-gold);
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          transition: color 0.2s, transform 0.2s;
        }

        .back-link:hover {
          color: var(--lawyer-gold-hover);
          transform: translateX(-4px);
        }

        .back-link .arrow {
          transition: transform 0.2s;
        }

        /* Badge and titles */
        .admin-badge {
          background: rgba(197, 168, 128, 0.08);
          color: var(--lawyer-gold);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          padding: 0.35rem 0.85rem;
          border-radius: 4px;
          display: inline-block;
          margin-bottom: 1rem;
          border: 1px solid rgba(197, 168, 128, 0.2);
        }

        .lawyer-title {
          font-size: 3rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 1rem 0;
        }

        .lawyer-subtitle {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #94a3b8;
          max-width: 780px;
          margin: 0;
        }

        /* Glass lawyer card */
        .lawyer-card {
          background: var(--lawyer-card-bg);
          border: 1px solid var(--lawyer-card-border);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          transition: border-color 0.3s, box-shadow 0.3s;
        }

        .lawyer-card:hover {
          border-color: rgba(197, 168, 128, 0.25);
          box-shadow: 0 20px 45px rgba(197, 168, 128, 0.03);
        }

        /* Form grouping */
        .form-group {
          margin-bottom: 1.5rem;
        }

        .lawyer-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: #94a3b8;
          text-transform: uppercase;
          margin-bottom: 0.55rem;
        }

        /* Inputs, Selects & Icon Wrappers */
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          color: var(--lawyer-gold);
          font-size: 1.1rem;
          pointer-events: none;
        }

        .lawyer-input, .lawyer-select {
          width: 100%;
          padding: 0.85rem 1.15rem;
          background: var(--lawyer-input-bg);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #ffffff;
          font-size: 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .input-wrapper .lawyer-input {
          padding-left: 2.75rem;
        }

        .lawyer-input:focus, .lawyer-select:focus {
          outline: none;
          border-color: var(--lawyer-gold);
          box-shadow: 0 0 0 3px rgba(197, 168, 128, 0.15);
        }

        /* Form grids */
        .lawyer-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .lawyer-grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.25rem;
          margin-bottom: 0.5rem;
        }

        /* Custom switch styling */
        .switch-container {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.25rem;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          margin-top: 2rem;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
          margin-top: 3px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #334155;
          transition: 0.3s;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
        }

        input:checked + .slider {
          background-color: var(--lawyer-gold);
        }

        input:focus + .slider {
          box-shadow: 0 0 1px var(--lawyer-gold);
        }

        input:checked + .slider:before {
          transform: translateX(20px);
        }

        .slider.round {
          border-radius: 24px;
        }

        .slider.round:before {
          border-radius: 50%;
        }

        .switch-text-container {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .switch-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
        }

        .switch-desc {
          font-size: 0.8rem;
          color: #94a3b8;
        }

        /* Submit Button */
        .lawyer-btn-submit {
          width: 100%;
          padding: 1.1rem;
          background: linear-gradient(135deg, var(--lawyer-gold) 0%, #b3956b 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #0f172a;
          font-size: 1.05rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        }

        .lawyer-btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(197, 168, 128, 0.25);
        }

        .lawyer-btn-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .lawyer-btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Spinner inside button */
        .btn-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(15, 23, 42, 0.2);
          border-top-color: #0f172a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Terminal card styling */
        .terminal-card {
          margin-top: 1.5rem;
          padding: 0;
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .terminal-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #0f172a;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .terminal-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }

        .terminal-dot.red { background-color: #ef4444; }
        .terminal-dot.yellow { background-color: #eab308; }
        .terminal-dot.green { background-color: #22c55e; }

        .terminal-title {
          font-family: monospace;
          font-size: 0.75rem;
          color: #94a3b8;
          margin-left: 0.5rem;
        }

        .terminal-body {
          padding: 1.25rem;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.88rem;
          color: #cbd5e1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .terminal-line {
          opacity: 0.4;
          transition: opacity 0.3s;
        }

        .terminal-line.active {
          opacity: 1;
          color: #38bdf8;
        }

        /* Result cards */
        .result-card {
          margin-top: 1.5rem;
          display: flex;
          gap: 1.5rem;
          padding: 2rem;
          border-radius: 16px;
          backdrop-filter: blur(20px);
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
        }

        .result-card.error-card {
          border: 1px solid rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.04);
        }

        .result-card.success-card {
          border: 1px solid rgba(16, 185, 129, 0.3);
          background: rgba(16, 185, 129, 0.04);
          flex-direction: column;
        }

        .result-icon {
          font-size: 2.5rem;
          line-height: 1;
        }

        .result-content h3 {
          margin: 0 0 0.5rem 0;
          color: #ef4444;
          font-size: 1.25rem;
        }

        .result-content p {
          margin: 0;
          color: #cbd5e1;
          line-height: 1.5;
        }

        .technical-details {
          margin-top: 0.9rem;
          color: #fca5a5;
        }

        .technical-details summary {
          cursor: pointer;
          font-weight: 700;
        }

        .technical-details pre {
          white-space: pre-wrap;
          word-break: break-word;
          margin-top: 0.6rem;
          padding: 0.8rem;
          border-radius: 8px;
          background: rgba(0,0,0,0.25);
          color: #fecaca;
          max-height: 240px;
          overflow: auto;
        }

        /* Success detail design */
        .result-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .success-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          font-size: 1.5rem;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .success-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #34d399;
          margin: 0;
        }

        .status-badge {
          background: #064e3b;
          color: #34d399;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 0.15rem 0.55rem;
          border-radius: 4px;
          display: inline-block;
          margin-top: 0.35rem;
          text-transform: uppercase;
        }

        .success-msg {
          color: #cbd5e1;
          line-height: 1.6;
          margin: 0 0 1.5rem 0;
          font-size: 1.05rem;
        }

        .result-counts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          color: #a7f3d0;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .warning-list {
          border: 1px solid rgba(251, 191, 36, 0.25);
          background: rgba(251, 191, 36, 0.08);
          color: #fde68a;
          padding: 0.8rem 1rem;
          border-radius: 8px;
        }

        .warning-list p {
          margin: 0.2rem 0;
        }

        .result-details {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 1.5rem;
          margin-bottom: 2rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.03);
          font-size: 0.92rem;
        }

        .detail-label {
          color: #94a3b8;
          font-weight: 500;
        }

        .detail-value {
          color: #f1f5f9;
          font-weight: 600;
          font-family: monospace;
        }

        .action-row {
          display: flex;
          gap: 1.25rem;
        }

        .btn-action-primary {
          flex: 1;
          padding: 0.95rem;
          background: linear-gradient(135deg, var(--lawyer-accent) 0%, #2563eb 100%);
          color: white;
          text-align: center;
          font-weight: 700;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-action-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
        }

        .btn-action-secondary {
          flex: 1;
          padding: 0.95rem;
          background: #334155;
          color: white;
          text-align: center;
          font-weight: 700;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, background 0.2s;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .btn-action-secondary:hover {
          transform: translateY(-2px);
          background: #475569;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
