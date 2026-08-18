'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { CaseDocument, UploadedSourceDocument } from '../../../../lib/legal-engine/types';
import { reconstructCaseAnalysis, CaseAnalysis } from '../../../../lib/legal-engine/caseAnalysis';

interface CaseDocumentsReaderProps {
  documents: CaseDocument[];
  sourceDocs?: UploadedSourceDocument[];
  selectedDocId?: string | null;
  onSelectDocument: (doc: CaseDocument) => void;
  onUploadNewDocument?: () => void;
  onGenerateResponse?: (selectedText?: string) => void;
  onOpenEditor?: () => void;
}

export function CaseDocumentsReader({
  documents,
  sourceDocs = [],
  selectedDocId,
  onSelectDocument,
  onUploadNewDocument,
  onGenerateResponse,
  onOpenEditor,
}: CaseDocumentsReaderProps) {
  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const [activePage, setActivePage] = useState(1);
  const [selectedFragment, setSelectedFragment] = useState<string | null>(null);
  const [selectedAnalysisPill, setSelectedAnalysisPill] = useState<string>('prestaciones');
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'original' | 'structure'>('original');
  const [showSourcePanel, setShowSourcePanel] = useState(true);

  const totalPages = selectedDoc?.pageCount || selectedDoc?.pages?.length || 1;
  useEffect(() => {
    if (activePage > totalPages) {
      setActivePage(totalPages);
    }
  }, [totalPages, activePage]);

  const activePageObj = useMemo(() => {
    if (!selectedDoc || !selectedDoc.pages || selectedDoc.pages.length === 0) return null;
    return selectedDoc.pages.find((p) => p.page === activePage) || selectedDoc.pages[activePage - 1];
  }, [selectedDoc, activePage]);

  const activePageBlocks = useMemo(() => {
    return activePageObj?.blocks || [];
  }, [activePageObj]);

  // Reconstrucción del análisis del caso
  const caseAnalysis: CaseAnalysis = useMemo(() => {
    return reconstructCaseAnalysis(sourceDocs, selectedDoc?.name || '');
  }, [sourceDocs, selectedDoc]);

  // Contenido de la página actual
  const currentPageContent = useMemo(() => {
    if (!selectedDoc || !selectedDoc.pages || selectedDoc.pages.length === 0) {
      return 'No hay contenido disponible para esta foja.';
    }
    const pageObj = selectedDoc.pages.find((p) => p.page === activePage) || selectedDoc.pages[activePage - 1];
    return pageObj ? pageObj.text : 'Foja sin contenido.';
  }, [selectedDoc, activePage]);

  const paragraphs = useMemo(() => {
    return currentPageContent
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [currentPageContent]);

  const handleTextSelection = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 8) {
      setSelectedFragment(sel);
    }
  };

  const actor = caseAnalysis.parties?.actor || caseAnalysis.parties?.quejoso;
  const demandado = caseAnalysis.parties?.demandado || caseAnalysis.parties?.autoridadResponsable;
  const expediente =
    caseAnalysis.caseNumbers?.amparoDirecto ||
    caseAnalysis.caseNumbers?.principal ||
    caseAnalysis.caseNumbers?.expedienteOrigen;
  const juzgado = caseAnalysis.authorities?.[0];

  const analysisPills = [
    { id: 'prestaciones', label: 'Prestaciones reclamadas' },
    { id: 'hechos', label: 'Hechos relevantes' },
    { id: 'puntos', label: 'Puntos controvertidos' },
    { id: 'excepciones', label: 'Posibles excepciones' },
    { id: 'defensas', label: 'Defensas' },
    { id: 'pruebas', label: 'Pruebas necesarias' },
    { id: 'fundamentos', label: 'Fundamentos jurídicos' },
  ];

  return (
    <div className="machotes-contestaciones-root flex flex-col h-full w-full bg-[#f4f7f9] font-sans select-none overflow-hidden text-slate-900">
      <style>{`
        .machotes-contestaciones-root {
          --primary-color: #0B2545;
          --primary-hover: #081d39;
          --bg-slate: #f4f7f9;
          --border-slate: #e2e8f0;
          font-family: Inter, system-ui, -apple-system, sans-serif;
        }
        .contestaciones-header {
          background: #ffffff;
          border-bottom: 1px solid var(--border-slate);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .contestaciones-header-title {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .contestaciones-header-subtitle {
          margin: 2px 0 0;
          font-size: 12px;
          color: #64748b;
        }
        .contestaciones-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 20px;
          max-width: 1800px;
          width: 100%;
          margin: 0 auto;
          padding: 20px;
          align-items: start;
          flex: 1;
          overflow-y: auto;
        }
        .contestaciones-col-left {
          grid-column: span 6;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .contestaciones-col-right {
          grid-column: span 6;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .contestaciones-col-full {
          grid-column: span 12;
        }
        @media (max-width: 1100px) {
          .contestaciones-col-left, .contestaciones-col-right {
            grid-column: span 12;
          }
        }
        .contestaciones-card {
          background: #ffffff;
          border: 1px solid var(--border-slate);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .contestaciones-card-title {
          margin: 0;
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }
        .contestaciones-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 36px 16px;
          text-align: center;
          background: #f8fafc;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .contestaciones-dropzone:hover {
          border-color: var(--primary-color);
          background: #f1f5f9;
        }
        .doc-icon-container {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .doc-icon {
          padding: 3px 6px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 700;
          font-family: monospace;
          border: 1px solid;
        }
        .doc-icon.pdf { background: #fef2f2; color: #ef4444; border-color: #fca5a5; }
        .doc-icon.docx { background: #eff6ff; color: #3b82f6; border-color: #93c5fd; }
        .doc-icon.doc { background: #eff6ff; color: #2563eb; border-color: #93c5fd; }
        .doc-icon.txt { background: #f8fafc; color: #64748b; border-color: #cbd5e1; }
        .doc-icon.img { background: #ecfdf5; color: #10b981; border-color: #6ee7b7; }

        .contestaciones-badge-green {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
          border-radius: 9999px;
          padding: 2px 10px;
          font-size: 11px;
          font-weight: 700;
        }
        .contestaciones-badge-amber {
          background: #fef3c7;
          color: #d97706;
          border: 1px solid #fde68a;
          border-radius: 9999px;
          padding: 2px 10px;
          font-size: 11px;
          font-weight: 700;
        }
        .contestaciones-table {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
        }
        .contestaciones-pills-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .contestaciones-pill-btn {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #334155;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
        }
        .contestaciones-pill-btn:hover {
          background: #f1f5f9;
        }
        .contestaciones-pill-btn.is-active {
          background: #0F172A;
          color: #ffffff;
          border-color: #0F172A;
        }
        .contestaciones-btn-primary {
          background: #0B2545;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .contestaciones-btn-primary:hover {
          background: #081d39;
        }
        .contestaciones-btn-outline {
          background: #ffffff;
          color: #334155;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px 24px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          width: 100%;
          text-align: center;
        }
        .contestaciones-btn-outline:hover {
          background: #f8fafc;
        }
        .contestaciones-stepper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
          padding: 8px 4px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          overflow-x: auto;
          gap: 4px;
        }
        .stepper-item {
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .stepper-item.is-done {
          color: #166534;
          font-weight: 700;
        }
      `}</style>

      {/* ── ENCABEZADO SUPERIOR ── */}
      <header className="contestaciones-header">
        <div>
          <h1 className="contestaciones-header-title">Contestaciones</h1>
          <p className="contestaciones-header-subtitle">
            Analiza la demanda original y construye la contestación jurídicamente estructurada.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowSourcePanel((prev) => !prev)}
            className="contestaciones-btn-outline"
            style={{ padding: '8px 16px', fontSize: '12px', width: 'auto' }}
          >
            <span>☰</span> {showSourcePanel ? 'Ocultar documento' : 'Mostrar documento'}
          </button>
          {onUploadNewDocument && (
            <button
              onClick={onUploadNewDocument}
              className="contestaciones-btn-primary"
              style={{ padding: '8px 16px', fontSize: '12px', width: 'auto' }}
            >
              <span>+</span> Nueva contestación
            </button>
          )}
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL EN REJILLA ── */}
      <main className="contestaciones-grid">
        {/* COLUMNA IZQUIERDA: DOCUMENTO FUENTE */}
        {showSourcePanel && (
          <div className="contestaciones-col-left">
            <div className="contestaciones-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <h2 className="contestaciones-card-title">Documento fuente</h2>
                {selectedDoc && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'monospace' }}>
                    <button
                      onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                      disabled={activePage === 1}
                      style={{ padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: '#f8fafc' }}
                    >
                      ←
                    </button>
                    <span style={{ fontWeight: 700, color: '#0B2545' }}>
                      Pág. {activePage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      style={{ padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: '#f8fafc' }}
                    >
                      →
                    </button>
                  </div>
                )}
              </div>

              {!selectedDoc ? (
                /* DROPZONE PARA SUBIR DOCUMENTOS */
                <div
                  onClick={onUploadNewDocument}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); onUploadNewDocument?.(); }}
                  className="contestaciones-dropzone"
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ffffff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContents: 'center', fontSize: '18px', color: '#64748b', margin: '0 auto', justifyContent: 'center' }}>
                    ↑
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Arrastra aquí la demanda o documento
                  </p>
                  <div className="doc-icon-container">
                    <span className="doc-icon pdf">PDF</span>
                    <span className="doc-icon docx">DOCX</span>
                    <span className="doc-icon doc">DOC</span>
                    <span className="doc-icon txt">TXT</span>
                    <span className="doc-icon img">IMG</span>
                  </div>
                  <button
                    type="button"
                    className="contestaciones-btn-outline"
                    style={{ padding: '6px 12px', fontSize: '11px', width: 'auto' }}
                  >
                    [Seleccionar archivo]
                  </button>
                </div>
              ) : (
                /* VISOR DE DOCUMENTO RENDERIZADO */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedDoc.fileUrl && (selectedDoc.type?.toLowerCase().includes('pdf') || selectedDoc.name.toLowerCase().endsWith('.pdf')) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                      <span style={{ fontWeight: 700, color: '#475569' }}>Visualización:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setViewMode('original')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: viewMode === 'original' ? '#0B2545' : 'transparent',
                            color: viewMode === 'original' ? '#ffffff' : '#475569',
                          }}
                        >
                          📄 Documento Original (PDF)
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('structure')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: viewMode === 'structure' ? '#0B2545' : 'transparent',
                            color: viewMode === 'structure' ? '#ffffff' : '#475569',
                          }}
                        >
                          📑 Estructura
                        </button>
                      </div>
                    </div>
                  )}

                  {viewMode === 'original' && selectedDoc.fileUrl && (selectedDoc.type?.toLowerCase().includes('pdf') || selectedDoc.name.toLowerCase().endsWith('.pdf')) ? (
                    <div style={{ background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: '520px' }}>
                      <object
                        data={`${selectedDoc.fileUrl}#page=${activePage}&toolbar=0&navpanes=0`}
                        type="application/pdf"
                        className="w-full h-[520px] rounded-xl"
                        style={{ width: '100%', height: '520px', border: '0' }}
                      >
                        <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                          <p>Tu navegador no puede previsualizar este PDF directamente en línea.</p>
                          <a href={selectedDoc.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#0B2545', fontWeight: 700, textDecoration: 'underline' }}>
                            [Abrir documento en nueva pestaña]
                          </a>
                        </div>
                      </object>
                    </div>
                  ) : (
                    <div
                      onMouseUp={handleTextSelection}
                      style={{ background: '#f1f5f9', borderRadius: '12px', padding: '16px', maxHeight: '520px', overflowY: 'auto' }}
                    >
                      <div
                        style={{
                          fontFamily: 'Georgia, serif',
                          lineHeight: '1.6',
                          background: '#ffffff',
                          padding: '30px',
                          borderRadius: '8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          fontSize: '13px',
                          color: '#1e293b',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px', fontFamily: 'sans-serif' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{selectedDoc.name}</span>
                          <span>FOJA {activePage} DE {totalPages}</span>
                        </div>

                        {activePageBlocks.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activePageBlocks.map((block, bIdx) => {
                              if (block.type === 'Section-header' || block.type === 'header') {
                                return (
                                  <h3 key={block.id || bIdx} style={{ margin: '12px 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a', fontFamily: 'sans-serif' }}>
                                    {block.text}
                                  </h3>
                                );
                              }
                              if (block.type === 'Table' && block.tableData) {
                                return (
                                  <div key={block.id || bIdx} style={{ margin: '10px 0', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', fontFamily: 'sans-serif', fontSize: '11px' }}>
                                    {block.tableData.headers && (
                                      <div style={{ fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '4px', color: '#0B2545' }}>
                                        {block.tableData.headers.join(' | ')}
                                      </div>
                                    )}
                                    {block.tableData.rows?.map((row, rIdx) => (
                                      <div key={rIdx} style={{ padding: '3px 0', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                                        {row.join(' | ')}
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              if (block.type === 'Metadata') {
                                return (
                                  <div key={block.id || bIdx} style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', padding: '6px', borderRadius: '4px', margin: '4px 0', border: '1px solid #f1f5f9', fontFamily: 'sans-serif' }}>
                                    🔒 {block.text}
                                  </div>
                                );
                              }
                              return (
                                <p key={block.id || bIdx} style={{ margin: 0, textAlign: 'justify', textIndent: '20px' }}>
                                  {block.text}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {paragraphs.map((par, pIdx) => (
                              <p key={pIdx} style={{ margin: 0, textAlign: 'justify', textIndent: '20px' }}>
                                {par}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENTOS RECIENTES */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Documentos recientes</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '144px', overflowY: 'auto' }}>
                  {documents.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>No hay documentos cargados.</p>
                  ) : (
                    documents.map((doc) => {
                      const isSel = doc.id === selectedDoc?.id;
                      const isPdf = doc.type?.toLowerCase().includes('pdf') || doc.name.toLowerCase().endsWith('.pdf');

                      return (
                        <button
                          key={doc.id}
                          onClick={() => {
                            onSelectDocument(doc);
                            setActivePage(1);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: isSel ? '#eff6ff' : '#f8fafc',
                            borderColor: isSel ? '#bfdbfe' : '#e2e8f0',
                            color: isSel ? '#1e3a8a' : '#475569',
                            fontWeight: isSel ? 700 : 500,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span>{isPdf ? '📄' : '📝'}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {doc.pageCount} pág{doc.pageCount === 1 ? '' : 's'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COLUMNA DERECHA: ANÁLISIS Y ACCIONES */}
        <div className={showSourcePanel ? 'contestaciones-col-right' : 'contestaciones-col-full'}>
          <div className="contestaciones-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h2 className="contestaciones-card-title">Análisis de la demanda</h2>
              {selectedDoc && (
                <span className={selectedDoc.status === 'READY' ? 'contestaciones-badge-green' : 'contestaciones-badge-amber'}>
                  {selectedDoc.status === 'READY' ? 'Documento analizado ✓' : 'Revisión manual requerida'}
                </span>
              )}
            </div>

            {/* Metadatos Procesales */}
            <div className="contestaciones-table">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Partes</span>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    <span style={{ color: '#64748b' }}>Actor:</span> {actor || '—'}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                    <span style={{ color: '#64748b' }}>Demandado:</span> {demandado || '—'}
                  </p>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Expediente</span>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#0B2545' }}>
                    {expediente || 'e.g. 1234/2026'}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '9px', fontWeight: 600, display: 'block' }}>Prestaciones detectadas</span>
                  <strong style={{ fontSize: '16px', color: '#0B2545', display: 'block', marginTop: '2px' }}>
                    {caseAnalysis.claims.length || 0}
                  </strong>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '9px', fontWeight: 600, display: 'block' }}>Hechos detectados</span>
                  <strong style={{ fontSize: '16px', color: '#0B2545', display: 'block', marginTop: '2px' }}>
                    {caseAnalysis.proceduralTimeline.length || 0}
                  </strong>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '9px', fontWeight: 600, display: 'block' }}>Autoridad</span>
                  <strong style={{ fontSize: '11px', color: '#0B2545', display: 'block', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {juzgado || 'Juzgado ...'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Análisis jurídico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Análisis jurídico</span>
              <div className="contestaciones-pills-grid">
                {analysisPills.map((pill) => {
                  const isSelected = selectedAnalysisPill === pill.id;
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setSelectedAnalysisPill(pill.id)}
                      className={`contestaciones-pill-btn ${isSelected ? 'is-active' : ''}`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', fontSize: '12px', color: '#334155', minHeight: '100px' }}>
                <span style={{ color: '#0B2545', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                  {analysisPills.find(p => p.id === selectedAnalysisPill)?.label}
                </span>
                
                {selectedAnalysisPill === 'prestaciones' && (
                  <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {caseAnalysis.claims.length > 0 ? caseAnalysis.claims.join('\n\n') : 'No se detectaron prestaciones en el documento.'}
                  </p>
                )}
                {selectedAnalysisPill === 'hechos' && (
                  <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.5 }}>
                    {caseAnalysis.proceduralTimeline.length > 0 ? (
                      caseAnalysis.proceduralTimeline.map((ev, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>
                          <strong>{ev.date ? `${ev.date}: ` : ''}</strong>{ev.event}
                        </li>
                      ))
                    ) : (
                      <li>No se detectaron hechos relevantes.</li>
                    )}
                  </ul>
                )}
                {selectedAnalysisPill === 'puntos' && (
                  <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {caseAnalysis.proceduralPosture.constitutionalIssues.length > 0 
                      ? caseAnalysis.proceduralPosture.constitutionalIssues.map(issue => `${issue.title} · ${issue.parameter || ''}`).join('\n\n')
                      : 'No se detectaron puntos controvertidos.'}
                  </p>
                )}
                {selectedAnalysisPill === 'excepciones' && (
                  <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.5 }}>
                    {caseAnalysis.caseTheory?.vulnerabilities?.length > 0 ? (
                      caseAnalysis.caseTheory.vulnerabilities.map((v, i) => <li key={i} style={{ marginBottom: '4px' }}>{v}</li>)
                    ) : (
                      <li>No se detectaron excepciones procesales relevantes.</li>
                    )}
                  </ul>
                )}
                {selectedAnalysisPill === 'defensas' && (
                  <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {caseAnalysis.argumentAxes.length > 0 
                      ? caseAnalysis.argumentAxes.map(axis => `${axis.title}: ${axis.reasoning || axis.rebuttal}`).join('\n\n')
                      : 'No se definió estrategia de defensa.'}
                  </p>
                )}
                {selectedAnalysisPill === 'pruebas' && (
                  <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.5 }}>
                    {caseAnalysis.evidence.length > 0 ? (
                      caseAnalysis.evidence.map((ev, i) => <li key={i} style={{ marginBottom: '4px' }}>{ev.description}</li>)
                    ) : (
                      <li>No se especificaron pruebas necesarias en esta etapa.</li>
                    )}
                  </ul>
                )}
                {selectedAnalysisPill === 'fundamentos' && (
                  <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {caseAnalysis.citations.length > 0 
                      ? caseAnalysis.citations.map(c => `${c.rubro || ''} (Registro: ${c.registro || ''})`).join('\n\n')
                      : 'No se encontraron fundamentos o tesis aplicables.'}
                  </p>
                )}
              </div>
            </div>

            {/* Acción principal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>
              <button
                onClick={() => onGenerateResponse?.(selectedFragment || undefined)}
                disabled={!selectedDoc}
                className="contestaciones-btn-primary"
                style={{ opacity: !selectedDoc ? 0.5 : 1, cursor: !selectedDoc ? 'not-allowed' : 'pointer' }}
              >
                <span>⚡</span> Analizar y preparar contestación
              </button>

              {/* Stepper Pipeline */}
              <div className="contestaciones-stepper">
                {[
                  { label: 'Documento procesado', done: Boolean(selectedDoc && selectedDoc.status === 'READY') },
                  { label: 'Estructura identificada', done: Boolean(activePageBlocks.length > 0) },
                  { label: 'Análisis jurídico', done: caseAnalysis.claims.length > 0 },
                  { label: 'Generación', done: false },
                  { label: 'Validación', done: false },
                ].map((step, index) => (
                  <React.Fragment key={step.label}>
                    <div className={`stepper-item ${step.done ? 'is-done' : ''}`}>
                      <span>{step.done ? '✓' : '○'}</span>
                      <span>{step.label}</span>
                    </div>
                    {index < 4 && <span style={{ color: '#cbd5e1' }}>—</span>}
                  </React.Fragment>
                ))}
              </div>

              {onOpenEditor && (
                <button
                  onClick={onOpenEditor}
                  className="contestaciones-btn-outline"
                >
                  Continuar al editor jurídico
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}