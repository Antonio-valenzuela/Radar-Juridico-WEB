"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/client/adminToken';
import { templates } from '@/lib/templates/templateDefinitions';
import type {
  AIAssistResult,
  ProfessionalTemplate,
} from '@/lib/templates/templateTypes';
import {
  renderToText,
  renderToDocument,
  validateTemplateValues,
} from '@/lib/templates/templateRenderer';
import { generatePrintHtml } from '@/lib/templates/exportPdf';
import { DRAFT_WARNING, hasPendingMarkers } from '@/lib/templates/templateQuality';
import { useLegalWorkspaceContext } from '@/context/LegalWorkspaceContext';
import { AiFillModal } from '@/components/machotes/AiFillModal';
import { getSampleValuesForTemplate } from '@/lib/templates/templateSampleData';
import { getCustomTemplates, deleteCustomTemplate } from '@/lib/templates/customTemplateStore';
import { SaveCustomTemplateModal } from '@/components/machotes/SaveCustomTemplateModal';
import { EditCustomTemplateModal } from '@/components/machotes/EditCustomTemplateModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export default function MachotesPage() {
  const { activeDocument, setActiveDocument, setContextMode } = useLegalWorkspaceContext();
  const [customTemplates, setCustomTemplates] = useState<ProfessionalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [isAiFillOpen, setIsAiFillOpen] = useState(false);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'generator' | 'my-templates'>('generator');
  const [editingTemplate, setEditingTemplate] = useState<ProfessionalTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      const templates = await getCustomTemplates();
      setCustomTemplates(templates);
    };
    loadTemplates();
  }, []);

  const allTemplates = useMemo(() => {
    return [...customTemplates, ...templates];
  }, [customTemplates]);

  const filteredCustomTemplates = useMemo(() => {
    return customTemplates.filter((t) => {
      const matchesCat = categoryFilter === 'all' || t.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.legalBasis && t.legalBasis.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.originalText && t.originalText.toLowerCase().includes(q))
      );
      return matchesCat && matchesSearch;
    });
  }, [customTemplates, categoryFilter, searchQuery]);

  const selectedTemplate = useMemo(() => {
    return allTemplates.find(t => t.id === selectedTemplateId) || allTemplates[0];
  }, [allTemplates, selectedTemplateId]);

  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    sectionId: string;
    result: AIAssistResult;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [reviewLoading, setReviewLoading] = useState<'fast' | 'deep' | null>(null);
  const [fastReview, setFastReview] = useState<{
    estado: string;
    camposFaltantes: string[];
    erroresFormato: string[];
    recomendaciones: string[];
  } | null>(null);
  const [deepReview, setDeepReview] = useState<{
    revisionLegal: string;
    revisionRedaccion: string;
    revisionProcesal: string;
    riesgos: string[];
  } | null>(null);

  // Group templates by category including custom ones
  const categories = useMemo(() => {
    const cats: Record<string, ProfessionalTemplate[]> = {};
    if (customTemplates.length > 0) {
      cats['📂 Mis Machotes Guardados (Personalizados)'] = customTemplates;
    }
    templates.forEach(t => {
      if (!cats[t.category]) cats[t.category] = [];
      cats[t.category].push(t);
    });
    return cats;
  }, [customTemplates]);

  useEffect(() => {
    setValues({});
    setAiResult(null);
    setFeedback(null);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (activeDocument?.templateId === selectedTemplate.id && activeDocument.fields) {
      setValues((prevValues) => {
        const newValues = { ...activeDocument.fields };
        if (JSON.stringify(prevValues) !== JSON.stringify(newValues)) {
          return newValues;
        }
        return prevValues;
      });
    }
  }, [activeDocument?.templateId, activeDocument?.fields, selectedTemplate.id]);

  useEffect(() => {
    const previewText = renderToText(selectedTemplate, values);
    const validation = validateTemplateValues(selectedTemplate, values);
    setActiveDocument({
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.title,
      documentType: 'machote',
      matter: selectedTemplate.category,
      jurisdiction: 'federal',
      fields: values,
      previewText,
      pendingMarkers: validation.missingFields.map((f) => f.title),
      updatedAt: new Date().toISOString(),
    });
  }, [selectedTemplate, values, setActiveDocument]);

  const getSingleValue = (sectionId: string): string => {
    const value = values[sectionId];
    return Array.isArray(value) ? value.join('\n') : value || '';
  };

  const getRepeatableValue = (sectionId: string): string[] => {
    const value = values[sectionId];
    return Array.isArray(value) ? value : [''];
  };

  const handleValueChange = (sectionId: string, value: string | string[]) => {
    setValues(prev => ({ ...prev, [sectionId]: value }));
    setFeedback(null);
  };

  const handleRepeatableChange = (sectionId: string, index: number, value: string) => {
    const current = Array.isArray(values[sectionId]) ? values[sectionId] : [''];
    const newValues = [...current];
    newValues[index] = value;
    handleValueChange(sectionId, newValues);
  };

  const addRepeatable = (sectionId: string) => {
    const current = Array.isArray(values[sectionId]) ? values[sectionId] : [''];
    handleValueChange(sectionId, [...current, '']);
  };

  const removeRepeatable = (sectionId: string, index: number) => {
    const current = Array.isArray(values[sectionId]) ? values[sectionId] : [''];
    const newValues = current.filter((_, i) => i !== index);
    handleValueChange(sectionId, newValues.length > 0 ? newValues : ['']);
  };

  const handleDocxExport = async () => {
    const validation = validateTemplateValues(selectedTemplate, values);
    if (!validation.valid) {
      setFeedback({
        tone: 'warning',
        message: `Completa ${validation.missingFields.length} campo(s) obligatorio(s) antes de exportar.`,
      });
      return;
    }
    if (hasPendingMarkers(renderToText(selectedTemplate, values))) {
      setConfirmDialog({
        title: 'Borrador con marcadores pendientes',
        message: `${DRAFT_WARNING}. ¿Confirmas que revisarás el documento antes de usarlo?`,
        confirmLabel: 'Confirmar y exportar',
        onConfirm: () => { setConfirmDialog(null); void (async () => {
          try {
            const doc = renderToDocument(selectedTemplate, values);
            const { exportToDocx } = await import('@/lib/templates/exportDocx');
            const buffer = await exportToDocx(doc);
            const blob = new Blob([Uint8Array.from(buffer)], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${selectedTemplate.id}-${new Date().toISOString().slice(0,10)}.docx`;
            anchor.click();
            URL.revokeObjectURL(url);
            setFeedback({ tone: 'success', message: 'El archivo DOCX se generó correctamente.' });
          } catch {
            setFeedback({ tone: 'error', message: 'No fue posible generar el archivo DOCX.' });
          }
        })(); },
      });
      return;
    }
    try {
      const doc = renderToDocument(selectedTemplate, values);
      const { exportToDocx } = await import('@/lib/templates/exportDocx');
      const buffer = await exportToDocx(doc);
      const blob = new Blob([Uint8Array.from(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selectedTemplate.id}-${new Date().toISOString().slice(0,10)}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback({ tone: 'success', message: 'El archivo DOCX se generó correctamente.' });
    } catch {
      setFeedback({ tone: 'error', message: 'No fue posible generar el archivo DOCX.' });
    }
  };

  const handlePdfExport = () => {
    const validation = validateTemplateValues(selectedTemplate, values);
    if (!validation.valid) {
      setFeedback({
        tone: 'warning',
        message: `Completa ${validation.missingFields.length} campo(s) obligatorio(s) antes de imprimir.`,
      });
      return;
    }
    if (hasPendingMarkers(renderToText(selectedTemplate, values))) {
      setConfirmDialog({
        title: 'Borrador con marcadores pendientes',
        message: `${DRAFT_WARNING}. ¿Confirmas que revisarás el documento antes de usarlo?`,
        confirmLabel: 'Confirmar e imprimir',
        onConfirm: () => { setConfirmDialog(null); const doc2 = renderToDocument(selectedTemplate, values); const html2 = generatePrintHtml(doc2); const win2 = window.open('', '_blank'); if (win2) { win2.document.write(html2); win2.document.close(); setFeedback({ tone: 'success', message: 'Se abrió la vista controlada de impresión.' }); } else { setFeedback({ tone: 'error', message: 'El navegador bloqueó la vista de impresión. Permite ventanas emergentes e intenta de nuevo.' }); } },
      });
      return;
    }
    const doc = renderToDocument(selectedTemplate, values);
    const html = generatePrintHtml(doc);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setFeedback({ tone: 'success', message: 'Se abrió la vista controlada de impresión.' });
    } else {
      setFeedback({
        tone: 'error',
        message: 'El navegador bloqueó la vista de impresión. Permite ventanas emergentes e intenta de nuevo.',
      });
    }
  };

  const handleTextExport = () => {
    const validation = validateTemplateValues(selectedTemplate, values);
    if (!validation.valid) {
      setFeedback({
        tone: 'warning',
        message: `Completa ${validation.missingFields.length} campo(s) obligatorio(s) antes de exportar.`,
      });
      return;
    }
    if (hasPendingMarkers(renderToText(selectedTemplate, values))) {
      setConfirmDialog({
        title: 'Borrador con marcadores pendientes',
        message: `${DRAFT_WARNING}. ¿Confirmas que revisarás el documento antes de usarlo?`,
        confirmLabel: 'Confirmar y exportar TXT',
        onConfirm: () => { setConfirmDialog(null); const txt = renderToText(selectedTemplate, values); const blobTxt = new Blob([txt], { type: 'text/plain;charset=utf-8' }); const urlTxt = URL.createObjectURL(blobTxt); const aTxt = document.createElement('a'); aTxt.href = urlTxt; aTxt.download = `${selectedTemplate.id}-${new Date().toISOString().slice(0,10)}.txt`; aTxt.click(); URL.revokeObjectURL(urlTxt); setFeedback({ tone: 'success', message: 'El archivo de texto se generó correctamente.' }); },
      });
      return;
    }
    const text = renderToText(selectedTemplate, values);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate.id}-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ tone: 'success', message: 'El archivo de texto se generó correctamente.' });
  };

  const handleCopyText = async () => {
    const validation = validateTemplateValues(selectedTemplate, values);
    if (!validation.valid) {
      setFeedback({
        tone: 'warning',
        message: `Completa ${validation.missingFields.length} campo(s) obligatorio(s) antes de copiar.`,
      });
      return;
    }
    if (hasPendingMarkers(renderToText(selectedTemplate, values))) {
      setConfirmDialog({
        title: 'Borrador con marcadores pendientes',
        message: `${DRAFT_WARNING}. ¿Confirmas que revisarás el texto antes de usarlo?`,
        confirmLabel: 'Confirmar y copiar',
        onConfirm: () => { setConfirmDialog(null); const copyText = renderToText(selectedTemplate, values); navigator.clipboard.writeText(copyText).then(() => setFeedback({ tone: 'success', message: 'Texto copiado al portapapeles.' })).catch(() => setFeedback({ tone: 'error', message: 'No fue posible copiar el texto.' })); },
      });
      return;
    }
    const text = renderToText(selectedTemplate, values);
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ tone: 'success', message: 'Texto copiado al portapapeles.' });
    } catch {
      setFeedback({ tone: 'error', message: 'No fue posible copiar el texto.' });
    }
  };

  const handleAIAssist = async (sectionId: string) => {
    const instruction = Array.isArray(values[sectionId])
      ? values[sectionId].join('\n').trim()
      : (values[sectionId] || '').trim();
    if (!instruction) {
      setFeedback({
        tone: 'warning',
        message: 'Escribe primero hechos o instrucciones concretas para desarrollar esta sección.',
      });
      return;
    }
    setAiLoading(sectionId);
    setFeedback(null);
    try {
      const res = await adminFetch('/api/templates/ai-assist', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          sectionId,
          userInput: instruction,
          caseContext: values
        }),
      });
      const data = (await res.json()) as AIAssistResult | { error?: string };
      if (!res.ok || !('proposedText' in data)) {
        throw new Error('error' in data ? data.error : undefined);
      }
      setAiResult({ sectionId, result: data });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error && error.message === 'ADMIN_TOKEN_REQUIRED'
            ? 'Ingresa el token administrativo para usar la asistencia IA.'
            : error instanceof Error && error.message
            ? error.message
            : 'No fue posible generar la propuesta asistida.',
      });
    } finally {
      setAiLoading(null);
    }
  };

  const applyAIResult = (sectionId: string, content: string) => {
    const isRepeatable = selectedTemplate.sections.find(s => s.id === sectionId)?.type === 'repeatable';
    if (isRepeatable) {
      handleValueChange(sectionId, [content]);
    } else {
      handleValueChange(sectionId, content);
    }
    setAiResult(null);
  };

  const renderedText = renderToText(selectedTemplate, values);
  const hasDraftMarkers = hasPendingMarkers(renderedText);

  const aiEnabledSections = new Set([
    'hechos',
    'conceptos_violacion',
    'agravios',
    'pruebas',
    'puntos_petitorios',
  ]);

  const currentStructureJson = useMemo(() => {
    if (selectedTemplate.structureJson) return selectedTemplate.structureJson;
    return {
      nombre: selectedTemplate.title,
      tipo_documento: selectedTemplate.documentType || 'documento_juridico',
      campos: selectedTemplate.sections.map((section) => ({
        id: section.id,
        etiqueta: section.title,
        tipo: section.type,
        obligatorio: section.required,
        placeholder: section.placeholder,
        helpText: section.helpText,
        options: section.options,
        repeatLabel: section.repeatLabel,
      })),
    };
  }, [selectedTemplate]);

  const handleLoadSample = () => {
    const sampleData = getSampleValuesForTemplate(selectedTemplate.id);
    setValues(sampleData);
    setContextMode('current_document');
    setFeedback({
      tone: 'success',
      message: `Se cargó la plantilla con información jurídica de ejemplo realista para ${selectedTemplate.title}. Ya puedes revisar, copiar o exportar el documento.`,
    });
  };

  useEffect(() => {
    const handleEvent = () => handleLoadSample();
    window.addEventListener('fill-sample-data', handleEvent);
    return () => window.removeEventListener('fill-sample-data', handleEvent);
  }, [selectedTemplate.id]);

  const handleFastReview = async () => {
    setReviewLoading('fast');
    setFastReview(null);
    setDeepReview(null);
    setFeedback(null);

    try {
      const response = await fetch('/api/templates/review-fast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          values,
          structureJson: currentStructureJson,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al ejecutar la revisión rápida.');
      }
      setFastReview(data);
      setFeedback({ tone: 'success', message: 'Revisión rápida completada.' });
    } catch (error: any) {
      setFeedback({ tone: 'error', message: error.message || 'No se pudo ejecutar la revisión rápida.' });
    } finally {
      setReviewLoading(null);
    }
  };

  const handleDeepReview = async () => {
    setReviewLoading('deep');
    setDeepReview(null);
    setFastReview(null);
    setFeedback(null);

    try {
      const response = await fetch('/api/templates/review-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          values,
          structureJson: currentStructureJson,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al ejecutar la revisión profunda.');
      }
      setDeepReview(data);
      setFeedback({ tone: 'success', message: 'Revisión profunda completada.' });
    } catch (error: any) {
      setFeedback({ tone: 'error', message: error.message || 'No se pudo ejecutar la revisión profunda.' });
    } finally {
      setReviewLoading(null);
    }
  };

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell">
        <nav className="document-nav">
          <Link href="/legal-hub">Volver al Centro Jurídico</Link>
        </nav>

        <header className="machotes-page-header">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1>Generador de Machotes y Plantillas</h1>
              <p className="subtitle">Crea documentos legales estructurados con asistencia de IA. Revisa siempre el documento final. Puedes probar cualquier plantilla con un ejemplo listo para cargar y exportar.</p>
            </div>
            <div className="machote-actions-bar">
              <button
                type="button"
                onClick={() => setIsAiFillOpen(true)}
                className="machote-btn-primary"
              >
                ✨ Autollenar con IA (Texto / PDF)
              </button>
              <button
                type="button"
                onClick={() => setIsSaveCustomOpen(true)}
                className="machote-btn-secondary"
              >
                📥 Subir Mi Machote
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="machote-btn-secondary"
              >
                📋 Cargar Ejemplo
              </button>
              <button
                type="button"
                onClick={handleFastReview}
                disabled={reviewLoading === 'fast'}
                className="machote-btn-secondary"
              >
                {reviewLoading === 'fast' ? 'Revisando...' : '⚡ Revisión Rápida'}
              </button>
              <button
                type="button"
                onClick={handleDeepReview}
                disabled={reviewLoading === 'deep'}
                className="machote-btn-secondary"
              >
                {reviewLoading === 'deep' ? 'Revisando...' : '🧠 Revisión Profunda (3 IA)'}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('generator')}
              className={activeTab === 'generator' ? 'machote-btn-primary' : 'machote-btn-secondary'}
              style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}
            >
              📄 Generador de Escritos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my-templates')}
              className={activeTab === 'my-templates' ? 'machote-btn-primary' : 'machote-btn-secondary'}
              style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}
            >
              📂 Mis Plantillas ({customTemplates.length})
            </button>
          </div>
        </header>

        <SaveCustomTemplateModal
          isOpen={isSaveCustomOpen}
          onClose={() => setIsSaveCustomOpen(false)}
          onTemplateCreated={(newTemplate) => {
            setCustomTemplates((prev) => [newTemplate, ...prev.filter(t => t.id !== newTemplate.id)]);
            setSelectedTemplateId(newTemplate.id);
            setFeedback({ tone: 'success', message: `Tu machote "${newTemplate.title}" se guardó y está listo para usarse.` });
          }}
        />

        <EditCustomTemplateModal
          template={editingTemplate}
          isOpen={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onTemplateUpdated={(updated) => {
            setCustomTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            if (selectedTemplateId === updated.id) {
              // Trigger re-render of current active template if selected
              setSelectedTemplateId('');
              setTimeout(() => setSelectedTemplateId(updated.id), 10);
            }
            setFeedback({ tone: 'success', message: `Plantilla "${updated.title}" actualizada correctamente.` });
          }}
        />

        <AiFillModal
          isOpen={isAiFillOpen}
          onClose={() => setIsAiFillOpen(false)}
          templateName={selectedTemplate.title}
          templateSections={selectedTemplate.sections}
          currentFields={values}
          onApplyFields={(newFields) => {
            setValues((prev) => ({ ...prev, ...newFields }));
            setFeedback({ tone: "success", message: `Se aplicaron ${Object.keys(newFields).length} campos detectados.` });
          }}
        />

        {activeTab === 'generator' && (
          <>
            <div className="machote-template-toolbar">
          <div className="machote-template-select">
            <label htmlFor="template-selector">Seleccionar plantilla</label>
            <select
              id="template-selector"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              {Object.entries(categories).map(([category, temps]) => (
                <optgroup key={category} label={category}>
                  {temps.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="machote-template-summary">
            <strong>{selectedTemplate.title}</strong>
            <span>{selectedTemplate.description}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Fundamento: {selectedTemplate.legalBasis}</span>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="machote-status-pill">
              {selectedTemplate.id.startsWith('custom-') ? 'Personalizado' : 'En revisión'}
            </div>
            {selectedTemplate.id.startsWith('custom-') && (
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog({
                    title: 'Eliminar machote',
                    message: `¿Seguro que deseas eliminar tu machote "${selectedTemplate.title}"? Esta acción no se puede deshacer.`,
                    confirmLabel: 'Eliminar',
                    isDanger: true,
                    onConfirm: async () => {
                      setConfirmDialog(null);
                      try {
                        const updated = await deleteCustomTemplate(selectedTemplate.id);
                        setCustomTemplates(updated);
                        setSelectedTemplateId(templates[0].id);
                        setFeedback({ tone: 'success', message: 'Se eliminó tu machote personalizado.' });
                      } catch {
                        setFeedback({ tone: 'error', message: 'No fue posible eliminar el machote personalizado.' });
                      }
                    },
                  });
                }}
                className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
              >
                🗑️ Eliminar este machote
              </button>
            )}
          </div>
        </div>

        <div className="legal-warning" style={{ marginBottom: '1.5rem' }}>
          <strong>ADVERTENCIA PROFESIONAL:</strong> {selectedTemplate.disclaimer}
          {selectedTemplate.warnings && selectedTemplate.warnings.length > 0 && (
            <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
              {selectedTemplate.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>

        {hasDraftMarkers && (
          <div className="legal-warning" role="alert" style={{ marginBottom: '1.5rem' }}>
            <strong>{DRAFT_WARNING}</strong>. El contenido contiene marcadores pendientes y no debe presentarse sin validación profesional.
          </div>
        )}

        {feedback && (
          <div
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            className="glass-card"
            style={{ marginBottom: '1rem', padding: '0.875rem 1rem' }}
          >
            {feedback.message}
          </div>
        )}
        {fastReview && (
          <div className="glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <h3>Resultado Revisión Rápida</h3>
            <p>Estado: <strong>{fastReview.estado}</strong></p>
            {fastReview.camposFaltantes.length > 0 && (
              <p>Campos faltantes: {fastReview.camposFaltantes.join(', ')}</p>
            )}
            {fastReview.erroresFormato.length > 0 && (
              <div>
                <p>Errores de formato:</p>
                <ul>{fastReview.erroresFormato.map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
            {fastReview.recomendaciones.length > 0 && (
              <div>
                <p>Recomendaciones:</p>
                <ul>{fastReview.recomendaciones.map((rec, idx) => <li key={idx}>{rec}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        {deepReview && (
          <div className="glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <h3>Resultado Revisión Profunda</h3>
            <div>
              <p><strong>Revisión legal</strong></p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{deepReview.revisionLegal}</p>
            </div>
            <div>
              <p><strong>Revisión de redacción</strong></p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{deepReview.revisionRedaccion}</p>
            </div>
            <div>
              <p><strong>Revisión procesal</strong></p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{deepReview.revisionProcesal}</p>
            </div>
            {deepReview.riesgos.length > 0 && (
              <div>
                <p>Riesgos identificados:</p>
                <ul>{deepReview.riesgos.map((risk, idx) => <li key={idx}>{risk}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <div className="machotes-workspace">
          {/* Editor Form */}
          <div className="machote-panel machote-form-panel">
            <div className="machote-panel-heading">
              <h2>Campos obligatorios y opcionales</h2>
              <p>Llene los campos requeridos para generar el documento.</p>
            </div>

            <div className="machote-fields">
              {selectedTemplate.sections.map(section => {
                const canUseAI = aiEnabledSections.has(section.id);

                return (
                  <div key={section.id} className="machote-field">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <label htmlFor={`field-${section.id}`}>
                        {section.title} {section.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                      </label>
                      {canUseAI && (
                        <button
                          type="button"
                          onClick={() => handleAIAssist(section.id)}
                          disabled={aiLoading === section.id}
                          className="btn-doc-secondary"
                          style={{ marginLeft: 'auto', minHeight: '44px', padding: '0 0.75rem', fontSize: '0.75rem' }}
                        >
                          {aiLoading === section.id ? 'Generando...' : 'Desarrollar con IA'}
                        </button>
                      )}
                    </div>

                    {aiResult?.sectionId === section.id && (
                      <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid #6366f1', borderRadius: '4px', marginBottom: '0.5rem' }}>
                        <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}><strong>Texto propuesto:</strong></p>
                        <p style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', marginBottom: '0.5rem' }}>{aiResult.result.proposedText}</p>
                        {aiResult.result.sourcesUsed.length > 0 && (
                          <>
                            <p style={{ fontSize: '0.8rem' }}><strong>Fuentes utilizadas:</strong></p>
                            <ul style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                              {aiResult.result.sourcesUsed.map((source) => (
                                <li key={source.sourceId}>
                                  <a href={source.url} target="_blank" rel="noreferrer">
                                    {source.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        {aiResult.result.pendingElements.length > 0 && (
                          <>
                            <p style={{ fontSize: '0.8rem' }}><strong>Elementos pendientes:</strong></p>
                            <ul style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                              {aiResult.result.pendingElements.map((item, index) => (
                                <li key={`${item}-${index}`}>{item}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {aiResult.result.warnings.length > 0 && (
                          <>
                            <p style={{ fontSize: '0.8rem' }}><strong>Advertencias:</strong></p>
                            <ul style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                              {aiResult.result.warnings.map((item, index) => (
                                <li key={`${item}-${index}`}>{item}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        <p style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                          Nivel de confianza: <strong>{aiResult.result.confidenceLevel}</strong>
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={() => applyAIResult(section.id, aiResult.result.proposedText)} className="btn-doc-primary" style={{ minHeight: '44px', padding: '0 0.75rem', fontSize: '0.75rem' }}>Aplicar</button>
                          <button type="button" onClick={() => setAiResult(null)} className="btn-doc-secondary" style={{ minHeight: '44px', padding: '0 0.75rem', fontSize: '0.75rem' }}>Descartar</button>
                        </div>
                      </div>
                    )}

                    {section.type === 'text' && (
                      <input
                        id={`field-${section.id}`}
                        type="text"
                        placeholder={section.placeholder}
                        value={getSingleValue(section.id)}
                        onChange={(e) => handleValueChange(section.id, e.target.value)}
                      />
                    )}

                    {section.type === 'textarea' && (
                      <textarea
                        id={`field-${section.id}`}
                        placeholder={section.placeholder}
                        value={getSingleValue(section.id)}
                        onChange={(e) => handleValueChange(section.id, e.target.value)}
                        rows={5}
                        className="legal-preview-editor"
                      />
                    )}

                    {section.type === 'date' && (
                      <input
                        id={`field-${section.id}`}
                        type="date"
                        value={getSingleValue(section.id)}
                        onChange={(e) => handleValueChange(section.id, e.target.value)}
                      />
                    )}

                    {section.type === 'number' && (
                      <input
                        id={`field-${section.id}`}
                        type="number"
                        placeholder={section.placeholder}
                        value={getSingleValue(section.id)}
                        onChange={(e) => handleValueChange(section.id, e.target.value)}
                      />
                    )}

                    {section.type === 'select' && section.options && (
                      <select
                        id={`field-${section.id}`}
                        value={getSingleValue(section.id)}
                        onChange={(e) => handleValueChange(section.id, e.target.value)}
                      >
                        <option value="">Seleccione una opción...</option>
                        {section.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {section.type === 'repeatable' && (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {getRepeatableValue(section.id).map((val: string, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                            <textarea
                              value={val}
                              onChange={(e) => handleRepeatableChange(section.id, idx, e.target.value)}
                              placeholder={section.placeholder || '...'}
                              rows={3}
                              className="legal-preview-editor"
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => removeRepeatable(section.id, idx)}
                              className="btn-doc-secondary"
                              style={{ padding: '0 0.5rem', height: 'fit-content' }}
                              title="Eliminar"
                            >
                              X
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addRepeatable(section.id)}
                          className="btn-doc-secondary"
                          style={{ justifySelf: 'start', fontSize: '0.8rem', padding: '0.25rem 0.75rem', minHeight: '32px' }}
                        >
                          + {section.repeatLabel || 'Agregar'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="machote-preview-panel glass-card" style={{ padding: '1.5rem' }}>
            <div className="machote-preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Vista previa</h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleDocxExport} className="btn-doc-primary" style={{ minHeight: '44px', fontSize: '0.85rem' }}>Descargar DOCX</button>
                <button type="button" onClick={handlePdfExport} className="btn-doc-secondary" style={{ minHeight: '44px', fontSize: '0.85rem' }}>Abrir impresión</button>
                <button type="button" onClick={handleTextExport} className="btn-doc-secondary" style={{ minHeight: '44px', fontSize: '0.85rem' }}>Texto plano</button>
                <button type="button" onClick={handleCopyText} className="btn-doc-secondary" style={{ minHeight: '44px', fontSize: '0.85rem' }}>Copiar</button>
              </div>
            </div>

            <div
              className="machote-document-paper"
              role="document"
              aria-label="Vista previa del documento jurídico"
              suppressHydrationWarning
            >
              {renderedText || 'Complete el formulario para ver la previsualización del documento.'}
            </div>
          </div>
        </div>
          </>
        )}

        {/* My Templates Tab View */}
        {activeTab === 'my-templates' && (
          <div className="my-templates-container" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar por nombre, categoría, fundamento o contenido..."
                className="machote-input-control"
                style={{ flex: 1, minWidth: '250px' }}
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="machote-input-control"
                style={{ width: '220px' }}
              >
                <option value="all">Todas las materias</option>
                <option value="Amparo">Amparo</option>
                <option value="Civil">Civil</option>
                <option value="Familiar">Familiar</option>
                <option value="Mercantil">Mercantil</option>
                <option value="Administrativo/Fiscal">Administrativo/Fiscal</option>
                <option value="General">General</option>
              </select>
            </div>

            {filteredCustomTemplates.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                  {customTemplates.length === 0
                    ? 'Aún no tienes plantillas personalizadas guardadas.'
                    : 'No se encontraron plantillas con los filtros seleccionados.'}
                </p>
                <button
                  type="button"
                  onClick={() => setIsSaveCustomOpen(true)}
                  className="machote-btn-primary"
                >
                  📥 Subir Mi Primera Plantilla
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {filteredCustomTemplates.map((t) => (
                  <div key={t.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span className="machote-status-pill" style={{ fontSize: '0.75rem' }}>{t.category}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('es-MX') : ''}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t.title}</h3>
                      {t.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{t.description}</p>}
                      {t.legalBasis && <p style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '0.5rem' }}>⚖️ {t.legalBasis}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(t.id);
                          setActiveTab('generator');
                        }}
                        className="machote-btn-primary"
                        style={{ flex: 1, fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                      >
                        🚀 Usar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTemplate(t)}
                        className="machote-btn-secondary"
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.65rem' }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDialog({
                            title: 'Eliminar plantilla',
                            message: `¿Seguro que deseas eliminar la plantilla "${t.title}"? Esta acción no se puede deshacer.`,
                            confirmLabel: 'Eliminar',
                            isDanger: true,
                            onConfirm: async () => {
                              setConfirmDialog(null);
                              try {
                                const updated = await deleteCustomTemplate(t.id);
                                setCustomTemplates(updated);
                                setFeedback({ tone: 'success', message: 'Plantilla eliminada.' });
                              } catch {
                                setFeedback({ tone: 'error', message: 'No fue posible eliminar la plantilla.' });
                              }
                            },
                          });
                        }}
                        className="machote-btn-secondary"
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.65rem', color: '#f87171' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      {confirmDialog && (
        <ConfirmDialog
          isOpen
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDanger={confirmDialog.isDanger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}
