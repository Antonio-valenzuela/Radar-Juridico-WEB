'use client';

import React, { useState, useMemo } from 'react';
import { UniversalLegalDocument, DocumentNode, ContentBlock, CaseDocument } from '../../../../lib/legal-engine/types';
import { runQualityGateCheck } from '../../../../lib/legal-engine/qualityGate';

interface PaginatedDocumentEditorProps {
  document: UniversalLegalDocument;
  onUpdateDocument: (updated: UniversalLegalDocument) => void;
  onRegenerateSection?: (sectionId: string, instruction?: string) => Promise<void>;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  caseDocuments?: CaseDocument[];
  activeMode?: 'draft' | 'source';
  onSelectCaseDocument?: (doc: CaseDocument) => void;
  selectedSourceDoc?: CaseDocument | null;
  isGenerating?: boolean;
}

export function PaginatedDocumentEditor({
  document,
  onUpdateDocument,
  onRegenerateSection,
  onExportDocx,
  onExportPdf,
  caseDocuments = [],
  activeMode = 'draft',
  onSelectCaseDocument,
  selectedSourceDoc,
  isGenerating = false,
}: PaginatedDocumentEditorProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [sectionInstruction, setSectionInstruction] = useState('');

  // Run Quality Gate Check
  const qualityGate = useMemo(() => runQualityGateCheck(document), [document]);

  // Compute pages based on sections & character counts (approx 1800 chars per Letter page)
  const CHARS_PER_PAGE = 1800;

  const pageBreakdown = useMemo(() => {
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
  }, [document.sections]);

  const totalPages = pageBreakdown.length;
  const activePageData = pageBreakdown.find((p) => p.pageNumber === currentPage) || pageBreakdown[0];

  // Handle section edit save
  const handleSaveSectionEdit = (sectionId: string) => {
    const updatedSections = document.sections.map((sec) => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          isManuallyEdited: true,
          content: [
            {
              id: sec.content[0]?.id || crypto.randomUUID(),
              layer: 'USER_POSITION' as const,
              trustLevel: 'VERIFIED' as const,
              text: editingText,
              isManuallyEdited: true,
            },
          ],
        };
      }
      return sec;
    });

    onUpdateDocument({
      ...document,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
    });

    setEditingSectionId(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* ── Toolbar & Top Controls ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-800/60">
            {activeMode === 'source' ? 'Modo Fuente (Solo Lectura)' : 'Modo Borrador (Editable)'}
          </span>
          <h2 className="text-sm font-semibold truncate max-w-xs sm:max-w-md text-slate-200">
            {document.title}
          </h2>
        </div>

        {/* Quality Status Badge */}
        <div className="flex items-center space-x-3">
          {!qualityGate.canMarkAsFinal ? (
            <div className="flex items-center space-x-2 bg-red-950/80 border border-red-800 px-3 py-1 rounded-md text-xs text-red-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span>REQUIERE REVISIÓN (Puntaje: {qualityGate.qualityScore}/100)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-md text-xs text-emerald-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>DOCUMENTO VERIFICADO PARA FIRMA</span>
            </div>
          )}

          {/* Action buttons */}
          {onExportDocx && (
            <button
              onClick={onExportDocx}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition shadow"
            >
              Exportar DOCX
            </button>
          )}
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md border border-slate-700 transition"
            >
              Imprimir / PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Secondary Controls: Page Navigation & Zoom ──────────────────────── */}
      <div className="flex items-center justify-between px-6 py-2 bg-slate-900/80 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-200 font-medium"
          >
            ← Anterior
          </button>
          <span className="font-medium text-slate-300">
            Página <span className="text-amber-400 font-bold">{currentPage}</span> de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-200 font-medium"
          >
            Siguiente →
          </button>

          <div className="flex items-center space-x-1.5 pl-4 border-l border-slate-800">
            <span>Ir a página:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-12 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-200 text-center"
            />
          </div>
        </div>

        {/* Search & Zoom */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar en el escrito..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold"
            >
              -
            </button>
            <span className="w-12 text-center font-mono">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Body: Thumbnail Sidebar + Page Canvas ─────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Page Thumbnail Sidebar */}
        <div className="w-48 bg-slate-900/90 border-r border-slate-800 p-3 overflow-y-auto hidden md:block">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Páginas ({totalPages})
          </h3>
          <div className="space-y-3">
            {pageBreakdown.map((p) => {
              const isSelected = p.pageNumber === currentPage;
              return (
                <button
                  key={p.pageNumber}
                  onClick={() => setCurrentPage(p.pageNumber)}
                  className={`w-full text-left p-2.5 rounded-lg border transition ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <span>Página {p.pageNumber}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                  </div>
                  <div className="text-[10px] text-slate-500 line-clamp-2 italic">
                    {p.sections[0]?.section.title || 'Sección'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Canvas: Letter Page Editor */}
        <div className="flex-1 bg-slate-950 p-6 overflow-y-auto flex justify-center">
          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className="w-full max-w-[8.5in] min-h-[11in] bg-slate-900 border border-slate-700 shadow-2xl rounded-sm p-12 text-slate-100 flex flex-col justify-between"
          >
            {/* Header Margin */}
            <div className="border-b border-slate-800/80 pb-3 mb-6 flex justify-between text-[11px] text-slate-400 tracking-wide">
              <span>{document.title}</span>
              <span className="uppercase font-semibold tracking-wider text-amber-500">{document.documentTypeLabel}</span>
            </div>

            {/* Page Content */}
            <div className="flex-1 space-y-8">
              {activePageData?.sections.map(({ section, text }) => {
                const isEditing = editingSectionId === section.id;
                const isManuallyEdited = section.isManuallyEdited || section.content[0]?.isManuallyEdited;

                return (
                  <div
                    key={section.id}
                    className={`group relative p-4 rounded-lg border transition ${
                      isEditing
                        ? 'border-amber-500 bg-slate-950'
                        : isManuallyEdited
                        ? 'border-emerald-800/60 bg-emerald-950/10'
                        : 'border-slate-800/60 hover:border-slate-700 bg-slate-900/50'
                    }`}
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                          {section.title}
                        </h4>
                        {isManuallyEdited && (
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                            Editado manualmente
                          </span>
                        )}
                      </div>

                      {/* Section Tools */}
                      {activeMode === 'draft' && (
                        <div className="flex items-center space-x-2 opacity-90 group-hover:opacity-100 transition">
                          {!isEditing ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingSectionId(section.id);
                                  setEditingText(text);
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded border border-slate-700"
                              >
                                Editar
                              </button>
                              {onRegenerateSection && (
                                <button
                                  onClick={() => onRegenerateSection(section.id)}
                                  disabled={isGenerating}
                                  className="px-2 py-1 bg-amber-950/80 hover:bg-amber-900 text-xs text-amber-200 rounded border border-amber-800 disabled:opacity-50"
                                >
                                  Regenerar
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleSaveSectionEdit(section.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditingSectionId(null)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section Body */}
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          rows={10}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full p-3 bg-slate-950 border border-amber-500/80 rounded font-serif text-sm leading-relaxed text-slate-100 focus:outline-none"
                        />
                        {onRegenerateSection && (
                          <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                            <input
                              type="text"
                              placeholder="Instrucción específica para esta sección (opcional)..."
                              value={sectionInstruction}
                              onChange={(e) => setSectionInstruction(e.target.value)}
                              className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                            />
                            <button
                              onClick={async () => {
                                await onRegenerateSection(section.id, sectionInstruction);
                                setEditingSectionId(null);
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded"
                            >
                              Reformular con IA
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
                        {text || <span className="italic text-slate-500">[Sección vacía]</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Margin */}
            <div className="border-t border-slate-800/80 pt-4 mt-8 flex items-center justify-between text-[11px] text-slate-500">
              <span>Jurisprudencia & Estrategia Radar</span>
              <span>Página {currentPage} de {totalPages}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
