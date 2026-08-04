"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch, getAdminToken, setAdminToken } from '@/lib/client/adminToken';
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

export default function MachotesPage() {
  const { setActiveDocument } = useLegalWorkspaceContext();
  const [customTemplates, setCustomTemplates] = useState<ProfessionalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [isAiFillOpen, setIsAiFillOpen] = useState(false);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);

  useEffect(() => {
    setCustomTemplates(getCustomTemplates());
  }, []);

  const allTemplates = useMemo(() => {
    return [...customTemplates, ...templates];
  }, [customTemplates]);

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
    if (hasPendingMarkers(renderToText(selectedTemplate, values)) && !window.confirm(`${DRAFT_WARNING}. ¿Confirmas que revisarás el documento antes de usarlo?`)) return;
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
    if (hasPendingMarkers(renderToText(selectedTemplate, values)) && !window.confirm(`${DRAFT_WARNING}. ¿Confirmas que revisarás el documento antes de usarlo?`)) return;
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
    if (hasPendingMarkers(renderToText(selectedTemplate, values)) && !window.confirm(`${DRAFT_WARNING}. ¿Confirmas que revisarás el documento antes de usarlo?`)) return;
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
    if (hasPendingMarkers(renderToText(selectedTemplate, values)) && !window.confirm(`${DRAFT_WARNING}. ¿Confirmas que revisarás el texto antes de usarlo?`)) return;
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
      let token = getAdminToken();
      if (!token) {
        const entered = window.prompt('Ingresa el token administrativo para usar la asistencia IA:');
        if (entered === null) throw new Error('ADMIN_TOKEN_REQUIRED');
        token = setAdminToken(entered);
      }
      if (!token) throw new Error('ADMIN_TOKEN_REQUIRED');
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

  const handleLoadSample = () => {
    const sampleData = getSampleValuesForTemplate(selectedTemplate.id);
    setValues(sampleData);
    setFeedback({
      tone: 'success',
      message: `Se cargó la plantilla con información jurídica de ejemplo realista para ${selectedTemplate.title}.`,
    });
  };

  useEffect(() => {
    const handleEvent = () => handleLoadSample();
    window.addEventListener('fill-sample-data', handleEvent);
    return () => window.removeEventListener('fill-sample-data', handleEvent);
  }, [selectedTemplate.id]);

  const triggerQuickReview = () => {
    window.dispatchEvent(new CustomEvent('open-legal-chat', {
      detail: { executionMode: 'fast', query: 'revisa el machote que acabo de crear' }
    }));
  };

  const triggerDeepReview = () => {
    window.dispatchEvent(new CustomEvent('open-legal-chat', {
      detail: { executionMode: 'deep', query: 'revisión profunda del machote actual' }
    }));
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
              <p className="subtitle">Crea documentos legales estructurados con asistencia de IA. Revisa siempre el documento final.</p>
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
                onClick={triggerQuickReview}
                className="machote-btn-secondary"
              >
                ⚡ Revisión Rápida
              </button>
              <button
                type="button"
                onClick={triggerDeepReview}
                className="machote-btn-secondary"
              >
                🧠 Revisión Profunda (3 IA)
              </button>
            </div>
          </div>
        </header>

        <SaveCustomTemplateModal
          isOpen={isSaveCustomOpen}
          onClose={() => setIsSaveCustomOpen(false)}
          onTemplateCreated={(newTemplate) => {
            setCustomTemplates(getCustomTemplates());
            setSelectedTemplateId(newTemplate.id);
            setFeedback({ tone: 'success', message: `Tu machote "${newTemplate.title}" se guardó y está listo para usarse.` });
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
                  if (window.confirm(`¿Seguro que deseas eliminar tu machote "${selectedTemplate.title}"?`)) {
                    const updated = deleteCustomTemplate(selectedTemplate.id);
                    setCustomTemplates(updated);
                    setSelectedTemplateId(templates[0].id);
                    setFeedback({ tone: 'success', message: 'Se eliminó tu machote personalizado.' });
                  }
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
      </main>
    </>
  );
}
