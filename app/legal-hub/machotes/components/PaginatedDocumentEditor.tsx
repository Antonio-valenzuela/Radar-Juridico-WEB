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

  // Quality Gate Evaluation
  const qualityGate = useMemo(() => runQualityGateCheck(document), [document]);

  // Compute pages based on sections & character counts (~1800 chars per Letter page)
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
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl text-slate-900 font-sans">
      {/* ── Toolbar & Top Controls ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B2545] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            {activeMode === 'source' ? 'Modo Fuente (Inmutable)' : 'Modo Borrador (Editable)'}
          </span>
          <h2 className="text-sm font-extrabold truncate max-w-xs sm:max-w-md text-[#0B2545]">
            {document.title}
          </h2>
        </div>

        {/* Quality Status & Export Buttons */}
        <div className="flex items-center space-x-3">
          {!qualityGate.canMarkAsFinal ? (
            <div className="flex items-center space-x-2 bg-amber-50 border border-amber-300 px-3 py-1 rounded-full text-xs text-amber-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>REQUIERE REVISIÓN ({qualityGate.qualityScore}/100)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full text-xs text-emerald-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>VERIFICADO PARA FIRMA</span>
            </div>
          )}

          {onExportDocx && (
            <button onClick={onExportDocx} className="machote-btn-primary text-xs py-1.5 px-4">
              📄 Exportar DOCX
            </button>
          )}
          {onExportPdf && (
            <button onClick={onExportPdf} className="machote-btn-secondary text-xs py-1.5 px-4">
              🖨️ Imprimir / PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Secondary Navigation Bar: Page Controls & Zoom ─────────────────── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs text-slate-600">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-white hover:bg-slate-50 disabled:opacity-40 rounded-lg text-slate-700 font-semibold border border-slate-300 shadow-sm"
          >
            ← Anterior
          </button>
          <span className="font-medium text-slate-700">
            Página <span className="text-[#0B2545] font-extrabold">{currentPage}</span> de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-white hover:bg-slate-50 disabled:opacity-40 rounded-lg text-slate-700 font-semibold border border-slate-300 shadow-sm"
          >
            Siguiente →
          </button>

          <div className="flex items-center space-x-2 pl-4 border-l border-slate-300">
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
              className="w-12 px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-center font-bold"
            />
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-3">
          <input
            type="text"
            placeholder="Buscar en el documento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 px-3 py-1 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0B2545] shadow-sm"
          />
        </div>
      </div>

      {/* ── Page Workstation Canvas (Letter Paper Sheet) ───────────────────────── */}
      <div className="flex-1 bg-slate-100/90 p-8 overflow-y-auto flex justify-center">
        <div className="w-full max-w-[816px] bg-white shadow-2xl rounded-sm border border-slate-200/80 p-12 min-h-[1056px] text-slate-900 font-serif leading-relaxed text-sm space-y-8">
          {/* Header Marker */}
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center text-[11px] text-slate-400 font-sans tracking-wide">
            <span>JURÍDICO RADAR — MOTOR DE ELABORACIÓN JURÍDICA</span>
            <span>EXPEDIENTE: {document.caseRefs.expediente || '800/2024'}</span>
          </div>

          {activePageData?.sections.length === 0 ? (
            <div className="text-center py-20 text-slate-400 italic font-sans text-xs">
              No hay contenido redactado en esta página.
            </div>
          ) : (
            activePageData.sections.map(({ section, text }) => {
              const isEditing = editingSectionId === section.id;
              const isManuallyEdited = section.isManuallyEdited || section.content.some((b) => b.isManuallyEdited);

              return (
                <div
                  key={section.id}
                  className="group relative p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50/60 transition space-y-3 font-sans"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-extrabold text-[#0B2545] text-xs uppercase tracking-wider">
                        {section.title}
                      </h3>
                      {isManuallyEdited && (
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-100 text-amber-800 border border-amber-300">
                          Editado Manualmente
                        </span>
                      )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition flex items-center space-x-2">
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingSectionId(section.id);
                            setEditingText(text);
                          }}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg shadow-sm"
                        >
                          ✏️ Editar
                        </button>
                      )}
                      {onRegenerateSection && (
                        <button
                          onClick={() => onRegenerateSection(section.id, sectionInstruction)}
                          disabled={isGenerating}
                          className="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-[#0B2545] text-[11px] font-bold rounded-lg shadow-sm"
                        >
                          🔄 Regenerar
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        rows={8}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full p-3 bg-white border border-[#0B2545] rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 font-serif leading-relaxed"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingSectionId(null)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSaveSectionEdit(section.id)}
                          className="machote-btn-primary text-xs py-1.5 px-4"
                        >
                          Guardar Cambios
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="font-serif leading-relaxed whitespace-pre-wrap text-slate-800 text-sm">
                      {text}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Footer Marker */}
          <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-[11px] text-slate-400 font-sans tracking-wide">
            <span>PÁGINA {currentPage} DE {totalPages}</span>
            <span>PROTESTO LO NECESARIO EN DERECHO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
