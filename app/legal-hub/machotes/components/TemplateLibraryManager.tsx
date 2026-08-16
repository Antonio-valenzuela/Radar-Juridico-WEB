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
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar en mis plantillas y machotes por nombre o palabra clave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={onCreateNewTemplate}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-lg transition shadow flex items-center justify-center space-x-2"
          >
            <span>+ Crear Machote / Plantilla</span>
          </button>
        </div>

        {/* Dynamic Catalog Filters */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold uppercase">Materia:</span>
            <select
              value={selectedMatterId}
              onChange={(e) => {
                setSelectedMatterId(e.target.value);
                setSelectedSubcategoryId('all');
              }}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500"
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
              <span className="text-slate-400 font-semibold uppercase">Subcategoría:</span>
              <select
                value={selectedSubcategoryId}
                onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500"
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
          <div className="col-span-full bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <p className="text-sm italic">No se encontraron machotes o plantillas en el catálogo.</p>
          </div>
        ) : (
          filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg hover:shadow-xl transition group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80">
                    {tpl.category || 'Machote'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    v{tpl.version || 1}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition mb-1">
                  {tpl.name}
                </h3>
                {tpl.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{tpl.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Actualizado: {new Date(tpl.updatedAt).toLocaleDateString('es-MX')}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUseTemplate(tpl)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded transition shadow"
                  >
                    Usar
                  </button>
                  <button
                    onClick={() => onEditTemplate(tpl)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded border border-slate-700 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setSelectedTemplateForVersions(tpl)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-semibold text-xs rounded border border-slate-700 transition"
                  >
                    v{tpl.version}
                  </button>
                  <button
                    onClick={() => onDeleteTemplate(tpl.id)}
                    className="px-2 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded text-xs transition"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-amber-400">
                Historial de Versiones: {selectedTemplateForVersions.name}
              </h3>
              <button
                onClick={() => setSelectedTemplateForVersions(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(selectedTemplateForVersions.versions || [
                {
                  id: 'v1',
                  templateId: selectedTemplateForVersions.id,
                  version: selectedTemplateForVersions.version || 1,
                  title: selectedTemplateForVersions.name,
                  structureJson: {},
                  variables: [],
                  createdAt: selectedTemplateForVersions.updatedAt,
                },
              ]).map((ver) => (
                <div
                  key={ver.id || ver.version}
                  className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs"
                >
                  <div>
                    <span className="font-bold text-amber-300">Versión {ver.version}</span>
                    <p className="text-[11px] text-slate-500">
                      {new Date(ver.createdAt).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onUseTemplate(selectedTemplateForVersions, ver);
                      setSelectedTemplateForVersions(null);
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded"
                  >
                    Usar v{ver.version}
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
