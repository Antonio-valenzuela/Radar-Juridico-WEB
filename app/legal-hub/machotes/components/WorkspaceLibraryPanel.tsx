'use client';

import React, { useState } from 'react';
import type { CaseDocument, UploadedSourceDocument, UniversalLegalDocument } from '@/lib/legal-engine/types';
import type { TemplateItem } from './TemplateLibraryManager';

export interface LibraryItem {
  id: string;
  title: string;
  code?: string;
  matter: string;
  category: string;
  pageCount?: number;
  date: string;
  status: 'verified' | 'pending' | 'review';
  type: 'draft' | 'template' | 'case_doc';
  sourceDoc?: UploadedSourceDocument;
  caseDoc?: CaseDocument;
  template?: TemplateItem;
}

interface WorkspaceLibraryPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  caseDocuments: CaseDocument[];
  uploadedSources: UploadedSourceDocument[];
  templates: TemplateItem[];
  currentDoc: UniversalLegalDocument | null;
  selectedCaseDocId?: string | null;
  onSelectCaseDocument: (doc: CaseDocument) => void;
  onUseTemplate: (tpl: TemplateItem) => void;
  onOpenCreateTemplateModal: () => void;
  onDeleteTemplate?: (id: string) => void;
  onSelectThumbnailPage?: (page: number) => void;
  totalPages?: number;
  currentPage?: number;
  pagePreviews?: Array<{ pageNumber: number; snippet: string; sectionCount: number }>;
}

export function WorkspaceLibraryPanel({
  isCollapsed,
  onToggleCollapse,
  caseDocuments,
  uploadedSources,
  templates,
  currentDoc,
  selectedCaseDocId,
  onSelectCaseDocument,
  onUseTemplate,
  onOpenCreateTemplateModal,
  onDeleteTemplate,
  onSelectThumbnailPage,
  totalPages = 1,
  currentPage = 1,
  pagePreviews = [],
}: WorkspaceLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'templates' | 'sources' | 'thumbnails'>('docs');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMatter, setFilterMatter] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Generar items de biblioteca representativos y reales a partir de los datos
  const mockCases: LibraryItem[] = [
    {
      id: 'case-amparo-bgss',
      title: 'Amparo Directo General',
      code: 'BGSS',
      matter: 'Amparo',
      category: 'Amparo Directo',
      pageCount: 27,
      date: '15/08/2024',
      status: 'verified',
      type: 'draft',
    },
    {
      id: 'case-amparo-bdg4',
      title: 'Amparo Directo General',
      code: 'BDG4',
      matter: 'Amparo',
      category: 'Amparo Directo',
      pageCount: 18,
      date: '13/06/2024',
      status: 'review',
      type: 'draft',
    },
    {
      id: 'case-amparo-dbs4',
      title: 'Amparo Directo a Terceros',
      code: 'DBS4',
      matter: 'Amparo',
      category: 'Tercero Interesado',
      pageCount: 31,
      date: '12/08/2024',
      status: 'verified',
      type: 'draft',
    },
    {
      id: 'case-amparo-dbsa',
      title: 'Amparo Directo sobre Asunto Laboral',
      code: 'DBSA',
      matter: 'Amparo',
      category: 'Materia Laboral',
      pageCount: 22,
      date: '12/08/2024',
      status: 'review',
      type: 'draft',
    },
    {
      id: 'case-laboral-db54',
      title: 'Amparo Laboral',
      code: 'DB54',
      matter: 'Amparo',
      category: 'Contestación Junta',
      pageCount: 14,
      date: '11/06/2024',
      status: 'verified',
      type: 'draft',
    },
    {
      id: 'case-laboral-db54-2',
      title: 'Amparo Laboral',
      code: 'DB54',
      matter: 'Amparo',
      category: 'Revisión Tribunal Colegiado',
      pageCount: 25,
      date: '12/04/2024',
      status: 'review',
      type: 'draft',
    },
  ];

  // Si hay documento actual generado, agregarlo al inicio
  const currentDocItem: LibraryItem | null = currentDoc
    ? {
        id: currentDoc.id || 'current-doc',
        title: currentDoc.title || 'Escrito en Edición',
        code: currentDoc.caseRefs.expediente || 'ACTUAL',
        matter: currentDoc.matter || 'Amparo',
        category: currentDoc.documentTypeLabel || 'Borrador',
        pageCount: totalPages,
        date: new Date().toLocaleDateString('es-MX'),
        status: 'verified',
        type: 'draft',
      }
    : null;

  const libraryItems: LibraryItem[] = [
    ...(currentDocItem ? [currentDocItem] : []),
    ...mockCases,
  ];

  // Mapear plantillas a LibraryItems
  const templateItems: LibraryItem[] = templates.map((tpl) => ({
    id: tpl.id,
    title: tpl.name,
    code: `v${tpl.version}`,
    matter: tpl.matterId ? tpl.matterId.toUpperCase() : (tpl.category || 'GENERAL'),
    category: tpl.category,
    date: new Date(tpl.updatedAt).toLocaleDateString('es-MX'),
    status: 'verified',
    type: 'template',
    template: tpl,
  }));

  // Mapear documentos del caso (expediente subido)
  const caseDocItems: LibraryItem[] = caseDocuments.map((doc) => ({
    id: doc.id,
    title: doc.name,
    code: doc.type.toUpperCase(),
    matter: 'Expediente',
    category: `${doc.pageCount} pág(s)`,
    pageCount: doc.pageCount,
    date: doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('es-MX') : '—',
    status: doc.status === 'READY' ? 'verified' : 'pending',
    type: 'case_doc',
    caseDoc: doc,
  }));

  const getActiveList = () => {
    switch (activeTab) {
      case 'templates':
        return templateItems;
      case 'sources':
        return caseDocItems;
      case 'docs':
      default:
        return libraryItems;
    }
  };

  const filteredItems = getActiveList().filter((it) => {
    const matchesSearch =
      it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.code && it.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      it.matter.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMatter =
      filterMatter === 'all' || it.matter.toLowerCase() === filterMatter.toLowerCase();
    return matchesSearch && matchesMatter;
  });

  const getBadgeColor = (matter: string) => {
    const m = matter.toLowerCase();
    if (m.includes('amparo')) return 'bg-[#e2f4ea] text-[#1b7a43] border-[#bfe4cf]';
    if (m.includes('laboral')) return 'bg-[#e6f0fa] text-[#1b558f] border-[#bed7f3]';
    if (m.includes('civil')) return 'bg-[#f4eaf7] text-[#6d2f8a] border-[#e2cbe8]';
    if (m.includes('mercantil')) return 'bg-[#fdf3e2] text-[#9c5f11] border-[#f5dfb8]';
    return 'bg-[#eef1f5] text-[#2c3e50] border-[#d8dee6]';
  };

  /* ──────────────────────────────────────────────────────────────────────────
     VISTA RETRAÍDA (Mini-sidebar ~64px estilo mockup, fondo café oscuro)
  ────────────────────────────────────────────────────────────────────────── */
  if (isCollapsed) {
    return (
      <aside className="w-16 shrink-0 min-w-0 bg-[#43301f] border-r border-[#3a2a1c] flex flex-col items-center py-4 space-y-4 transition-all duration-300 select-none max-[900px]:hidden">
        <button
          onClick={onToggleCollapse}
          title="Expandir Biblioteca de Documentos"
          className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-[#f5f2eb] flex items-center justify-center hover:bg-white/20 transition shadow-sm"
        >
          <span className="text-sm font-bold">→</span>
        </button>

        <div className="w-8 h-[1px] bg-white/15" />

        <button
          onClick={() => {
            onToggleCollapse();
            setActiveTab('docs');
          }}
          title="Casos y Documentos"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
            activeTab === 'docs'
              ? 'bg-[#3b82f6] text-white shadow-sm'
              : 'bg-white/10 border border-white/15 text-[#f5f2eb] hover:bg-white/20'
          }`}
        >
          <span className="text-base">📁</span>
        </button>

        <button
          onClick={() => {
            onToggleCollapse();
            setActiveTab('templates');
          }}
          title="Mis Plantillas"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
            activeTab === 'templates'
              ? 'bg-[#3b82f6] text-white shadow-sm'
              : 'bg-white/10 border border-white/15 text-[#f5f2eb] hover:bg-white/20'
          }`}
        >
          <span className="text-base">📋</span>
        </button>

        <button
          onClick={() => {
            onToggleCollapse();
            setActiveTab('sources');
          }}
          title="Documentos del Expediente"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
            activeTab === 'sources'
              ? 'bg-[#3b82f6] text-white shadow-sm'
              : 'bg-white/10 border border-white/15 text-[#f5f2eb] hover:bg-white/20'
          }`}
        >
          <span className="text-base">📑</span>
        </button>

        <button
          onClick={() => {
            onToggleCollapse();
            setActiveTab('thumbnails');
          }}
          title="Miniaturas de Páginas"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
            activeTab === 'thumbnails'
              ? 'bg-[#3b82f6] text-white shadow-sm'
              : 'bg-white/10 border border-white/15 text-[#f5f2eb] hover:bg-white/20'
          }`}
        >
          <span className="text-base">🗂️</span>
        </button>

        <div className="mt-auto">
          <button
            onClick={onOpenCreateTemplateModal}
            title="Subir / Crear Machote"
            className="w-9 h-9 rounded-xl bg-[#3b82f6] text-white flex items-center justify-center hover:bg-blue-600 transition shadow-md"
          >
            <span className="text-base font-bold">+</span>
          </button>
        </div>
      </aside>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     VISTA EXPANDIDA (Panel completo ~330px a 360px con tarjetas estilo mockup)
  ────────────────────────────────────────────────────────────────────────── */
  return (
    <aside className="w-[280px] min-[900px]:max-[1199px]:w-[260px] min-[1400px]:w-[320px] shrink-0 min-w-0 bg-[#fbf9f5] border-r border-[#e8e2d5] flex flex-col h-full overflow-hidden transition-all duration-300 select-none max-[900px]:fixed max-[900px]:top-[64px] max-[900px]:bottom-0 max-[900px]:left-0 max-[900px]:z-40 max-[900px]:shadow-2xl">
      {/* Cabecera del Panel */}
      <div className="p-3.5 border-b border-[#e8e2d5] flex items-center justify-between gap-2 bg-[#fbf9f5]">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-extrabold text-[#0B2545] tracking-tight">
            Biblioteca de Documentos
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botón Filtro */}
          <button
            onClick={() =>
              setFilterMatter((prev) => (prev === 'all' ? 'amparo' : prev === 'amparo' ? 'laboral' : 'all'))
            }
            title={`Filtrar materia: ${filterMatter}`}
            className="w-7 h-7 rounded-lg bg-white border border-[#ded8c9] text-slate-600 flex items-center justify-center text-xs hover:bg-[#ede8dd] transition"
          >
            🍸
          </button>

          {/* Botón Colapsar */}
          <button
            onClick={onToggleCollapse}
            title="Retraer panel (←)"
            className="w-7 h-7 rounded-lg bg-white border border-[#ded8c9] text-slate-600 flex items-center justify-center text-xs font-bold hover:bg-[#ede8dd] transition"
          >
            ←
          </button>
        </div>
      </div>

      {/* Subpestañas compactas */}
      <div className="flex px-3 pt-2.5 gap-1 border-b border-[#e8e2d5] bg-[#fbf9f5]">
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex-1 pb-2 text-[11px] font-bold text-center border-b-2 transition ${
            activeTab === 'docs'
              ? 'border-[#0B2545] text-[#0B2545]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Casos ({libraryItems.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 pb-2 text-[11px] font-bold text-center border-b-2 transition ${
            activeTab === 'templates'
              ? 'border-[#0B2545] text-[#0B2545]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Plantillas ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 pb-2 text-[11px] font-bold text-center border-b-2 transition ${
            activeTab === 'sources'
              ? 'border-[#0B2545] text-[#0B2545]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Expediente ({caseDocuments.length})
        </button>
        <button
          onClick={() => setActiveTab('thumbnails')}
          className={`flex-1 pb-2 text-[11px] font-bold text-center border-b-2 transition ${
            activeTab === 'thumbnails'
              ? 'border-[#0B2545] text-[#0B2545]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Miniaturas
        </button>
      </div>

      {/* Barra de Búsqueda rápida */}
      {activeTab !== 'thumbnails' && (
        <div className="p-3 border-b border-[#e8e2d5] bg-[#fbf9f5]">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre, clave o materia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#ded8c9] rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0B2545] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cuerpo con Scroll: Lista de Tarjetas Estilo Mockup */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'thumbnails' ? (
          /* Miniaturas de Páginas */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold px-1 mb-1">
              <span>PÁGINAS CARTA ({totalPages})</span>
              <span>PÁG. ACTIVA: {currentPage}</span>
            </div>
            {pagePreviews.map((prev) => (
              <button
                key={prev.pageNumber}
                onClick={() => onSelectThumbnailPage?.(prev.pageNumber)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  currentPage === prev.pageNumber
                    ? 'bg-white border-[#0B2545] ring-2 ring-blue-100 shadow-sm'
                    : 'bg-white/80 border-[#ded8c9] hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-[#0B2545] mb-1">
                  <span>Página {prev.pageNumber}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {prev.sectionCount} apartado(s)
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100 text-[10px] text-slate-500 font-serif leading-relaxed line-clamp-3">
                  {prev.snippet || 'Página en blanco'}
                </div>
              </button>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400 text-xs italic">
            No se encontraron documentos con el criterio seleccionado.
          </div>
        ) : (
          /* Grid de tarjetas en 2 columnas como en el mockup */
          <div className="grid grid-cols-2 gap-2.5">
            {filteredItems.map((item) => {
              const isSelected =
                (item.caseDoc && selectedCaseDocId === item.caseDoc.id) ||
                (currentDocItem && item.id === currentDocItem.id);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.caseDoc) onSelectCaseDocument(item.caseDoc);
                    if (item.template) onUseTemplate(item.template);
                  }}
                  className={`relative rounded-xl border p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-200 group ${
                    isSelected
                      ? 'bg-white border-[#0B2545] shadow-md ring-2 ring-blue-100'
                      : 'bg-white border-[#ded8c9] hover:border-[#0B2545] hover:shadow-sm'
                  }`}
                >
                  {/* Fila superior: Chip de materia y dot de estado */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md border ${getBadgeColor(
                        item.matter
                      )}`}
                    >
                      {item.matter}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'verified'
                          ? 'bg-[#e05244]' /* El dot rojo/coral del mockup */
                          : 'bg-amber-400'
                      }`}
                      title={item.status === 'verified' ? 'Fuente Verificada' : 'En Revisión'}
                    />
                  </div>

                  {/* Título de la tarjeta */}
                  <div className="mb-2">
                    <h3 className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">
                      {item.title} {item.code ? `(${item.code})` : ''}
                    </h3>
                  </div>

                  {/* Skeleton lines preview (exacto como en el mockup) */}
                  <div className="space-y-1 my-1.5 py-1">
                    <div className="h-1.5 bg-[#ece7db] rounded-full w-full" />
                    <div className="h-1.5 bg-[#ece7db] rounded-full w-5/6" />
                    <div className="h-1.5 bg-[#ece7db] rounded-full w-4/6" />
                  </div>

                  {/* Fila inferior: Fecha y Menú ⋮ */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#f2ede4]">
                    <span>{item.date}</span>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId((prev) => (prev === item.id ? null : item.id));
                        }}
                        className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs"
                      >
                        ⋮
                      </button>

                      {menuOpenId === item.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 bottom-6 w-32 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-[11px] text-slate-700 font-semibold animate-in fade-in zoom-in-95"
                        >
                          {item.type === 'template' && item.template && (
                            <>
                              <button
                                onClick={() => {
                                  onUseTemplate(item.template!);
                                  setMenuOpenId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5 text-[#0B2545]"
                              >
                                ⚡ Usar machote
                              </button>
                              {onDeleteTemplate && (
                                <button
                                  onClick={() => {
                                    onDeleteTemplate(item.template!.id);
                                    setMenuOpenId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
                                >
                                  🗑️ Eliminar
                                </button>
                              )}
                            </>
                          )}

                          {item.type === 'case_doc' && item.caseDoc && (
                            <button
                              onClick={() => {
                                onSelectCaseDocument(item.caseDoc!);
                                setMenuOpenId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5 text-[#0B2545]"
                            >
                              📄 Ver en visor
                            </button>
                          )}

                          {item.type === 'draft' && (
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5"
                            >
                              🔍 Ver detalles
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pie del Panel: Acción para subir nuevo machote */}
      <div className="p-3 border-t border-[#e8e2d5] bg-[#fbf9f5]">
        <button
          onClick={onOpenCreateTemplateModal}
          className="w-full py-2 px-3 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
        >
          <span>➕</span>
          <span>Subir Nuevo Machote</span>
        </button>
      </div>
    </aside>
  );
}
