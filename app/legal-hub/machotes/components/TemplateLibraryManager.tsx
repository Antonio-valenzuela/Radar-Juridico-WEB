'use client';

import React, { useState, useMemo } from 'react';
import { LEGAL_MATTERS_CATALOG } from '../../../../lib/catalog/legalCatalog';
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
  pageCount?: number;
  fileSize?: number;
  fileType?: string;
  sourceFileName?: string;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Calcula conteos reales dinámicamente sobre la lista real de plantillas del usuario
  const matterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    templates.forEach((t) => {
      const catKey = (t.category || t.matterId || 'general').toLowerCase();
      counts[catKey] = (counts[catKey] || 0) + 1;
    });
    return counts;
  }, [templates]);

  // Lista de materias que existen en el catálogo o que tienen registros
  const availableMatters = useMemo(() => {
    return LEGAL_MATTERS_CATALOG.map((m) => {
      const mId = m.id.toLowerCase();
      const count =
        (matterCounts[mId] || 0) +
        (matterCounts[m.name.toLowerCase()] || 0);
      return {
        id: m.id,
        name: m.name,
        icon: m.icon,
        count,
      };
    });
  }, [matterCounts]);

  // Filtrado de plantillas
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((tpl) => {
      const matchesSearch =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        (tpl.description || '').toLowerCase().includes(q) ||
        (tpl.category || '').toLowerCase().includes(q) ||
        (tpl.sourceFileName || '').toLowerCase().includes(q);

      const tplCat = (tpl.category || tpl.matterId || '').toLowerCase();
      const matchesMatter =
        selectedMatterId === 'all' ||
        tplCat === selectedMatterId.toLowerCase() ||
        tplCat.includes(selectedMatterId.toLowerCase());

      return matchesSearch && matchesMatter;
    });
  }, [templates, searchQuery, selectedMatterId]);

  const handleDeleteConfirm = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el machote "${name}"? Esta acción no se puede deshacer.`)) {
      setDeletingId(id);
      try {
        onDeleteTemplate(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="w-full space-y-5 font-sans">
      {/* ── Barra Superior: Título, Buscador y Botón de Creación ──────────────── */}
      <div className="bg-white border border-[#ded8c9] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-extrabold text-[#0B2545] tracking-tight flex items-center gap-2">
              <span>📁</span>
              <span>Mis Plantillas y Machotes</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                {templates.length} {templates.length === 1 ? 'registro' : 'registros'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Biblioteca de documentos oficiales y plantillas reutilizables para redacción judicial.
            </p>
          </div>

          <button
            onClick={onCreateNewTemplate}
            className="px-4 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-bold shadow-sm transition flex items-center gap-2 shrink-0"
          >
            <span>+</span>
            <span>Crear Machote / Plantilla</span>
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 items-center">
          {/* Campo de Búsqueda */}
          <div className="md:col-span-2 relative">
            <input
              type="text"
              placeholder="Buscar por nombre, materia o palabra clave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0B2545] transition"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Selector de Materia con Conteo Real */}
          <div className="relative">
            <select
              value={selectedMatterId}
              onChange={(e) => setSelectedMatterId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-[#0B2545] transition"
            >
              <option value="all">Todas las Materias ({templates.length})</option>
              {availableMatters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon} {m.name} ({m.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Grid de Tarjetas de Machotes ──────────────────────────────────── */}
      {templates.length === 0 ? (
        /* ESTADO VACÍO GLOBAL (Cuando el usuario no tiene machotes aún) */
        <div className="bg-white border border-[#ded8c9] rounded-3xl p-12 text-center shadow-xs space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0B2545] text-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-inner">
            📁
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#0B2545]">
              Aún no tienes machotes guardados
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Sube un documento oficial (PDF o DOCX) de tu despacho para conservarlo y reutilizarlo como base estructural en tus escritos jurídicos.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onCreateNewTemplate}
              className="px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-bold shadow-sm transition inline-flex items-center gap-2"
            >
              <span>📥</span>
              <span>Subir Mi Primer Machote</span>
            </button>
          </div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        /* ESTADO VACÍO POR FILTRO (Hay registros pero no coinciden) */
        <div className="bg-white border border-[#ded8c9] rounded-2xl p-10 text-center shadow-xs space-y-3">
          <div className="text-2xl">🔍</div>
          <div className="space-y-1">
            <h3 className="text-xs font-extrabold text-[#0B2545]">
              No hay machotes que coincidan con estos filtros
            </h3>
            <p className="text-[11px] text-slate-500">
              Prueba modificando el término de búsqueda o cambiando la materia seleccionada.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedMatterId('all');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        /* GRID DE TARJETAS LIMPIAS Y COMPACTAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => {
            const ext = tpl.fileType || (tpl.sourceFileName ? tpl.sourceFileName.split('.').pop()?.toUpperCase() : 'PDF');
            const pages = tpl.pageCount || 1;

            return (
              <div
                key={tpl.id}
                className="bg-white border border-[#ded8c9] hover:border-[#0B2545] rounded-2xl p-4.5 flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md transition duration-150 group"
              >
                <div className="space-y-2.5">
                  {/* Fila Superior: Badges de Materia y Tipo de Archivo */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#0B2545]/10 text-[#0B2545] border border-[#0B2545]/20">
                      {tpl.category || 'Amparo'}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {ext} · {pages} {pages === 1 ? 'pág' : 'págs'}
                    </span>
                  </div>

                  {/* Título del Machote */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0B2545] transition line-clamp-2 leading-snug">
                      {tpl.name}
                    </h3>
                    {tpl.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pie de Tarjeta: Fecha y Acciones */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(tpl.updatedAt).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Botón Usar */}
                    <button
                      onClick={() => onUseTemplate(tpl)}
                      className="px-3 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-bold shadow-xs transition flex items-center gap-1"
                      title="Abrir machote en el editor jurídico"
                    >
                      <span>⚡</span>
                      <span>Usar</span>
                    </button>

                    {/* Botón Editar */}
                    <button
                      onClick={() => onEditTemplate(tpl)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-[#ded8c9] hover:bg-slate-100 text-slate-700 text-xs font-bold transition shadow-xs"
                      title="Editar metadatos del machote"
                    >
                      ✏️
                    </button>

                    {/* Botón Eliminar */}
                    <button
                      onClick={() => handleDeleteConfirm(tpl.id, tpl.name)}
                      disabled={deletingId === tpl.id}
                      className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 text-xs font-bold transition disabled:opacity-40"
                      title="Eliminar machote"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
