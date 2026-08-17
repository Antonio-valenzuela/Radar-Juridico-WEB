'use client';

import React, { useState, useRef } from 'react';
import type { UploadedSourceDocument, TemplateVersion } from '@/lib/legal-engine/types';
import type { TemplateItem } from './TemplateLibraryManager';

interface WorkspaceDraftGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabMode: 'universal' | 'initial_writings' | 'responses_resources';
  onGenerate: (payload: {
    userInstruction: string;
    intentLabel?: string;
    sourceDocs: UploadedSourceDocument[];
    selectedTemplate?: TemplateItem | null;
    templateRefText?: string;
  }) => Promise<void>;
  templates: TemplateItem[];
  uploadedSources: UploadedSourceDocument[];
  onUploadFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveUploadedSource: (id: string) => void;
  caseFicha: any | null;
  onAnalyzeCase: () => void;
  isGenerating: boolean;
  onOpenUploadCustomTemplateModal: () => void;
}

const UNIVERSAL_PRESETS = [
  { label: 'Contestación de demanda laboral', prompt: 'Contestar demanda laboral oponiendo excepciones y defensas, contestando hechos, ofreciendo pruebas y petitorios.' },
  { label: 'Recurso de revisión', prompt: 'Interponer recurso de revisión y formular agravios contra la sentencia recurrida con fundamentación y doctrina.' },
  { label: 'Recurso de queja', prompt: 'Interponer recurso de queja contra el auto o resolución que desecha o no admite la demanda o prueba.' },
  { label: 'Amparo directo', prompt: 'Formular demanda de amparo directo señalando acto reclamado, autoridad responsable, conceptos de violación y petitorios.' },
  { label: 'Amparo indirecto', prompt: 'Formular demanda de amparo indirecto con suspensión del acto reclamado y conceptos de violación.' },
  { label: 'Escrito de cumplimiento', prompt: 'Promover escrito de cumplimiento de requerimiento judicial acreditando los extremos solicitados.' },
  { label: 'Expresión de agravios', prompt: 'Expresar agravios en segunda instancia combatiendo la falta de exhaustividad y congruencia.' },
];

const INITIAL_WRITING_PRESETS = [
  { label: 'Demanda de Amparo Indirecto', prompt: 'Demanda de amparo indirecto contra acto de autoridad que vulnera garantías individuales y debido proceso.' },
  { label: 'Demanda Laboral Inicial', prompt: 'Demanda ordinaria laboral por despido injustificado, reclamando indemnización constitucional, salarios caídos y prestaciones.' },
  { label: 'Demanda Mercantil Ejecutiva', prompt: 'Demanda ejecutiva mercantil fundada en pagaré o título de crédito con solicitud de embargo.' },
  { label: 'Demanda Civil Ordinaria', prompt: 'Demanda ordinaria civil por incumplimiento de contrato y rescisión.' },
];

const RESPONSE_RESOURCE_PRESETS = [
  { label: 'Contestación Laboral', prompt: 'Contestación a la demanda laboral negando el despido y oponiendo excepciones de falta de acción y prescripción.' },
  { label: 'Contestación Civil / Mercantil', prompt: 'Contestación de demanda civil y reconvención conforme a derecho.' },
  { label: 'Recurso de Revisión en Amparo', prompt: 'Recurso de revisión contra la ejecutoria del Tribunal Colegiado por interpretación constitucional.' },
  { label: 'Recurso de Reclamación', prompt: 'Recurso de reclamación contra el acuerdo de presidencia que desechó el trámite.' },
  { label: 'Incidente de Nulidad', prompt: 'Incidente de nulidad de notificaciones por falta de emplazamiento legal.' },
];

export function WorkspaceDraftGeneratorModal({
  isOpen,
  onClose,
  tabMode,
  onGenerate,
  templates,
  uploadedSources,
  onUploadFiles,
  onRemoveUploadedSource,
  caseFicha,
  onAnalyzeCase,
  isGenerating,
  onOpenUploadCustomTemplateModal,
}: WorkspaceDraftGeneratorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [selectedTpl, setSelectedTpl] = useState<TemplateItem | null>(null);
  const [templateRefText, setTemplateRefText] = useState<string>('');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  if (!isOpen) return null;

  const presets =
    tabMode === 'initial_writings'
      ? INITIAL_WRITING_PRESETS
      : tabMode === 'responses_resources'
      ? RESPONSE_RESOURCE_PRESETS
      : UNIVERSAL_PRESETS;

  const handleSelectPreset = (p: { label: string; prompt: string }) => {
    setSelectedPreset(p.label);
    setUserPrompt(p.prompt);
  };

  const handleSelectTemplate = async (tpl: TemplateItem) => {
    setSelectedTpl(tpl);
    try {
      const res = await fetch(`/api/templates/custom/${tpl.id}`);
      const data = await res.json();
      if (data.ok && data.template) {
        setTemplateRefText(data.template.originalText || data.template.content || '');
      }
    } catch {
      // Ignorar fallback
    }
  };

  const handleStartGeneration = async () => {
    await onGenerate({
      userInstruction: userPrompt || 'Redactar escrito jurídico formal con fundamentación y apartados completos.',
      intentLabel: selectedPreset || undefined,
      sourceDocs: uploadedSources,
      selectedTemplate: selectedTpl,
      templateRefText: templateRefText || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[1001] flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 font-sans">
        {/* Cabecera del Modal */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-[#fbf9f5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0B2545] text-white flex items-center justify-center text-xl shadow-md">
              {tabMode === 'initial_writings' ? '📝' : tabMode === 'responses_resources' ? '⚖️' : '⚙️'}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0B2545]">
                {tabMode === 'initial_writings'
                  ? 'Redactar Escrito Inicial / Demanda'
                  : tabMode === 'responses_resources'
                  ? 'Generar Contestación o Recurso'
                  : 'Motor Universal de Redacción Jurídica'}
              </h2>
              <p className="text-xs text-slate-500">
                Sube expediente → Selecciona estrategia y machote → Genera borrador adaptado
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* PASO 1: Expediente / Fuentes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0B2545] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                <span>Documentos del Expediente</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                PDF · DOCX · JPG · PNG
              </span>
            </div>

            {/* Zona de Dropzone */}
            <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-[#0B2545] rounded-2xl cursor-pointer bg-[#fbf9f5] transition group text-center">
              <span className="text-2xl mb-1 group-hover:scale-110 transition">📥</span>
              <span className="text-xs font-bold text-[#0B2545]">Seleccionar o arrastrar archivos del caso</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Extracción OCR y procesamiento 100% local</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt"
                onChange={onUploadFiles}
                className="hidden"
              />
            </label>

            {/* Lista de archivos cargados */}
            {uploadedSources.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {uploadedSources.map((doc) => (
                  <div key={doc.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span>📄</span>
                      <span className="font-bold text-slate-800 truncate">{doc.filename || doc.name}</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                        ✓ {doc.pages?.length || 1} pág(s)
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveUploadedSource(doc.id)}
                      className="text-slate-400 hover:text-red-500 text-xs px-1"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            {caseFicha && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-[#0B2545]">
                  <span>Ficha del caso detectada ({caseFicha.confianza}% confianza)</span>
                  <span>{caseFicha.materia} · {caseFicha.tipo}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Expediente: <strong className="text-slate-800">{caseFicha.expediente || 'N/D'}</strong> · Partes: <strong className="text-slate-800">{caseFicha.actor || 'N/D'}</strong> vs <strong className="text-slate-800">{caseFicha.demandado || 'N/D'}</strong>
                </p>
              </div>
            )}
          </div>

          {/* PASO 2: ¿Qué necesitas elaborar? */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0B2545] text-white text-[10px] flex items-center justify-center font-bold">2</span>
              <span>¿Qué necesitas elaborar?</span>
            </h3>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    selectedPreset === preset.label
                      ? 'bg-[#0B2545] text-white border-[#0B2545] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-[#0B2545]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              rows={3}
              value={userPrompt}
              onChange={(e) => {
                setUserPrompt(e.target.value);
                setSelectedPreset(null);
              }}
              placeholder="Describe el problema jurídico, estrategia o requerimientos específicos..."
              className="w-full bg-[#fbf9f5] border border-slate-300 focus:border-[#0B2545] rounded-xl p-3 text-xs text-slate-800 focus:outline-none leading-relaxed font-sans"
            />
          </div>

          {/* PASO 3: Selección de Machote del Abogado */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0B2545] text-white text-[10px] flex items-center justify-center font-bold">3</span>
                <span>Seleccionar Machote (Plantilla)</span>
              </h3>
              <button
                onClick={onOpenUploadCustomTemplateModal}
                className="text-[11px] font-bold text-[#0B2545] hover:underline"
              >
                ➕ Subir machote
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 space-y-1.5">
                <p>No tienes machotes personalizados guardados.</p>
                <button
                  onClick={onOpenUploadCustomTemplateModal}
                  className="py-1 px-3 rounded-lg bg-[#0B2545] text-white text-[11px] font-bold"
                >
                  Subir primer machote
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {templates.map((tpl) => {
                  const isSelected = selectedTpl?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50 border-[#0B2545] shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">{tpl.name}</p>
                        <p className="text-[10px] text-slate-400">{tpl.category} · v{tpl.version}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {isSelected ? '✓ Seleccionado' : 'Elegir'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal: Botón Generar */}
        <div className="p-5 border-t border-slate-100 bg-[#fbf9f5] flex items-center justify-between">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
          >
            Cancelar
          </button>

          <button
            onClick={handleStartGeneration}
            disabled={isGenerating || (uploadedSources.length === 0 && !selectedTpl && !userPrompt)}
            className="py-2.5 px-6 rounded-xl bg-[#0B2545] hover:bg-[#081d39] disabled:opacity-40 text-white text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Redactando escrito...</span>
              </>
            ) : (
              <span>⚡ Generar Escrito Completo</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
