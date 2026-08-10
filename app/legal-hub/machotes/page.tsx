"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/client/adminToken';
import { templates } from '@/lib/templates/templateDefinitions';
import type {
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
import { getCustomTemplates, deleteCustomTemplate, createTemplateFromText, saveCustomTemplate } from '@/lib/templates/customTemplateStore';
import { SaveCustomTemplateModal } from '@/components/machotes/SaveCustomTemplateModal';
import { EditCustomTemplateModal } from '@/components/machotes/EditCustomTemplateModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { FastReviewResponse, DeepReviewResponse } from '@/lib/templates/templateReview';

export default function MachotesPage() {
  const { activeDocument, setActiveDocument, setContextMode } = useLegalWorkspaceContext();
  const [customTemplates, setCustomTemplates] = useState<ProfessionalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [isAiFillOpen, setIsAiFillOpen] = useState(false);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'generator' | 'my-templates' | 'contestations'>('generator');
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

  // States for Contestations & Resources Tab
  const [resourceType, setResourceType] = useState('Amparo Directo en Revisión (SCJN)');
  const [expedienteOrigen, setExpedienteOrigen] = useState('');
  const [tribunalEmisor, setTribunalEmisor] = useState('');
  const [fechaResolucion, setFechaResolucion] = useState('');
  const [magistradoPonente, setMagistradoPonente] = useState('');
  const [contestationDocumentText, setContestationDocumentText] = useState('');
  const [contestationPrompt, setContestationPrompt] = useState('A mi archivo dame una contestación / recurso de revisión extraordinaria ante la sentencia de un amparo directo');
  const [contestationLoading, setContestationLoading] = useState(false);
  const [contestationResult, setContestationResult] = useState<{
    title: string;
    text: string;
    summary?: string;
  } | null>(null);
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null);

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
        (t.description && t.description.toLowerCase().includes(q))
      );
      return matchesCat && matchesSearch;
    });
  }, [customTemplates, categoryFilter, searchQuery]);

  const selectedTemplate = useMemo(() => {
    return allTemplates.find((t) => t.id === selectedTemplateId) || allTemplates[0] || templates[0];
  }, [allTemplates, selectedTemplateId]);

  const [values, setValues] = useState<Record<string, any>>({});
  const [assistLoading, setAssistLoading] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState<'fast' | 'deep' | null>(null);
  const [fastReview, setFastReview] = useState<FastReviewResponse | null>(null);
  const [deepReview, setDeepReview] = useState<DeepReviewResponse | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    const initialValues: Record<string, any> = {};
    selectedTemplate.sections.forEach((section) => {
      if (section.type === 'repeatable' || section.type === 'list') {
        initialValues[section.id] = [];
      } else {
        initialValues[section.id] = '';
      }
    });
    setValues(initialValues);
    setFastReview(null);
    setDeepReview(null);
    setFeedback(null);
  }, [selectedTemplate]);

  const renderedText = useMemo(() => {
    return renderToText(selectedTemplate, values);
  }, [selectedTemplate, values]);

  const validation = useMemo(() => {
    return validateTemplateValues(selectedTemplate, values);
  }, [selectedTemplate, values]);

  const currentStructureJson = useMemo(() => {
    return {
      nombre: selectedTemplate.title,
      tipo_documento: selectedTemplate.documentType || 'machote',
      campos: selectedTemplate.sections.map((sec) => ({
        id: sec.id,
        etiqueta: sec.title,
        tipo: sec.type,
        obligatorio: !!sec.required,
        placeholder: sec.placeholder,
        helpText: sec.helpText,
        options: sec.options,
        repeatLabel: sec.repeatLabel,
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

      setDeepReview({
        revisionLegal: data.revisionLegal,
        revisionRedaccion: data.revisionRedaccion,
        revisionProcesal: data.revisionProcesal,
        riesgos: data.riesgos,
      });
      setFeedback({ tone: 'success', message: 'Revisión profunda por 3 modelos completada.' });
    } catch (error: any) {
      setFeedback({ tone: 'error', message: error.message || 'No se pudo ejecutar la revisión profunda.' });
    } finally {
      setReviewLoading(null);
    }
  };

  const handleAssistSection = async (fieldId: string, instruction: string) => {
    setAssistLoading(fieldId);
    setFeedback(null);
    try {
      const response = await adminFetch('/api/templates/ai-assist', {
        method: 'POST',
        body: JSON.stringify({
          fieldId,
          instruction,
          currentValue: values[fieldId],
          contextFields: values,
          templateId: selectedTemplate.id,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No fue posible desarrollar con IA.');
      }

      const generated = (data.text || '').trim();
      if (!generated) {
        throw new Error('La IA devolvió una respuesta vacía.');
      }

      setValues((prev) => {
        const currentVal = prev[fieldId];
        if (Array.isArray(currentVal)) {
          return {
            ...prev,
            [fieldId]: [...currentVal, generated],
          };
        }
        return {
          ...prev,
          [fieldId]: currentVal ? `${currentVal}\n\n${generated}` : generated,
        };
      });

      setFeedback({
        tone: 'success',
        message: `Se aplicó la sugerencia de IA para el apartado.`,
      });
    } catch (error: any) {
      setFeedback({
        tone: 'error',
        message: error.message || 'Error al solicitar asistencia de IA.',
      });
    } finally {
      setAssistLoading(null);
    }
  };

  const handleInputChange = (fieldId: string, value: any) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleListAdd = (fieldId: string) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), ''],
    }));
  };

  const handleListChange = (fieldId: string, index: number, val: string) => {
    setValues((prev) => {
      const list = [...(prev[fieldId] || [])];
      list[index] = val;
      return {
        ...prev,
        [fieldId]: list,
      };
    });
  };

  const handleListRemove = (fieldId: string, index: number) => {
    setValues((prev) => {
      const list = [...(prev[fieldId] || [])];
      list.splice(index, 1);
      return {
        ...prev,
        [fieldId]: list,
      };
    });
  };

  const handleCopyText = () => {
    if (!validation.valid) {
      setConfirmDialog({
        title: 'Documento incompleto',
        message: `El documento contiene ${validation.missingFields.length} campo(s) obligatorio(s) pendiente(s). ¿Deseas copiar de todas formas?`,
        confirmLabel: 'Confirmar y copiar',
        onConfirm: () => {
          setConfirmDialog(null);
          navigator.clipboard.writeText(renderedText);
          setFeedback({ tone: 'success', message: 'Copiado al portapapeles con advertencia de campos pendientes.' });
        },
      });
      return;
    }

    navigator.clipboard.writeText(renderedText);
    setFeedback({ tone: 'success', message: 'Documento copiado al portapapeles.' });
  };

  const handleExportDocx = async () => {
    if (!validation.valid) {
      setConfirmDialog({
        title: 'Documento incompleto',
        message: `Completa ${validation.missingFields.length} campo(s) obligatorio(s) antes de exportar.`,
        confirmLabel: 'Confirmar y exportar',
        onConfirm: async () => {
          setConfirmDialog(null);
          try {
            const doc = renderToDocument(selectedTemplate, values);
            const { exportToDocx } = await import('@/lib/templates/exportDocx');
            const buffer = await exportToDocx(doc);
            const blob = new Blob([buffer as any], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedTemplate.id}_${Date.now()}.docx`;
            a.click();
            URL.revokeObjectURL(url);
            setFeedback({ tone: 'success', message: 'Documento DOCX exportado.' });
          } catch {
            setFeedback({ tone: 'error', message: 'Ocurrió un error al exportar el archivo DOCX.' });
          }
        },
      });
      return;
    }

    try {
      const doc = renderToDocument(selectedTemplate, values);
      const { exportToDocx } = await import('@/lib/templates/exportDocx');
      const buffer = await exportToDocx(doc);
      const blob = new Blob([buffer as any], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.id}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({ tone: 'success', message: 'Documento DOCX exportado.' });
    } catch {
      setFeedback({ tone: 'error', message: 'Ocurrió un error al exportar el archivo DOCX.' });
    }
  };

  const handleExportTxt = () => {
    if (!validation.valid) {
      setConfirmDialog({
        title: 'Documento incompleto',
        message: `Completa ${validation.missingFields.length} campo(s) obligatorio(s) antes de exportar TXT.`,
        confirmLabel: 'Confirmar y exportar TXT',
        onConfirm: () => {
          setConfirmDialog(null);
          const blob = new Blob([renderedText], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedTemplate.id}_${Date.now()}.txt`;
          a.click();
          URL.revokeObjectURL(url);
          setFeedback({ tone: 'success', message: 'Documento TXT exportado.' });
        },
      });
      return;
    }

    const blob = new Blob([renderedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate.id}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ tone: 'success', message: 'Documento TXT exportado.' });
  };

  const handlePrint = () => {
    const docData = renderToDocument(selectedTemplate, values);
    const html = generatePrintHtml(docData);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  // Contestations & Resources Handlers
  const handleGenerateContestation = async () => {
    const docText = contestationDocumentText.trim() || renderedText;
    if (!docText) {
      setFeedback({ tone: 'warning', message: 'Por favor pega el texto de tu documento o selecciona un machote como base.' });
      return;
    }
    if (!contestationPrompt.trim()) {
      setFeedback({ tone: 'warning', message: 'Escribe o selecciona una indicación para la IA.' });
      return;
    }

    setContestationLoading(true);
    setFeedback(null);
    try {
      const fullPrompt = `
TIPO DE RECURSO / CONTESTACIÓN: ${resourceType}
DATOS DE ORIGEN DE TU EXPEDIENTE:
- Expediente de origen: ${expedienteOrigen || 'Verificar en autos'}
- Tribunal / Autoridad emisora: ${tribunalEmisor || 'Verificar en autos'}
- Fecha de resolución: ${fechaResolucion || 'Verificar fecha'}
- Magistrado ponente / Autoridad: ${magistradoPonente || 'Verificar ponente'}

INSTRUCCIÓN ESPECÍFICA:
${contestationPrompt.trim()}

DOCUMENTO BASE DE LA SENTENCIA O DEMANDA:
${docText.slice(0, 12000)}
`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullPrompt,
          mode: 'deep',
          taskType: 'document_review',
          activeDocument: {
            templateName: `${resourceType} - ${expedienteOrigen || 'Origen'}`,
            content: docText.slice(0, 10000),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Error al generar la contestación con IA.');
      }

      let generatedText = '';
      if (payload.data?.summary) {
        generatedText += payload.data.summary + '\n\n';
      }
      if (payload.data?.suggestedText) {
        generatedText += payload.data.suggestedText + '\n\n';
      }
      if (payload.data?.issues?.length) {
        const issuesText = payload.data.issues.map((i: any) => `• ${i.title}: ${i.suggestedText || i.explanation}`).join('\n');
        if (!generatedText.includes(issuesText)) {
          generatedText += '--- OBSERVACIONES Y AGRAVIOS CLAVE ---\n' + issuesText + '\n\n';
        }
      }
      if (!generatedText) {
        generatedText = typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data, null, 2);
      }

      setContestationResult({
        title: `${resourceType} - ${expedienteOrigen || 'Expediente'}`,
        text: generatedText.trim(),
        summary: payload.data?.summary || 'Recurso / Contestación generado exitosamente.',
      });
      setFeedback({ tone: 'success', message: '¡Recurso / Contestación legal proyectado con éxito por la IA!' });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Ocurrió un error al procesar con IA.' });
    } finally {
      setContestationLoading(false);
    }
  };

  const handleSaveContestationAsTemplate = async () => {
    if (!contestationResult?.text) return;
    try {
      const title = `${resourceType} - ${expedienteOrigen || 'Expediente'} (${new Date().toLocaleDateString('es-MX')})`;
      const newTemplate = createTemplateFromText(title, 'Amparo', 'Ley de Amparo / CPH', contestationResult.text);
      const saved = await saveCustomTemplate(newTemplate);
      setCustomTemplates((prev) => [saved, ...prev]);
      setFeedback({ tone: 'success', message: `Guardado como plantilla reutilizable en "Mis Plantillas".` });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: 'No se pudo guardar la plantilla.' });
    }
  };

  const handleExportContestationDocx = async () => {
    if (!contestationResult?.text) return;
    try {
      const { exportToDocx } = await import('@/lib/templates/exportDocx');
      const doc = renderToDocument(selectedTemplate, values);
      doc.title = contestationResult.title;
      doc.body = contestationResult.text;
      const buffer = await exportToDocx(doc);
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contestationResult.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({ tone: 'success', message: 'Archivo Word (.docx) descargado.' });
    } catch {
      setFeedback({ tone: 'error', message: 'Error al exportar DOCX.' });
    }
  };

  return (
    <>
      <main className="machotes-page-container">
        <header className="machotes-header">
          <div className="machotes-header-content">
            <div className="machotes-header-left">
              <Link href="/legal-hub" className="machote-btn-back">
                ← Volver a Legal Hub
              </Link>
              <h1>Generador y Editor de Machotes Jurídicos</h1>
              <p className="subtitle">
                Crea, edita y proyecta contestaciones y recursos de revisión con inteligencia artificial. Revisa siempre el escrito final antes de presentarlo.
              </p>
            </div>
            <div className="machotes-header-actions">
              <button
                type="button"
                onClick={() => setIsSaveCustomOpen(true)}
                className="machote-btn-primary"
              >
                📥 Subir Mi Propio Machote
              </button>
              <button
                type="button"
                onClick={() => setIsAiFillOpen(true)}
                className="machote-btn-secondary"
              >
                ✨ Llenar con IA
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
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('generator')}
              className={activeTab === 'generator' ? 'machote-btn-primary' : 'machote-btn-secondary'}
              style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}
            >
              📄 Generador de Escritos Iniciales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contestations')}
              className={activeTab === 'contestations' ? 'machote-btn-primary' : 'machote-btn-secondary'}
              style={{ fontSize: '0.9rem', padding: '0.4rem 1rem', background: activeTab === 'contestations' ? 'linear-gradient(135deg, #2563eb, #7c3aed)' : undefined, border: 'none' }}
            >
              ⚖️ Contestaciones, Recursos y Agravios con IA
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

        {feedback && (
          <div className={`legal-warning ${feedback.tone === 'success' ? 'legal-info-box' : ''}`} style={{ margin: '1rem 0' }}>
            {feedback.message}
          </div>
        )}

        {activeTab === 'generator' && (
          <>
            <div className="machote-template-toolbar">
              <div className="machote-template-select">
                <label htmlFor="template-selector">Seleccionar plantilla</label>
                <select
                  id="template-selector"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="machote-input-control"
                >
                  {allTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="machote-btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  📝 Cargar Ejemplo Realista
                </button>

                {selectedTemplate.originalText && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(selectedTemplate)}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      ✏️ Editar Plantilla
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDialog({
                          title: 'Eliminar plantilla personalizada',
                          message: `¿Estás seguro de eliminar la plantilla "${selectedTemplate.title}"? Esta acción no se puede deshacer.`,
                          confirmLabel: 'Eliminar',
                          isDanger: true,
                          onConfirm: async () => {
                            setConfirmDialog(null);
                            try {
                              const updated = await deleteCustomTemplate(selectedTemplate.id);
                              setCustomTemplates(updated);
                              setSelectedTemplateId(templates[0].id);
                              setFeedback({ tone: 'success', message: 'Plantilla personalizada eliminada.' });
                            } catch {
                              setFeedback({ tone: 'error', message: 'No se pudo eliminar la plantilla.' });
                            }
                          },
                        });
                      }}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.85rem', color: '#f87171' }}
                    >
                      🗑️ Eliminar Machote
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="machote-workspace-grid">
              {/* Form Column */}
              <div className="machote-form-column">
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {selectedTemplate.title}
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {selectedTemplate.description}
                  </p>

                  <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '1rem' }}>
                    ⚖️ {selectedTemplate.legalBasis || 'Fundamento normativo definido por el litigante.'}
                  </div>

                  {validation.missingFields.length > 0 && (
                    <div className="legal-warning" style={{ marginBottom: '1rem', padding: '0.75rem' }}>
                      <p className="font-semibold" style={{ fontSize: '0.85rem' }}>Campos obligatorios pendientes ({validation.missingFields.length}):</p>
                      <ul style={{ fontSize: '0.8rem', marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                        {validation.missingFields.slice(0, 5).map((f) => (
                          <li key={f.id}>{f.title}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedTemplate.sections.map((section) => (
                    <div key={section.id} className="machote-section-block" style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {section.title} {section.required && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>

                        <button
                          type="button"
                          onClick={() => handleAssistSection(section.id, `Desarrolla el apartado de ${section.title} para ${selectedTemplate.title}`)}
                          disabled={assistLoading === section.id}
                          className="machote-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                        >
                          {assistLoading === section.id ? 'IA pensando...' : '✨ Desarrollar con IA'}
                        </button>
                      </div>

                      {section.type === 'textarea' ? (
                        <textarea
                          value={values[section.id] || ''}
                          onChange={(e) => handleInputChange(section.id, e.target.value)}
                          rows={4}
                          placeholder={section.placeholder}
                          className="machote-input-control"
                          style={{ fontSize: '0.85rem' }}
                        />
                      ) : section.type === 'repeatable' || section.type === 'list' ? (
                        <div>
                          {(values[section.id] || []).map((item: string, idx: number) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => handleListChange(section.id, idx, e.target.value)}
                                className="machote-input-control"
                                style={{ fontSize: '0.85rem', flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => handleListRemove(section.id, idx)}
                                className="machote-btn-secondary"
                                style={{ color: '#ef4444', padding: '0.2rem 0.5rem' }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleListAdd(section.id)}
                            className="machote-btn-secondary"
                            style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}
                          >
                            + {section.repeatLabel || `Agregar ${section.title.toLowerCase()}`}
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={values[section.id] || ''}
                          onChange={(e) => handleInputChange(section.id, e.target.value)}
                          placeholder={section.placeholder}
                          className="machote-input-control"
                          style={{ fontSize: '0.85rem' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Column */}
              <div className="machote-preview-column">
                <div className="glass-card" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Vista Previa en Tiempo Real</h3>

                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleCopyText}
                        className="machote-btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      >
                        📋 Copiar
                      </button>
                      <button
                        type="button"
                        onClick={handleExportDocx}
                        className="machote-btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      >
                        📄 Descargar DOCX
                      </button>
                      <button
                        type="button"
                        onClick={handleExportTxt}
                        className="machote-btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      >
                        📝 Texto Plano
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="machote-btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      >
                        🖨️ Imprimir / PDF
                      </button>
                    </div>
                  </div>

                  {fastReview && (
                    <div className="legal-info-box" style={{ marginBottom: '1rem', padding: '0.75rem', fontSize: '0.8rem' }}>
                      <p className="font-semibold" style={{ color: '#60a5fa' }}>Resultado de Revisión Rápida:</p>
                      {fastReview.camposFaltantes.length > 0 && (
                        <p style={{ color: '#ef4444', marginTop: '0.2rem' }}>• Campos requeridos pendientes: {fastReview.camposFaltantes.join(', ')}</p>
                      )}
                      {fastReview.recomendaciones.length > 0 && (
                        <p style={{ color: '#fbbf24', marginTop: '0.2rem' }}>• Recomendaciones: {fastReview.recomendaciones.join(', ')}</p>
                      )}
                    </div>
                  )}

                  {deepReview && (
                    <div className="legal-info-box" style={{ marginBottom: '1rem', padding: '0.75rem', fontSize: '0.8rem' }}>
                      <p className="font-semibold" style={{ color: '#a78bfa' }}>Revisión Profunda (IA):</p>
                      {deepReview.revisionLegal && <p style={{ marginTop: '0.2rem' }}><strong>Legal:</strong> {deepReview.revisionLegal}</p>}
                      {deepReview.revisionProcesal && <p style={{ marginTop: '0.2rem' }}><strong>Procesal:</strong> {deepReview.revisionProcesal}</p>}
                      {deepReview.riesgos && deepReview.riesgos.length > 0 && (
                        <p style={{ color: '#f87171', marginTop: '0.2rem' }}><strong>Riesgos:</strong> {deepReview.riesgos.join(' | ')}</p>
                      )}
                    </div>
                  )}

                  {hasPendingMarkers(renderedText) && (
                    <div className="legal-warning" style={{ marginBottom: '1rem', padding: '0.5rem', fontSize: '0.75rem' }}>
                      ⚠️ {DRAFT_WARNING}
                    </div>
                  )}

                  <div
                    className="machote-document-paper"
                    role="document"
                    aria-label="Vista previa del documento jurídico"
                    style={{ flex: 1, minHeight: '450px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'Arial, sans-serif', fontSize: '0.88rem', lineHeight: '1.6' }}
                  >
                    {renderedText || 'Complete el formulario para ver la previsualización del documento.'}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Contestations & Resources Tab View */}
        {activeTab === 'contestations' && (
          <div className="contestations-container" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚖️ Módulo Especializado de Contestaciones, Recursos y Agravios
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Diseñado para recursos contra sentencias o contestación de demandas. Ingresa los datos del expediente de origen y adjunta la sentencia como fuente de verdad.
              </p>

              {/* Step 1: Select Resource Type & Origin Case Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Tipo de Recurso / Contestación *
                  </label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value)}
                    className="machote-input-control"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="Amparo Directo en Revisión (SCJN)">🏛️ Amparo Directo en Revisión (SCJN)</option>
                    <option value="Recurso de Queja (Ley de Amparo)">⚖️ Recurso de Queja (Ley de Amparo)</option>
                    <option value="Recurso de Reclamación">📜 Recurso de Reclamación</option>
                    <option value="Contestación a Demanda Laboral Burocrática">💼 Contestación a Demanda Laboral Burocrática</option>
                    <option value="Contestación a Demanda Civil / Mercantil">🏛️ Contestación a Demanda Civil / Mercantil</option>
                    <option value="Incidente Procesal / Excepciones">🛡️ Incidente Procesal / Excepciones</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Expediente de Origen
                  </label>
                  <input
                    type="text"
                    value={expedienteOrigen}
                    onChange={(e) => setExpedienteOrigen(e.target.value)}
                    placeholder="Ej. 800/2024"
                    className="machote-input-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Fecha de Resolución
                  </label>
                  <input
                    type="text"
                    value={fechaResolucion}
                    onChange={(e) => setFechaResolucion(e.target.value)}
                    placeholder="Ej. 15 de abril de 2026"
                    className="machote-input-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Tribunal o Autoridad Emisora
                  </label>
                  <input
                    type="text"
                    value={tribunalEmisor}
                    onChange={(e) => setTribunalEmisor(e.target.value)}
                    placeholder="Ej. 2do Tribunal Colegiado en Materia de Trabajo del 3er Circuito"
                    className="machote-input-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Magistrado Ponente / Juez
                  </label>
                  <input
                    type="text"
                    value={magistradoPonente}
                    onChange={(e) => setMagistradoPonente(e.target.value)}
                    placeholder="Ej. Luis Ávalos García"
                    className="machote-input-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Step 2: Source Document & Instruction */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Sentencia o Demanda Impugnada (Fuente de Verdad)
                  </label>
                  <textarea
                    value={contestationDocumentText}
                    onChange={(e) => setContestationDocumentText(e.target.value)}
                    rows={8}
                    placeholder="Pega aquí el texto completo o extracto de la sentencia/demanda (ej. Amparo Directo 800/2024)... El sistema usará este archivo real sin recurrir a datos ficticios."
                    className="machote-input-control"
                    style={{ fontSize: '0.85rem' }}
                  />
                  <div style={{ marginTop: '0.5rem' }}>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setContestationLoading(true);
                        setExtractionWarning(null);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await fetch('/api/templates/analyze-upload', { method: 'POST', body: formData });
                          const data = await res.json();
                          if (data.extractedText) {
                            setContestationDocumentText(data.extractedText);
                            if (data.needsOcr) {
                              setExtractionWarning(`⚠️ Extracción de texto de ${file.name} marcada como PDF escaneado. Se conservó el texto recuperado sin reemplazar con datos ficticios.`);
                            } else {
                              setFeedback({ tone: 'success', message: `Texto de ${file.name} cargado correctamente como fuente de verdad.` });
                            }
                          } else {
                            setExtractionWarning(`⚠️ El archivo ${file.name} requiere revisión de extracción. Puedes pegar el texto manualmente en el campo.`);
                          }
                        } catch {
                          setFeedback({ tone: 'error', message: 'No se pudo leer el archivo.' });
                        } finally {
                          setContestationLoading(false);
                        }
                      }}
                      style={{ fontSize: '0.8rem' }}
                    />
                    {extractionWarning && (
                      <p style={{ color: '#fbbf24', fontSize: '0.8rem', marginTop: '0.35rem' }}>{extractionWarning}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Indicación o Instrucción de Impugnación *
                  </label>
                  <textarea
                    value={contestationPrompt}
                    onChange={(e) => setContestationPrompt(e.target.value)}
                    rows={4}
                    placeholder="Escribe la instrucción concreta para la IA (ej. Armar recurso de revisión ante SCJN por omisión de control difuso e inoperancia indebida de agravios)..."
                    className="machote-input-control"
                    style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}
                  />

                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    💡 Indicaciones rápidas recomendadas:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => setContestationPrompt('A mi archivo dame una contestación / recurso de revisión extraordinaria ante la sentencia de un amparo directo con agravios y petitorios')}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      🏛️ Recurso de Revisión SCJN (Agravios)
                    </button>
                    <button
                      type="button"
                      onClick={() => setContestationPrompt('Generar contestación a demanda laboral burocrática respecto a reinstalación, salarios e IPEJAL')}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      💼 Contestación Laboral Burocrática
                    </button>
                    <button
                      type="button"
                      onClick={() => setContestationPrompt('Analizar excepciones, indebida inoperancia de agravios y defectos procesales')}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      🛡️ Combatir Inoperancia e Indefensión
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateContestation}
                disabled={contestationLoading}
                className="machote-btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
              >
                {contestationLoading ? '⌛ Generando Recurso / Agravios con IA...' : '🚀 Generar Recurso / Agravios con IA'}
              </button>
            </div>

            {/* Generated Contestation Result */}
            {contestationResult && (
              <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#60a5fa' }}>
                    📄 {contestationResult.title}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(contestationResult.text);
                        setFeedback({ tone: 'success', message: 'Escrito copiado al portapapeles.' });
                      }}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    >
                      📋 Copiar
                    </button>
                    <button
                      type="button"
                      onClick={handleExportContestationDocx}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    >
                      📄 Descargar DOCX
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const html = generatePrintHtml({
                          title: contestationResult.title,
                          header: contestationResult.title,
                          body: contestationResult.text,
                          sections: [],
                          footer: 'Generado por Radar Jurídico IA',
                          warnings: [],
                          disclaimer: 'Borrador generado por IA.',
                          generatedAt: new Date().toLocaleDateString('es-MX'),
                        });
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(html);
                          printWindow.document.close();
                        }
                      }}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    >
                      🖨️ Imprimir / PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveContestationAsTemplate}
                      className="machote-btn-primary"
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                    >
                      💾 Guardar en Mis Plantillas
                    </button>
                  </div>
                </div>

                <div
                  className="machote-document-paper"
                  style={{ minHeight: '350px', maxHeight: '600px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'Arial, sans-serif', lineHeight: '1.6', fontSize: '0.92rem' }}
                >
                  {contestationResult.text}
                </div>
              </div>
            )}
          </div>
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
