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
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedFragment, setSelectedFragment] = useState<string | null>(null);
  const [selectedAnalysisPill, setSelectedAnalysisPill] = useState<string>('prestaciones');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = selectedDoc?.pageCount || selectedDoc?.pages?.length || 1;
  useEffect(() => {
    if (activePage > totalPages) {
      setActivePage(totalPages);
    }
  }, [totalPages, activePage]);

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

  const actor = caseAnalysis.parties?.find((p) => p.role.toLowerCase().includes('actor') || p.role.toLowerCase().includes('quejoso'))?.name || 'Quejoso / Actor';
  const demandado = caseAnalysis.parties?.find((p) => p.role.toLowerCase().includes('demandado') || p.role.toLowerCase().includes('responsable'))?.name || 'Autoridad / Demandado';
  const expediente = caseAnalysis.caseRefs?.expediente || '800/2024';
  const autoridad = caseAnalysis.caseRefs?.tribunal || 'Tribunal Colegiado de Circuito';

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f7f9] font-sans select-none overflow-hidden text-slate-900">
      {/* ── ENCABEZADO SUPERIOR SEGÚN REFERENCIA VISUAL ───────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Contestaciones
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Analiza una demanda y construye una contestación jurídicamente estructurada.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onUploadNewDocument && (
            <button
              onClick={onUploadNewDocument}
              className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Nueva contestación</span>
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL: DOS COLUMNAS ESTRUCTURADAS (REFERENCIA VISUAL) ── */}
      <div className="flex-1 overflow-auto p-5 md:p-6 min-h-0 min-w-0">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ── COLUMNA IZQUIERDA: DOCUMENTO FUENTE ───────────────────────────── */}
          <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Documento fuente
              </h2>
              {selectedDoc && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold flex items-center justify-center"
                  >
                    ←
                  </button>
                  <span className="font-bold text-[#0B2545]">
                    Pág. {activePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))}
                    disabled={activePage === totalPages}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold flex items-center justify-center"
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {/* Zona de Carga / Drag & Drop */}
            {!selectedDoc ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); onUploadNewDocument?.(); }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition flex flex-col items-center justify-center space-y-3 ${
                  isDragging ? 'border-[#0B2545] bg-blue-50/50' : 'border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-lg shadow-2xs">
                  ↑
                </div>
                <p className="text-xs text-slate-600 font-semibold">
                  Arrastra aquí la demanda o documento
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                  <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-bold">PDF</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-bold">DOCX</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-bold">DOC</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold">TXT</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold">IMG</span>
                </div>
                <button
                  type="button"
                  onClick={onUploadNewDocument}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
                >
                  [Seleccionar archivo]
                </button>
              </div>
            ) : (
              /* Visor 1:1 Inmutable de Foja Carta */
              <div
                onMouseUp={handleTextSelection}
                className="bg-[#f2efe9] rounded-xl p-4 flex items-center justify-center overflow-auto max-h-[520px]"
              >
                <div
                  style={{
                    fontFamily: 'Times New Roman, Times, "Liberation Serif", serif',
                    lineHeight: '1.6',
                  }}
                  className="w-full bg-white shadow-md p-8 md:p-10 text-slate-900 text-[12.5px] rounded-lg select-text min-h-[480px] flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono border-b border-slate-200 pb-1.5 font-sans">
                      <span className="truncate max-w-[200px]">{selectedDoc.name}</span>
                      <span>FOJA {activePage} DE {totalPages}</span>
                    </div>

                    <div className="space-y-2 text-justify">
                      {paragraphs.map((par, pIdx) => (
                        <p key={pIdx} className="leading-relaxed whitespace-pre-wrap">
                          {par}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono font-sans mt-4">
                    <span>DOCUMENTO FUENTE INMUTABLE</span>
                    <span className="font-bold text-[#0B2545]">PÁGINA {activePage}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Documentos Recientes */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block">Documentos recientes</span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {documents.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No hay documentos cargados.</p>
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
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition border ${
                          isSel
                            ? 'bg-blue-50/70 border-blue-200 text-[#0B2545] font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm">{isPdf ? '📄' : '📝'}</span>
                          <span className="truncate">{doc.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {doc.pageCount} pág{doc.pageCount === 1 ? '' : 's'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── COLUMNA DERECHA: ANÁLISIS DE LA DEMANDA (REFERENCIA VISUAL) ─────── */}
          <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Análisis de la demanda
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                <span>Documento analizado</span>
                <span>✓</span>
              </span>
            </div>

            {/* Metadatos Procesales */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Partes</span>
                <p className="text-slate-800 font-semibold truncate"><span className="text-slate-500">Actor:</span> {actor}</p>
                <p className="text-slate-800 font-semibold truncate"><span className="text-slate-500">Demandado:</span> {demandado}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Expediente</span>
                <p className="text-slate-800 font-bold font-mono">{expediente}</p>
                <p className="text-[11px] text-slate-600 truncate">{autoridad}</p>
              </div>
            </div>

            {/* Píldoras de Análisis Jurídico */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Análisis jurídico</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'prestaciones', label: 'Prestaciones reclamadas' },
                  { id: 'hechos', label: 'Hechos relevantes' },
                  { id: 'puntos', label: 'Puntos controvertidos' },
                  { id: 'excepciones', label: 'Posibles excepciones' },
                  { id: 'defensas', label: 'Defensas' },
                  { id: 'pruebas', label: 'Pruebas necesarias' },
                  { id: 'fundamentos', label: 'Fundamentos jurídicos' },
                ].map((pill) => {
                  const isSelected = selectedAnalysisPill === pill.id;
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setSelectedAnalysisPill(pill.id)}
                      className={`px-3 py-2 rounded-xl text-left font-medium transition border text-[11px] ${
                        isSelected
                          ? 'bg-[#0B2545] text-white border-[#0B2545] font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detalle del Análisis Seleccionado */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
              <span className="font-bold text-[#0B2545] text-[11px] uppercase tracking-wider block">
                {selectedAnalysisPill === 'prestaciones' && 'Prestaciones Reclamadas'}
                {selectedAnalysisPill === 'hechos' && 'Hechos Relevantes'}
                {selectedAnalysisPill === 'puntos' && 'Puntos Controvertidos'}
                {selectedAnalysisPill === 'excepciones' && 'Posibles Excepciones y Defensas'}
                {selectedAnalysisPill === 'defensas' && 'Estrategia de Defensa'}
                {selectedAnalysisPill === 'pruebas' && 'Pruebas Necesarias'}
                {selectedAnalysisPill === 'fundamentos' && 'Fundamentos y Precedentes'}
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {selectedAnalysisPill === 'prestaciones' && (caseAnalysis.proceduralPosture.claimedRights?.[0] || 'Se reclama la nulidad/revocación de la resolución impugnada y restitución de derechos.')}
                {selectedAnalysisPill === 'hechos' && 'Narración cronológica analizada foja por foja en el expediente oficial.'}
                {selectedAnalysisPill === 'puntos' && (caseAnalysis.proceduralPosture.constitutionalIssues?.[0]?.issue || 'Litis fijada sobre la legalidad del procedimiento y debido proceso.')}
                {selectedAnalysisPill === 'excepciones' && 'Falta de acción y derecho, prescripción, e improcedencia de la vía.'}
                {selectedAnalysisPill === 'defensas' && (caseAnalysis.argumentAxes?.[0]?.proposedResponse || 'Desvirtuar la pretensión con base en constancias fehacientes.')}
                {selectedAnalysisPill === 'pruebas' && 'Documental pública de actuaciones, instrumental y presuncional legal y humana.'}
                {selectedAnalysisPill === 'fundamentos' && (caseAnalysis.proceduralPosture.constitutionalIssues?.[0]?.parameter || 'Artículos 14, 16 y 17 Constitucionales.')}
              </p>
            </div>

            {/* Botón Principal y Stepper */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => onGenerateResponse?.(selectedFragment || undefined)}
                className="w-full py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-extrabold shadow-xs transition flex items-center justify-center gap-2"
              >
                <span>⚡</span>
                <span>Analizar y preparar contestación</span>
              </button>

              {/* Stepper de Progreso según Referencia */}
              <div className="flex items-center justify-between text-[9px] text-slate-500 font-medium px-1 overflow-x-auto">
                <span className="text-emerald-700 font-bold">✓ Documento procesado</span>
                <span className="text-emerald-700 font-bold">✓ Estructura identificada</span>
                <span className="text-[#0B2545] font-bold">● Análisis jurídico</span>
                <span className="text-slate-400">○ Generación</span>
                <span className="text-slate-400">○ Validación</span>
              </div>

              {onOpenEditor && (
                <button
                  onClick={onOpenEditor}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition"
                >
                  Continuar al editor jurídico
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
