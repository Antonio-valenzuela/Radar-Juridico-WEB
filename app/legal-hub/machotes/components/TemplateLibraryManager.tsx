'use client';

import React, { useState } from 'react';
import { LEGAL_MATTERS_CATALOG, getLegalMatterById } from '../../../../lib/catalog/legalCatalog';
import { TemplateVersion } from '../../../../lib/legal-engine/types';

export interface TemplateItem {
  id: string;
  name: string;
  category: string;
  matterId?: string;
  subcategoryId?: string;
  version: number;
  versions?: TemplateVersion[];
  description?: string;
  updatedAt: string;
  sectionsCount?: number;
  placeholdersCount?: number;
}

interface TemplateLibraryManagerProps {
  templates: TemplateItem[];
  onUseTemplate: (template: TemplateItem, version?: TemplateVersion) => void;
  onEditTemplate: (template: TemplateItem) => void;
  onDeleteTemplate: (templateId: string) => void;
  onCreateNewTemplate: () => void;
}

export function TemplateLibraryManager({
  templates,
  onUseTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onCreateNewTemplate,
}: TemplateLibraryManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatterId, setSelectedMatterId] = useState<string>('all');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('all');
  const [selectedTemplateForVersions, setSelectedTemplateForVersions] = useState<TemplateItem | null>(null);

  // Filter templates based on catalog
  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tpl.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMatter = selectedMatterId === 'all' || tpl.matterId === selectedMatterId || tpl.category.toLowerCase().includes(selectedMatterId.toLowerCase());
    const matchesSubcategory = selectedSubcategoryId === 'all' || tpl.subcategoryId === selectedSubcategoryId;
    return matchesSearch && matchesMatter && matchesSubcategory;
  });

  const activeMatter = getLegalMatterById(selectedMatterId);

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Search & Catalog Filters ─────────────────────────────── */}
      <div className="jr-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar en mis plantillas y machotes por nombre o palabra clave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="jr-input w-full px-4 py-2.5 text-sm"
            />
          </div>
          <button
            onClick={onCreateNewTemplate}
            className="jr-button-primary text-xs py-2.5 px-5"
          >
            <span>+ Crear Machote / Plantilla</span>
          </button>
        </div>

        {/* Dynamic Catalog Filters */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Materia:</span>
            <select
              value={selectedMatterId}
              onChange={(e) => {
                setSelectedMatterId(e.target.value);
                setSelectedSubcategoryId('all');
              }}
              className="jr-input px-3.5 py-1.5 font-semibold"
            >
              <option value="all">Todas las Materias ({LEGAL_MATTERS_CATALOG.length})</option>
              {LEGAL_MATTERS_CATALOG.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon} {m.name}
                </option>
              ))}
            </select>
          </div>

          {activeMatter && activeMatter.subcategories.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Subcategoría:</span>
              <select
                value={selectedSubcategoryId}
                onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                className="px-3.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
              >
                <option value="all">Todas las Subcategorías</option>
                {activeMatter.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Template Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
            <p className="text-sm italic">No se encontraron machotes o plantillas en el catálogo.</p>
          </div>
        ) : (
          filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-slate-200 hover:border-[#0B2545] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0B2545] border border-blue-200">
                    {tpl.category || 'Machote'}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    v{tpl.version || 1}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#0B2545] group-hover:text-blue-600 transition mb-1">
                  {tpl.name}
                </h3>
                {tpl.description && (
                  <p className="text-xs text-slate-600 line-clamp-2">{tpl.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {new Date(tpl.updatedAt).toLocaleDateString('es-MX')}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUseTemplate(tpl)}
                    className="machote-jr-button-primary text-xs py-1.5 px-3"
                  >
                    Usar
                  </button>
                  <button
                    onClick={() => onEditTemplate(tpl)}
                    className="machote-jr-button-secondary text-xs py-1.5 px-2.5"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setSelectedTemplateForVersions(tpl)}
                    className="machote-jr-button-secondary text-xs py-1.5 px-2"
                  >
                    v{tpl.version}
                  </button>
                  <button
                    onClick={() => onDeleteTemplate(tpl.id)}
                    className="px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-xs transition"
                    title="Eliminar plantilla"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Version History Modal ─────────────────────────────────────────── */}
      {selectedTemplateForVersions && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-[#0B2545]">
                Historial de Versiones: {selectedTemplateForVersions.name}
              </h3>
              <button
                onClick={() => setSelectedTemplateForVersions(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(selectedTemplateForVersions.versions || []).map((v) => (
                <div key={v.version} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#0B2545]">Versión {v.version}</span>
                    <p className="text-[11px] text-slate-500">{new Date(v.createdAt).toLocaleDateString('es-MX')}</p>
                  </div>
                  <button
                    onClick={() => {
                      onUseTemplate(selectedTemplateForVersions, v);
                      setSelectedTemplateForVersions(null);
                    }}
                    className="machote-jr-button-primary text-xs py-1 px-3"
                  >
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
