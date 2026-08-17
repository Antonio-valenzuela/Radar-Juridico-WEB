'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { UniversalLegalDocument, DocumentNode } from '@/lib/legal-engine/types';
import { runQualityGateCheck, QualityGateResult } from '@/lib/legal-engine/qualityGate';

interface WorkspaceDocumentEditorProps {
  document: UniversalLegalDocument | null;
  onUpdateDocument: (updated: UniversalLegalDocument) => void;
  onRegenerateSection?: (sectionId: string, instruction?: string) => Promise<void>;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  onSaveDraft?: () => Promise<boolean>;
  activeSectionId?: string | null;
  onSelectSection?: (section: DocumentNode) => void;
  onSelectTextHighlight?: (text: string) => void;
  isGenerating?: boolean;
  pipelineStageLabel?: string;
  onTriggerNewDraftModal?: () => void;
  onTriggerUpload?: () => void;
  onToggleLibrary?: () => void;
  onToggleAI?: () => void;
}

type SectionAction = 'regenerate' | 'expand' | 'reduce' | 'reformulate';

const SECTION_ACTION_LABELS: Record<SectionAction, { icon: string; label: string }> = {
  regenerate: { icon: '🔄', label: 'Regenerar' },
  expand: { icon: '➕', label: 'Ampliar' },
  reduce: { icon: '➖', label: 'Reducir' },
  reformulate: { icon: '✍️', label: 'Reformular' },
};

export function WorkspaceDocumentEditor({
  document,
  onUpdateDocument,
  onRegenerateSection,
  onExportDocx,
  onExportPdf,
  onSaveDraft,
  activeSectionId,
  onSelectSection,
  onSelectTextHighlight,
  isGenerating = false,
  pipelineStageLabel,
  onTriggerNewDraftModal,
  onTriggerUpload,
  onToggleLibrary,
  onToggleAI,
}: WorkspaceDocumentEditorProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [searchMatches, setSearchMatches] = useState<Array<{ page: number; sectionId: string }>>([]);
  const [editingBlock, setEditingBlock] = useState<{ sectionId: string; blockId: string; text: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const qualityGate: QualityGateResult | null = useMemo(() => {
    if (!document) return null;
    return runQualityGateCheck(document);
  }, [document]);

  // División realista por páginas Carta (1800 caracteres por hoja Carta)
  const CHARS_PER_PAGE = 1800;

  const pageBreakdown = useMemo(() => {
    if (!document || !document.sections || document.sections.length === 0) {
      return [{ pageNumber: 1, sections: [] as Array<{ section: DocumentNode; text: string }> }];
    }

    const pages: Array<{ pageNumber: number; sections: Array<{ section: DocumentNode; text: string }> }> = [];
    let currentPageNum = 1;
    let currentChars = 0;
    let currentSections: Array<{ section: DocumentNode; text: string }> = [];

    document.sections.forEach((sec) => {
      const secText = sec.content.map((b) => b.text).join('\n\n');
      const secLength = secText.length || 200;

      if (currentChars + secLength > CHARS_PER_PAGE && currentSections.length > 0) {
        pages.push({ pageNumber: currentPageNum, sections: currentSections });
        currentPageNum++;
        currentChars = 0;
        currentSections = [];
      }

      currentSections.push({ section: sec, text: secText });
      currentChars += secLength;
    });

    if (currentSections.length > 0) {
      pages.push({ pageNumber: currentPageNum, sections: currentSections });
    }

    return pages.length > 0 ? pages : [{ pageNumber: 1, sections: [] }];
  }, [document]);

  const totalPages = pageBreakdown.length;
  const activePageData = pageBreakdown.find((p) => p.pageNumber === currentPage) || pageBreakdown[0];

  // Map de página por sección
  const sectionPageMap = useMemo(() => {
    const map: Record<string, number> = {};
    pageBreakdown.forEach((p) => p.sections.forEach(({ section }) => (map[section.id] = p.pageNumber)));
    return map;
  }, [pageBreakdown]);

  // Actualizar búsqueda
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setActiveMatch(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches: Array<{ page: number; sectionId: string }> = [];
    pageBreakdown.forEach((p) => {
      p.sections.forEach(({ section, text }) => {
        if (text.toLowerCase().includes(q)) matches.push({ page: p.pageNumber, sectionId: section.id });
      });
    });
    setSearchMatches(matches);
    setActiveMatch(0);
    if (matches.length > 0) {
      setCurrentPage(matches[0].page);
    }
  }, [searchQuery, pageBreakdown]);

  const goToNextMatch = (dir: 1 | -1) => {
    if (searchMatches.length === 0) return;
    const next = (activeMatch + dir + searchMatches.length) % searchMatches.length;
    setActiveMatch(next);
    setCurrentPage(searchMatches[next].page);
  };

  const handleSave = async () => {
    if (!onSaveDraft) return;
    setSaveState('saving');
    const ok = await onSaveDraft();
    setSaveState(ok ? 'saved' : 'idle');
    if (ok) window.setTimeout(() => setSaveState('idle'), 3000);
  };

  const updateBlock = (sectionId: string, blockId: string, newText: string) => {
    if (!document) return;
    const updatedSections = document.sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      const content = sec.content.map((b) =>
        b.id === blockId
          ? { ...b, text: newText, isManuallyEdited: true, layer: 'USER_POSITION' as const, trustLevel: 'VERIFIED' as const }
          : b
      );
      return { ...sec, content, isManuallyEdited: true };
    });
    onUpdateDocument({ ...document, sections: updatedSections, updatedAt: new Date().toISOString() });
    setEditingBlock(null);
  };

  const runSectionAction = (action: SectionAction, section: DocumentNode) => {
    if (!onRegenerateSection) return;
    const title = section.title;
    const instructions: Record<SectionAction, string> = {
      regenerate: `Regenera por completo el apartado "${title}" con argumentos jurídicos extensos (hecho, norma, criterio, aplicación y conclusión).`,
      expand: `Amplía y desarrolla con mayor profundidad el apartado "${title}", incorporando fundamentos legales, doctrina y precedentes aplicables sin inventar datos.`,
      reduce: `Sintetiza el apartado "${title}" conservando los argumentos esenciales y la fundamentación jurídica.`,
      reformulate: `Reformula el apartado "${title}" con una redacción distinta, manteniendo íntegro el contenido jurídico y estilo del escrito.`,
    };
    void onRegenerateSection(section.id, instructions[action]);
  };

  const highlight = (text: string) => {
    if (!searchQuery.trim()) return text;
    const q = searchQuery.trim();
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-[#ffe4a0] text-slate-900 rounded-sm px-0.5 font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  /* ──────────────────────────────────────────────────────────────────────────
     ESTADO VACÍO (Sin documento generado)
  ────────────────────────────────────────────────────────────────────────── */
  if (!document && !isGenerating) {
    return (
      <main className="flex-1 min-w-0 bg-[#ede8dd] overflow-y-auto flex flex-col h-full select-none">
        {/* Barra superior vacía */}
        <div className="p-3.5 border-b border-[#ded8c9] bg-[#fbf9f5] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[13px] font-extrabold text-[#0B2545]">Documento</h2>
            <span className="text-[11px] text-slate-400">· Sin borrador activo</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onToggleLibrary && (
              <button
                onClick={onToggleLibrary}
                title="Biblioteca de Documentos"
                className="hidden max-[900px]:inline-flex w-7 h-7 items-center justify-center rounded-lg bg-white border border-[#ded8c9] text-slate-600 hover:bg-[#ede8dd] text-sm transition shrink-0"
              >
                📁
              </button>
            )}
            {onToggleAI && (
              <button
                onClick={onToggleAI}
                title="Panel Contextual IA"
                className="hidden max-[1199px]:inline-flex w-7 h-7 items-center justify-center rounded-lg bg-white border border-[#ded8c9] text-slate-600 hover:bg-[#ede8dd] text-sm transition shrink-0"
              >
                ✨
              </button>
            )}
            <button
              onClick={onTriggerNewDraftModal}
              className="py-1.5 px-3 rounded-xl bg-[#0B2545] text-white text-xs font-bold shadow-sm hover:bg-[#081d39] transition flex items-center gap-1"
            >
              <span>⚡ Redactar Nuevo Escrito</span>
            </button>
          </div>
        </div>

        {/* Centro: Card compacta de estado vacío */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#ded8c9] shadow-xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-[#f5f2eb] text-[#0B2545] text-2xl flex items-center justify-center mx-auto shadow-inner">
              📄
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-[#0B2545]">
                Sin documento en redacción
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Selecciona una plantilla de la biblioteca o sube el expediente del caso para redactar la contestación, amparo o recurso con la estructura formal del abogado.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={onTriggerUpload}
                className="py-2 px-3.5 rounded-xl bg-white border border-[#ded8c9] text-[#0B2545] hover:bg-[#f5f2eb] text-xs font-bold shadow-sm transition flex items-center gap-1.5"
              >
                <span>📥 Subir Expediente</span>
              </button>

              <button
                onClick={onTriggerNewDraftModal}
                className="py-2 px-4 rounded-xl bg-[#0B2545] text-white hover:bg-[#081d39] text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <span>⚡ Generar Estructura</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     ESTADO EN GENERACIÓN (Pipeline en tiempo real)
  ────────────────────────────────────────────────────────────────────────── */
  if (isGenerating && !document) {
    return (
      <main className="flex-1 min-w-0 bg-[#ede8dd] overflow-y-auto flex flex-col h-full select-none">
        <div className="p-3.5 border-b border-[#ded8c9] bg-[#fbf9f5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#0B2545] border-t-transparent animate-spin" />
            <h2 className="text-[13px] font-extrabold text-[#0B2545]">Redactando Documento Jurídico...</h2>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#ded8c9] shadow-xl p-8 space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0B2545] text-2xl flex items-center justify-center mx-auto animate-pulse">
              ⚖️
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-[#0B2545]">
                {pipelineStageLabel || 'Analizando expediente y redactando apartados...'}
              </h3>
              <p className="text-xs text-slate-500">
                Extrayendo hechos, fundamentación legal y criterios jurisprudenciales aplicables.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-[#fbf9f5] border border-[#ded8c9] flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Extracción de texto & OCR</span>
              </div>
              <div className="p-3 rounded-xl bg-[#fbf9f5] border border-[#ded8c9] flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Identificación de partes & autoridad</span>
              </div>
              <div className="p-3 rounded-xl bg-[#fbf9f5] border border-[#ded8c9] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0B2545] animate-ping" />
                <span className="font-bold text-[#0B2545]">Redacción por apartados</span>
              </div>
              <div className="p-3 rounded-xl bg-[#fbf9f5] border border-[#ded8c9] flex items-center gap-2 text-slate-400">
                <span>○</span>
                <span>Validación de coherencia & firma</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     ESTADO NORMAL: HOJA CARTA COMPLETA
  ────────────────────────────────────────────────────────────────────────── */
  return (
    <main className="flex-1 min-w-0 bg-[#ede8dd] overflow-y-auto flex flex-col h-full select-none relative">
      {/* ── TOOLBAR SUPERIOR DEL DOCUMENTO (Estilo Mockup) ────────────────── */}
      <div className="p-3 border-b border-[#ded8c9] bg-[#fbf9f5] flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h2 className="text-[13px] font-extrabold text-[#0B2545]">Documento</h2>

          {onToggleLibrary && (
            <button
              onClick={onToggleLibrary}
              title="Biblioteca de Documentos"
              className="hidden max-[900px]:inline-flex w-7 h-7 items-center justify-center rounded-lg bg-white border border-[#ded8c9] text-slate-600 hover:bg-[#ede8dd] text-sm transition shrink-0"
            >
              📁
            </button>
          )}
          {onToggleAI && (
            <button
              onClick={onToggleAI}
              title="Panel Contextual IA"
              className="hidden max-[1199px]:inline-flex w-7 h-7 items-center justify-center rounded-lg bg-white border border-[#ded8c9] text-slate-600 hover:bg-[#ede8dd] text-sm transition shrink-0"
            >
              ✨
            </button>
          )}

          {onTriggerNewDraftModal && (
            <button
              onClick={onTriggerNewDraftModal}
              className="py-1.5 px-3 rounded-xl bg-[#0B2545] text-white hover:bg-[#081d39] text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>Redactar Nuevo Escrito</span>
            </button>
          )}

          {/* Botones estilo mockup: Salvar, Revisar, Texto Final */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSave}
              disabled={saveState === 'saving' || !onSaveDraft}
              className="py-1.5 px-3 rounded-xl bg-white border border-[#ded8c9] hover:bg-[#ede8dd] text-[#0B2545] text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <span>💾</span>
              <span>{saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? '✓ Salvado' : 'Salvar'}</span>
            </button>

            <button
              onClick={() => setShowReviewModal(true)}
              className="py-1.5 px-3 rounded-xl bg-white border border-[#ded8c9] hover:bg-[#ede8dd] text-[#0B2545] text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <span>✓</span>
              <span>Revisar {qualityGate ? `(${qualityGate.qualityScore}/100)` : ''}</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="py-1.5 px-3 rounded-xl bg-white border border-[#ded8c9] hover:bg-[#ede8dd] text-[#0B2545] text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <span>📄</span>
                <span>Texto Final</span>
                <span className="text-[10px]">▼</span>
              </button>

              {showExportMenu && (
                <div className="absolute left-0 top-9 w-44 bg-white border border-[#ded8c9] rounded-xl shadow-xl z-50 py-1.5 text-xs text-slate-800 font-semibold animate-in fade-in zoom-in-95">
                  {onExportDocx && (
                    <button
                      onClick={() => {
                        onExportDocx();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-800"
                    >
                      <span>📄</span> Exportar DOCX
                    </button>
                  )}
                  {onExportPdf && (
                    <button
                      onClick={() => {
                        onExportPdf();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-800"
                    >
                      <span>🖨️</span> Exportar PDF Real
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controles de Navegación, Zoom y Búsqueda */}
        <div className="flex items-center gap-3 text-xs text-slate-600">
          {/* Paginación */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 bg-white hover:bg-slate-50 disabled:opacity-35 rounded-lg border border-[#ded8c9] flex items-center justify-center font-bold text-slate-700 shadow-xs"
            >
              ←
            </button>
            <span className="font-semibold text-slate-700 px-1">
              Página <span className="text-[#0B2545] font-extrabold">{currentPage}</span> de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-7 h-7 bg-white hover:bg-slate-50 disabled:opacity-35 rounded-lg border border-[#ded8c9] flex items-center justify-center font-bold text-slate-700 shadow-xs"
            >
              →
            </button>
          </div>

          {/* Zoom */}
          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-[#ded8c9]">
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
              className="w-6 h-6 bg-white border border-[#ded8c9] rounded-md font-bold text-xs"
            >
              −
            </button>
            <span className="font-mono text-[11px] font-bold text-[#0B2545] w-9 text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="w-6 h-6 bg-white border border-[#ded8c9] rounded-md font-bold text-xs"
            >
              +
            </button>
          </div>

          {/* Búsqueda en el documento */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-44 bg-white border border-[#ded8c9] rounded-xl pl-2.5 pr-14 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0B2545]"
            />
            {searchMatches.length > 0 && (
              <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#0B2545] bg-blue-50 px-1 rounded">
                {activeMatch + 1}/{searchMatches.length}
              </span>
            )}
            {searchMatches.length > 0 && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                <button onClick={() => goToNextMatch(1)} className="px-1 text-slate-500 hover:text-slate-800 text-[10px]">↓</button>
                <button onClick={() => goToNextMatch(-1)} className="px-1 text-slate-500 hover:text-slate-800 text-[10px]">↑</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CUERPO: HOJA CARTA REAL ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex justify-center items-start">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150"
        >
          {/* Hoja de papel Carta realista (816×1056px contenida) */}
          <div className="w-[816px] min-h-[1056px] max-w-full bg-white rounded shadow-2xl border border-slate-200/90 p-12 md:p-14 text-slate-900 font-serif leading-relaxed text-sm space-y-8 flex flex-col justify-between select-text">
            {/* Encabezado del documento */}
            <div className="space-y-6">
              {currentPage === 1 && (
                <div className="text-center space-y-3 pb-6 border-b border-slate-200">
                  <h1 className="text-lg font-bold text-[#0B2545] tracking-tight uppercase font-sans">
                    {document?.documentTypeLabel || 'ESCRITO JURÍDICO'}
                  </h1>
                  <p className="text-xs font-semibold text-slate-600 font-sans tracking-wide">
                    {document?.title || ''}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-600 font-sans pt-2">
                    <span className="font-bold">PRESENTE</span>
                    <span>
                      {document?.jurisdiction || 'Cd. de México'}, a {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              )}

              {/* Apartados de la página activa */}
              <div className="space-y-6">
                {activePageData?.sections.length === 0 ? (
                  <div className="py-24 text-center text-slate-400 italic text-xs font-sans">
                    Sin contenido en esta página.
                  </div>
                ) : (
                  activePageData.sections.map(({ section }) => {
                    const isActive = activeSectionId === section.id;
                    const isManuallyEdited = section.isManuallyEdited || section.content.some((b) => b.isManuallyEdited);

                    return (
                      <section
                        key={section.id}
                        onClick={() => onSelectSection?.(section)}
                        className={`group relative p-4 rounded-xl border transition space-y-2 ${
                          isActive
                            ? 'border-[#0B2545] bg-blue-50/20 shadow-xs'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50/40'
                        }`}
                      >
                        {/* Cabecera del apartado con acciones en hover */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 font-sans">
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-[#0B2545] text-xs uppercase tracking-wider">
                              {section.title}
                            </h3>
                            {isManuallyEdited && (
                              <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded bg-amber-100 text-amber-800 border border-amber-300">
                                Modificado
                              </span>
                            )}
                          </div>

                          {/* Botones de acción granular */}
                          <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                            {(Object.keys(SECTION_ACTION_LABELS) as SectionAction[]).map((action) => (
                              <button
                                key={action}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runSectionAction(action, section);
                                }}
                                disabled={isGenerating || !onRegenerateSection}
                                title={SECTION_ACTION_LABELS[action].label}
                                className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg shadow-xs disabled:opacity-40"
                              >
                                {SECTION_ACTION_LABELS[action].icon} {SECTION_ACTION_LABELS[action].label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Bloques de texto */}
                        <div className="space-y-3">
                          {section.content.map((block) => {
                            const isEditing = editingBlock?.blockId === block.id;

                            return (
                              <div
                                key={block.id}
                                className="group/block relative p-1.5 rounded-lg transition hover:bg-white"
                              >
                                {isEditing ? (
                                  <div className="space-y-2 font-sans" data-block-editor>
                                    <textarea
                                      rows={6}
                                      defaultValue={editingBlock.text}
                                      className="w-full p-3 bg-white border-2 border-[#0B2545] rounded-xl text-xs text-slate-900 focus:outline-none font-serif leading-relaxed"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingBlock(null);
                                        }}
                                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const ta = (e.currentTarget.closest('[data-block-editor]')?.querySelector('textarea')) as HTMLTextAreaElement | null;
                                          updateBlock(section.id, block.id, ta?.value ?? editingBlock.text);
                                        }}
                                        className="px-3 py-1 bg-[#0B2545] text-white hover:bg-[#081d39] text-xs font-bold rounded-lg shadow-sm"
                                      >
                                        Guardar cambios
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onMouseUp={() => {
                                      const sel = window.getSelection()?.toString().trim();
                                      if (sel && sel.length > 5 && onSelectTextHighlight) {
                                        onSelectTextHighlight(sel);
                                      }
                                    }}
                                    className="flex items-start justify-between gap-2"
                                  >
                                    <p className="font-serif leading-relaxed text-slate-800 text-[13px] whitespace-pre-wrap flex-1 text-justify">
                                      {highlight(block.text)}
                                    </p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingBlock({ sectionId: section.id, blockId: block.id, text: block.text });
                                      }}
                                      className="opacity-0 group-hover/block:opacity-100 p-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs rounded shadow-xs shrink-0"
                                      title="Editar este párrafo"
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pie de página Carta */}
            <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[11px] text-slate-400 font-sans tracking-wide">
              <span>PÁGINA {currentPage} DE {totalPages}</span>
              <span>PROTESTO LO NECESARIO EN DERECHO</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Validación / Calidad (Quality Gate) */}
      {showReviewModal && qualityGate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-[#0B2545]">
                Revisión de Calidad Jurídica
              </h3>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-sm">
                ✕
              </button>
            </div>

            <div className={`p-3 rounded-xl border font-bold flex items-center justify-between ${
              qualityGate.canMarkAsFinal
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <span>{qualityGate.canMarkAsFinal ? '✓ LISTO PARA FIRMA' : '⚠️ REQUIERE REVISIÓN'}</span>
              <span>Puntaje: {qualityGate.qualityScore}/100</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-sm font-extrabold text-[#0B2545]">{qualityGate.metrics.wordCount.toLocaleString()}</span>
                <span className="text-slate-400 uppercase font-bold text-[9px]">Palabras</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-sm font-extrabold text-[#0B2545]">{totalPages}</span>
                <span className="text-slate-400 uppercase font-bold text-[9px]">Páginas Carta</span>
              </div>
            </div>

            {qualityGate.warnings.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <p className="font-bold text-amber-700 uppercase text-[9px]">Advertencias:</p>
                {qualityGate.warnings.map((w, i) => (
                  <p key={i} className="p-1.5 rounded bg-amber-50 text-amber-900 text-[10px]">
                    • {w.message}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="py-1.5 px-4 rounded-xl bg-[#0B2545] text-white font-bold text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
