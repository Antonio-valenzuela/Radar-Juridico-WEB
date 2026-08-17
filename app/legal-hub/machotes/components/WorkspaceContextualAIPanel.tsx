'use client';

import React, { useState } from 'react';
import type { UniversalLegalDocument, DocumentNode } from '@/lib/legal-engine/types';

interface WorkspaceContextualAIPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  document: UniversalLegalDocument | null;
  activeSection: DocumentNode | null;
  selectedTextHighlight?: string | null;
  onApplySuggestion: (suggestionText: string) => void;
  onRunAiResearch?: (query: string) => void;
  isGenerating?: boolean;
}

interface LegalSourceItem {
  id: string;
  type: 'doctrina' | 'jurisprudencia' | 'expediente' | 'memoria';
  title: string;
  subtitle: string;
  link?: string;
  badge?: string;
  rationale?: string;
  snippet?: string;
}

export function WorkspaceContextualAIPanel({
  isCollapsed,
  onToggleCollapse,
  document,
  activeSection,
  selectedTextHighlight,
  onApplySuggestion,
  onRunAiResearch,
  isGenerating = false,
}: WorkspaceContextualAIPanelProps) {
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [researchInput, setResearchInput] = useState('');
  const [selectedTopics, setSelectedTopics] = useState({
    hechos: true,
    articulos: true,
    doctrina: true,
    jurisprudencia: true,
    frasesClave: true,
  });
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const [customSuggestion, setCustomSuggestion] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Sugerencia contextual inteligente según la referencia visual
  const currentSuggestion = React.useMemo(() => {
    if (customSuggestion) return customSuggestion;
    if (!document) {
      return 'Sôggencaz os corsuisias con astatuuola suptonda lo coiadedad de cala ais la ecperata del fontas eoz corctaiaste...';
    }

    if (activeSection) {
      const titleLower = activeSection.title.toLowerCase();
      if (titleLower.includes('agravio') || titleLower.includes('violaci') || titleLower.includes('concepto')) {
        return `Reforzar la motivación jurídica del apartado "${activeSection.title}" vinculando la omisión de valoración probatoria con los criterios vigentes de los Tribunales Colegiados de Circuito.`;
      }
      if (titleLower.includes('hecho') || titleLower.includes('antecedente')) {
        return `Precisar la correlación temporal y documental de los hechos controvertidos para desvirtuar la excepción de prescripción opuesta por la contraparte.`;
      }
      if (titleLower.includes('excepc') || titleLower.includes('defens')) {
        return `Oponer expresamente la excepción de falta de acción y derecho, fundamentando la carga probatoria conforme a la legislación aplicable.`;
      }
      return `Desarrollar con mayor profundidad jurídica el apartado "${activeSection.title}", citando los precedentes y fundamentos legales específicos del caso.`;
    }

    return 'Sôggencaz os corsuisias con astatuuola suptonda lo coiadedad de cala ais la ecperata del fontas eoz corctaiaste...';
  }, [activeSection, document, customSuggestion]);

  // Lista de fuentes exactas de la referencia visual
  const legalSources: LegalSourceItem[] = React.useMemo(() => {
    const list: LegalSourceItem[] = [
      {
        id: 'doc-1',
        type: 'doctrina',
        title: 'Doctrina: Ley de Amparo Comentada',
        subtitle: 'Trogal Research Marrdal de Nuset',
        link: 'https://lasseriencia/rootlastrenchirins.',
      },
      {
        id: 'jur-1',
        type: 'jurisprudencia',
        title: 'Jurisprudencia: Tesis Aisladas',
        subtitle: 'Tiagal Research Masenie dóra Maraderool léc',
        link: 'https://auvablor7xde11886055:0',
      },
      {
        id: 'mem-1',
        type: 'memoria',
        title: 'Legal Research Souro nsi...',
        subtitle: 'Fansado Sasir Estas',
      },
    ];

    if (document?.sourceDocuments && document.sourceDocuments.length > 0) {
      document.sourceDocuments.forEach((s, idx) => {
        list.push({
          id: `exp-${idx}`,
          type: 'expediente',
          title: `Expediente: ${s.filename || s.name || 'Documento'}`,
          subtitle: `${s.pages?.length || 1} pág(s) · Fuente ${s.sourceValidated !== false ? 'Verificada' : 'Parcial'}`,
          link: s.extractedText ? undefined : undefined,
        });
      });
    }

    return list;
  }, [document]);

  const handleApply = async () => {
    if (!currentSuggestion || isApplying) return;
    setIsApplying(true);
    try {
      await onApplySuggestion(currentSuggestion);
      setCustomSuggestion(null);
    } finally {
      setIsApplying(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchInput.trim()) return;
    if (onRunAiResearch) {
      onRunAiResearch(researchInput.trim());
    } else {
      setCustomSuggestion(`Incorporar análisis jurídico sobre: "${researchInput.trim()}" en el apartado activo.`);
    }
    setResearchInput('');
  };

  /* ──────────────────────────────────────────────────────────────────────────
     VISTA RETRAÍDA
  ────────────────────────────────────────────────────────────────────────── */
  if (isCollapsed) {
    return (
      <aside className="w-16 shrink-0 min-w-0 bg-[#3a2717] border-l border-[#2e1d10] flex flex-col items-center py-4 space-y-4 select-none z-20">
        <button
          onClick={onToggleCollapse}
          title="Abrir Contextual AI"
          className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 text-[#f5f2eb] flex items-center justify-center hover:bg-white/20 transition shadow-sm"
        >
          <span className="text-sm font-bold">←</span>
        </button>

        <div className="w-8 h-[1px] bg-white/15 my-1" />

        <button
          onClick={onToggleCollapse}
          title="Sugerencias IA"
          className="w-10 h-10 rounded-xl bg-blue-500/25 border border-blue-400/30 text-[#f5f2eb] flex items-center justify-center hover:bg-blue-500/40 transition shadow-sm"
        >
          <span className="text-base">✨</span>
        </button>

        <div className="mt-auto">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6] text-white flex items-center justify-center shadow-lg text-sm">
            ⚖️
          </div>
        </div>
      </aside>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     VISTA EXPANDIDA: Panel Contextual AI idéntico a la referencia
  ────────────────────────────────────────────────────────────────────────── */
  return (
    <aside className="w-[300px] min-[1400px]:w-[320px] shrink-0 min-w-0 bg-[#fbf9f5] border-l border-[#e8e2d5] flex flex-col h-full overflow-hidden select-none transition-all duration-300 relative font-sans max-[1199px]:fixed max-[1199px]:top-[64px] max-[1199px]:bottom-0 max-[1199px]:right-0 max-[1199px]:z-40 max-[1199px]:shadow-2xl">
      {/* ── Cabecera del Panel: "Contextual AI" + ✕ ──────────────────────── */}
      <div className="p-3.5 border-b border-[#e8e2d5] flex items-center justify-between bg-[#fbf9f5]">
        <h2 className="text-[13px] font-extrabold text-[#0B2545] tracking-tight">
          Contextual AI
        </h2>

        <button
          onClick={onToggleCollapse}
          title="Cerrar panel IA (×)"
          className="w-7 h-7 rounded-lg bg-white border border-[#ded8c9] text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold hover:bg-[#ede8dd] transition shadow-xs"
        >
          ✕
        </button>
      </div>

      {/* ── Contenido con Scroll ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* CARD 1: SUGERENCIAS */}
        <div className="bg-white rounded-2xl border border-[#ded8c9] p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#0B2545]">Sugerencias</h3>
            {/* Toggle switch iOS style */}
            <button
              onClick={() => setSuggestionsEnabled(!suggestionsEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                suggestionsEnabled ? 'bg-[#0B2545]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                  suggestionsEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {suggestionsEnabled ? (
            <>
              {/* Cuadro de sugerencia */}
              <div className="p-3 rounded-xl bg-[#f4f7fb] border border-[#d8e4f5] text-slate-700 text-xs font-sans leading-relaxed">
                {currentSuggestion}
              </div>

              {/* Input buscador con clip y badge (9) */}
              <form onSubmit={handleSearchSubmit} className="relative mt-2">
                <input
                  type="text"
                  placeholder="Escribir para buscar investigaci..."
                  value={researchInput}
                  onChange={(e) => setResearchInput(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#ded8c9] rounded-xl pl-3 pr-14 py-2 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0B2545] transition font-sans"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs cursor-pointer">📎</span>
                  <span className="bg-[#0B2545] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    (9)
                  </span>
                </div>
              </form>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 italic py-1">
              Sugerencias pausadas. Active el interruptor para recibir asistencia en tiempo real.
            </p>
          )}
        </div>

        {/* CARD 2: TEMAS CLAVE */}
        <div className="bg-white rounded-2xl border border-[#ded8c9] p-3.5 shadow-xs space-y-2.5">
          <button
            onClick={() => setTopicsExpanded(!topicsExpanded)}
            className="w-full flex items-center justify-between text-xs font-extrabold text-[#0B2545]"
          >
            <span>Temas Clave</span>
            <span className="text-slate-400 text-xs font-bold">
              {topicsExpanded ? '∧' : '∨'}
            </span>
          </button>

          {topicsExpanded && (
            <div className="space-y-2 pt-1">
              {[
                { key: 'hechos', label: 'Hechos' },
                { key: 'articulos', label: 'Artículos' },
                { key: 'doctrina', label: 'Doctrina' },
                { key: 'jurisprudencia', label: 'Jurisprudencia' },
                { key: 'frasesClave', label: 'Frases clave' },
              ].map((item) => {
                const checked = selectedTopics[item.key as keyof typeof selectedTopics];
                return (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer hover:text-slate-900 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedTopics((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key as keyof typeof selectedTopics],
                        }))
                      }
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#0B2545] focus:ring-0 cursor-pointer"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* CARD 3: FUENTES DE INVESTIGACIÓN LEGAL */}
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold text-[#0B2545] px-1">
            Fuentes de Investigación Legal
          </h3>

          <div className="space-y-2">
            {legalSources.map((source) => (
              <div
                key={source.id}
                className="bg-white rounded-2xl border border-[#ded8c9] p-3 shadow-xs hover:border-[#0B2545] transition space-y-1 group"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">📄</span>
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {source.title}
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 pl-4 font-sans">
                  ◇ {source.subtitle}
                </p>

                {source.link && (
                  <p className="text-[10px] text-slate-400 pl-4 truncate font-mono">
                    {source.link}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FLOATING ACTION BUTTON (FAB) INFERIOR DERECHO ──────────────────── */}
      <div className="p-3 bg-[#fbf9f5] border-t border-[#e8e2d5] flex justify-end">
        <div
          title="Asistente Jurídico Radar"
          className="w-12 h-12 rounded-full bg-[#3b82f6] hover:bg-blue-600 text-white shadow-xl flex items-center justify-center text-xl cursor-pointer transition transform hover:scale-105"
        >
          ⚖️
        </div>
      </div>
    </aside>
  );
}
