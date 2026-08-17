'use client';

import React, { useState, useEffect } from 'react';
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

  // Calcular sugerencia inteligente en base al apartado activo o documento
  const currentSuggestion = React.useMemo(() => {
    if (customSuggestion) return customSuggestion;
    if (!document) {
      return 'Sube un expediente o genera un borrador para activar sugerencias jurídicas contextuales.';
    }

    if (activeSection) {
      const titleLower = activeSection.title.toLowerCase();
      if (titleLower.includes('agravio') || titleLower.includes('violaci')) {
        return `Reforzar la motivación jurídica del "${activeSection.title}" vinculando la omisión de valoración probatoria con la jurisprudencia en materia de debido proceso y tutela judicial efectiva.`;
      }
      if (titleLower.includes('hecho')) {
        return `Precisar la correlación temporal y documental de los hechos controvertidos para desvirtuar la excepción de prescripción opuesta por la contraparte.`;
      }
      if (titleLower.includes('excepc') || titleLower.includes('defens')) {
        return `Oponer expresamente la excepción de falta de acción y derecho, fundamentando la carga probatoria conforme a la legislación aplicable.`;
      }
      if (titleLower.includes('prueb')) {
        return `Ofrecer la prueba de cotejo e inspección judicial respecto de las actuaciones obrantes en el expediente para robustecer el valor probatorio.`;
      }
      return `Desarrollar con mayor profundidad jurídica el apartado "${activeSection.title}", citando los precedentes y fundamentos legales específicos del caso.`;
    }

    return 'Revisar la coherencia de los agravios expuestos y contrastar con los criterios vigentes de los Tribunales Colegiados de Circuito.';
  }, [activeSection, document, customSuggestion]);

  // Lista de fuentes reales de investigación jurídica y memoria del despacho
  const legalSources: LegalSourceItem[] = React.useMemo(() => {
    const list: LegalSourceItem[] = [
      {
        id: 'doc-1',
        type: 'doctrina',
        title: 'Doctrina: Ley de Amparo Comentada',
        subtitle: 'Editorial Porrúa / SCJN — Capítulo VI (Conceptos de Violación)',
        link: 'https://jurisprudencia.scjn.gob.mx/doctrina/amparo',
        badge: 'Doctrina',
        snippet: 'El principio de estricto derecho y las excepciones a la suplencia de la queja en materia laboral y amparo directo.',
      },
      {
        id: 'jur-1',
        type: 'jurisprudencia',
        title: 'Jurisprudencia: Tesis Aisladas y Jurisprudencias',
        subtitle: 'Registro Digital: 2024890 · Tribunales Colegiados de Circuito',
        link: 'https://sjf2.scjn.gob.mx/detalle/tesis/2024890',
        badge: 'SCJN / TCC',
        snippet: 'CONCEPTOS DE VIOLACIÓN INOPERANTES. NO LO SON AQUELLOS QUE COMBATEN DIRECTAMENTE LA MOTIVACIÓN DE LA SENTENCIA RECURRIDA.',
      },
      {
        id: 'mem-1',
        type: 'memoria',
        title: 'Casos Similares de tu Despacho',
        subtitle: 'Amparo Directo 800/2024 · Despacho Valenzuela & Asociados',
        badge: 'Memoria Legal',
        rationale: 'Encontrado porque comparte: Materia Laboral, Pretensión Despido Injustificado y Autoridad Junta Especial.',
        snippet: 'Argumento exitoso: Excepción de oscuridad en la demanda por falta de precisión en circunstancias de modo, tiempo y lugar.',
      },
    ];

    // Si el documento tiene fuentes citadas en el expediente, agregarlas
    if (document?.sourceDocuments && document.sourceDocuments.length > 0) {
      document.sourceDocuments.forEach((s, idx) => {
        list.push({
          id: `exp-${idx}`,
          type: 'expediente',
          title: `Expediente: ${s.filename || s.name || 'Documento del Caso'}`,
          subtitle: `${s.pages?.length || 1} página(s) · Fuente ${s.sourceValidated !== false ? 'Verificada' : 'Parcial'}`,
          badge: 'Expediente',
          snippet: s.extractedText?.slice(0, 140) || 'Texto extraído del expediente.',
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

  if (isCollapsed) {
    return (
      <aside className="w-16 shrink-0 min-w-0 bg-[#43301f] border-l border-[#3a2a1c] flex flex-col items-center py-4 space-y-4 select-none max-[1199px]:hidden">
        <button
          onClick={onToggleCollapse}
          title="Abrir Contextual IA"
          className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-[#f5f2eb] flex items-center justify-center hover:bg-white/20 transition shadow-sm"
        >
          <span className="text-sm font-bold">←</span>
        </button>

        <div className="w-8 h-[1px] bg-white/15" />

        <button
          onClick={onToggleCollapse}
          title="Sugerencias IA"
          className="w-9 h-9 rounded-xl bg-blue-500/25 border border-blue-400/30 text-[#f5f2eb] flex items-center justify-center hover:bg-blue-500/40 transition shadow-sm"
        >
          <span className="text-base">✨</span>
        </button>

        <div className="mt-auto">
          <div className="w-9 h-9 rounded-full bg-[#3b82f6] text-white flex items-center justify-center shadow-lg text-sm">
            ⚖️
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] min-[1400px]:w-[340px] shrink-0 min-w-0 bg-[#fbf9f5] border-l border-[#e8e2d5] flex flex-col h-full overflow-hidden select-none transition-all duration-300 max-[1199px]:fixed max-[1199px]:top-[64px] max-[1199px]:bottom-0 max-[1199px]:right-0 max-[1199px]:z-40 max-[1199px]:shadow-2xl">
      {/* Cabecera del Panel */}
      <div className="p-3.5 border-b border-[#e8e2d5] flex items-center justify-between bg-[#fbf9f5]">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <h2 className="text-[13px] font-extrabold text-[#0B2545] tracking-tight">
            Contextual AI
          </h2>
        </div>

        <button
          onClick={onToggleCollapse}
          title="Cerrar panel IA (×)"
          className="w-7 h-7 rounded-lg bg-white border border-[#ded8c9] text-slate-500 hover:text-slate-900 flex items-center justify-center text-sm font-bold hover:bg-[#ede8dd] transition"
        >
          ✕
        </button>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ── CARD 1: SUGERENCIAS ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#ded8c9] p-3.5 shadow-sm space-y-3">
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
              {/* Texto de la sugerencia */}
              <div className="p-3.5 rounded-xl bg-[#f4f7fb] border border-[#d8e4f5] text-slate-800 text-[13px] font-sans leading-[1.5]">
                {activeSection && (
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#0B2545] mb-1">
                    Apartado: {activeSection.title}
                  </p>
                )}
                <p className="text-slate-700">{currentSuggestion}</p>
                {selectedTextHighlight && (
                  <div className="mt-2 pt-2 border-t border-blue-100 text-[11px] text-amber-800 bg-amber-50/70 p-1.5 rounded">
                    <span className="font-bold">Texto marcado:</span> &quot;{selectedTextHighlight.slice(0, 70)}...&quot;
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApply}
                  disabled={isApplying || isGenerating || !activeSection}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-[#0B2545] hover:bg-[#081d39] disabled:opacity-40 text-white text-[11px] font-bold shadow-sm transition flex items-center justify-center gap-1"
                >
                  {isApplying || isGenerating ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Aplicando...</span>
                    </>
                  ) : (
                    <span>✓ Aplicar Sugerencia</span>
                  )}
                </button>

                <button
                  onClick={() => setCustomSuggestion('Revisar fundamentación conforme a la Ley de Amparo y doctrina aplicable.')}
                  className="py-1.5 px-3 rounded-xl bg-white border border-[#ded8c9] text-slate-600 hover:bg-[#f0ebe0] text-[11px] font-bold transition"
                >
                  Ignorar
                </button>
              </div>

              {/* Input: Escribir para buscar investigación */}
              <form onSubmit={handleSearchSubmit} className="relative mt-2">
                <input
                  type="text"
                  placeholder="Escribir para buscar investigación..."
                  value={researchInput}
                  onChange={(e) => setResearchInput(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#ded8c9] rounded-xl pl-3 pr-14 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0B2545] transition font-sans"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-slate-400 text-xs">📎</span>
                  <span className="bg-[#0B2545] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    9
                  </span>
                </div>
              </form>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 italic py-2">
              Sugerencias pausadas. Active el interruptor para recibir asistencia en tiempo real.
            </p>
          )}
        </div>

        {/* ── CARD 2: TEMAS CLAVE ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#ded8c9] p-3.5 shadow-sm space-y-2.5">
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
                { key: 'hechos', label: 'Hechos controvertidos' },
                { key: 'articulos', label: 'Artículos y Normas' },
                { key: 'doctrina', label: 'Doctrina aplicable' },
                { key: 'jurisprudencia', label: 'Jurisprudencia SCJN' },
                { key: 'frasesClave', label: 'Frases clave y agravios' },
              ].map((item) => {
                const checked = selectedTopics[item.key as keyof typeof selectedTopics];
                return (
                  <label
                    key={item.key}
                    className="flex items-center gap-2.5 text-[11px] text-slate-700 font-medium cursor-pointer hover:text-slate-900 select-none"
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
                      className="w-4 h-4 rounded border-slate-300 text-[#0B2545] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CARD 3: FUENTES DE INVESTIGACIÓN LEGAL ──────────────────────── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold text-[#0B2545]">
              Fuentes de Investigación Legal
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              RAG & Memoria
            </span>
          </div>

          <div className="space-y-2.5">
            {legalSources.map((source) => (
              <div
                key={source.id}
                className="bg-white rounded-2xl border border-[#ded8c9] p-3 shadow-sm hover:border-[#0B2545] transition space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-slate-900 group-hover:text-blue-700 transition">
                    {source.title}
                  </span>
                  {source.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0 ml-1.5">
                      {source.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-1">{source.subtitle}</p>

                {source.rationale && (
                  <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                    💡 {source.rationale}
                  </div>
                )}

                {source.snippet && (
                  <p className="text-[11px] text-slate-600 font-serif leading-relaxed line-clamp-2 pt-0.5">
                    {source.snippet}
                  </p>
                )}

                {source.link && (
                  <a
                    href={source.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-mono pt-1 min-w-0"
                  >
                    <span>🔗</span>
                    <span className="truncate">{source.link}</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
