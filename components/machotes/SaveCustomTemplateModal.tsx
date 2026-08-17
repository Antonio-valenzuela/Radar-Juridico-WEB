'use client';

import React, { useState, useRef } from 'react';
import { TemplateCategory, ProfessionalTemplate } from '@/lib/templates/templateTypes';

interface SaveCustomTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated: (newTemplate: ProfessionalTemplate) => void;
}

export function SaveCustomTemplateModal({
  isOpen,
  onClose,
  onTemplateCreated,
}: SaveCustomTemplateModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('Amparo');
  const [legalBasis, setLegalBasis] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [extractedTextClean, setExtractedTextClean] = useState('');
  const [pageCount, setPageCount] = useState<number>(1);
  const [analysis, setAnalysis] = useState<{
    es_juridico: boolean;
    tipo_documento: string;
    confianza: number;
    razon?: string;
    secciones_detectadas: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const sanitizeClean = (raw: string) => {
    return raw
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFD]/g, '')
      .replace(/[□■]+/g, ' ')
      .replace(/\s{3,}/g, ' ')
      .trim();
  };

  const processSelectedFile = async (selected: File) => {
    setFile(selected);
    setAnalysis(null);
    setError(null);
    setShowRawText(false);

    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }

    // Análisis en segundo plano: NO bloquea ni condiciona la validez del archivo original
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', selected, selected.name);
      const response = await fetch('/api/templates/analyze-upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (response.ok && payload.ok !== false) {
        const pCount = payload.pages?.length || payload.qualityScore?.pageCount || 1;
        setPageCount(pCount);

        if (payload.classification) {
          setAnalysis({
            es_juridico: payload.classification.es_juridico ?? true,
            tipo_documento: payload.classification.tipo_documento || 'Documento Oficial',
            confianza: payload.classification.confianza || 100,
            razon: payload.classification.razon,
            secciones_detectadas: payload.classification.secciones_detectadas || [
              'Hechos',
              'Antecedentes',
              'Fundamentos',
              'Puntos petitorios',
              'Pruebas',
              'Firma',
            ],
          });
        }

        if (payload.extractedText) {
          const clean = sanitizeClean(payload.extractedText);
          setExtractedTextClean(clean);
        }
      }
    } catch {
      // Si la extracción auxiliar no responde o tiene encoding especial, el archivo original permanece 100% válido
      setPageCount(1);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processSelectedFile(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Por favor ingresa un nombre para el machote.');
      return;
    }
    if (!file && !extractedTextClean.trim()) {
      setError('Por favor selecciona un archivo de machote o escribe su contenido.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let res: Response;
      if (file) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('title', title.trim());
        formData.append('category', category);
        if (legalBasis.trim()) formData.append('legalBasis', legalBasis.trim());
        if (extractedTextClean.trim()) formData.append('documentContent', extractedTextClean.trim());

        res = await fetch('/api/templates/custom', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/templates/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            category,
            legalBasis: legalBasis.trim() || undefined,
            content: extractedTextClean.trim(),
            originalText: extractedTextClean.trim(),
            documentType: 'machote',
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || (!data.ok && !data.success)) {
        throw new Error(data.error || 'No fue posible guardar el machote.');
      }

      onTemplateCreated(data.template);
      onClose();
    } catch (err: any) {
      setError(err.message || 'No fue posible guardar el machote.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[1050] flex items-center justify-center p-4 select-none font-sans"
      onClick={onClose}
      role="dialog"
      aria-label="Subir y Guardar Mi Propio Machote"
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Profesional */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-[#fbf9f5]">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-[#0B2545] tracking-tight">
              Subir y Guardar Mi Propio Machote
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Guarda un documento oficial para reutilizarlo en cualquier momento.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold text-xs transition shadow-xs"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del Formulario */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-800">
          {/* Nombre del Machote */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">
              Nombre del machote <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Demanda de Amparo Directo 800/2024"
              className="w-full px-3.5 py-2 bg-white border border-[#ded8c9] rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-[#0B2545] focus:ring-1 focus:ring-[#0B2545] transition"
            />
          </div>

          {/* Materia y Fundamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Materia</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full px-3.5 py-2 bg-white border border-[#ded8c9] rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-[#0B2545] transition"
              >
                <option value="Amparo">Amparo</option>
                <option value="Civil">Civil</option>
                <option value="Familiar">Familiar</option>
                <option value="Mercantil">Mercantil</option>
                <option value="Administrativo/Fiscal">Administrativo/Fiscal</option>
                <option value="Laboral">Laboral</option>
                <option value="General">General</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Fundamento opcional</label>
              <input
                type="text"
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                placeholder="Ej. Arts. 107 y 108 Ley de Amparo"
                className="w-full px-3.5 py-2 bg-white border border-[#ded8c9] rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-[#0B2545] transition"
              />
            </div>
          </div>

          {/* ARCHIVO DEL MACHOTE */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="font-bold text-slate-700 block">
              ARCHIVO DEL MACHOTE
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center space-y-2 ${
                isDragging
                  ? 'border-[#0B2545] bg-blue-50/50'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-[#ded8c9] bg-[#fbf9f5] hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.rtf,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,application/rtf,image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white font-bold text-xs shadow-sm transition flex items-center gap-2"
              >
                <span>📄</span>
                <span>Seleccionar archivo</span>
              </button>

              <span className="text-[11px] text-slate-400 font-medium">
                PDF, DOCX, DOC, TXT, RTF, imagen
              </span>
            </div>

            {isAnalyzing && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#0B2545] font-semibold flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-[#0B2545] border-t-transparent animate-spin" />
                <span>Analizando estructura documental del archivo...</span>
              </div>
            )}

            {/* Archivo Seleccionado y Estado de Preservación */}
            {file && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between text-emerald-900 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span>✓</span>
                    <span className="truncate max-w-xs">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-mono">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>

                <div className="text-[11px] text-emerald-800 font-medium">
                  Documento original conservado • {pageCount} {pageCount === 1 ? 'página' : 'páginas'} • {file.name.split('.').pop()?.toUpperCase()}
                </div>
              </div>
            )}

            {/* Análisis Limpio del Documento */}
            {analysis && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between font-bold text-[#0B2545]">
                  <span>Tipo: {analysis.tipo_documento}</span>
                  <span>Confianza: {analysis.confianza}%</span>
                </div>

                {analysis.secciones_detectadas?.length > 0 && (
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <span className="font-bold text-slate-700 block">Secciones detectadas:</span>
                    <div className="flex flex-wrap gap-1">
                      {analysis.secciones_detectadas.map((sec, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-700">
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opción Colapsada para Ver / Editar Texto Extraído */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="text-[11px] font-bold text-[#0B2545] hover:underline flex items-center gap-1"
              >
                <span>{showRawText ? '▾' : '▸'}</span>
                <span>{showRawText ? 'Ocultar texto extraído' : 'Opcional: ver texto extraído'}</span>
              </button>

              {showRawText && (
                <div className="mt-2 space-y-1 animate-in fade-in">
                  <textarea
                    value={extractedTextClean}
                    onChange={(e) => setExtractedTextClean(e.target.value)}
                    rows={4}
                    placeholder="Texto extraído del documento..."
                    className="w-full p-2.5 bg-white border border-[#ded8c9] rounded-xl text-xs text-slate-800 font-sans focus:outline-none focus:border-[#0B2545]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Banner de Error UX */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs space-y-0.5 animate-in fade-in">
              <p className="font-bold">No fue posible guardar el machote.</p>
              <p className="text-[11px] text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-[#fbf9f5]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-[#ded8c9] hover:bg-slate-100 text-slate-700 text-xs font-bold transition shadow-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-[#0B2545] hover:bg-[#081d39] disabled:opacity-50 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <span>💾</span>
            <span>{loading ? 'Guardando...' : 'Guardar como Machote'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
