"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/client/adminToken';
import { templates } from '@/lib/templates/templateDefinitions';
import type { ProfessionalTemplate } from '@/lib/templates/templateTypes';
import { renderToText, renderToDocument, validateTemplateValues } from '@/lib/templates/templateRenderer';
import { generatePrintHtml } from '@/lib/templates/exportPdf';
import { useLegalWorkspaceContext } from '@/context/LegalWorkspaceContext';
import { AiFillModal } from '@/components/machotes/AiFillModal';
import { getSampleValuesForTemplate } from '@/lib/templates/templateSampleData';
import { getCustomTemplates, deleteCustomTemplate, createTemplateFromText, saveCustomTemplate } from '@/lib/templates/customTemplateStore';
import { SaveCustomTemplateModal } from '@/components/machotes/SaveCustomTemplateModal';
import { EditCustomTemplateModal } from '@/components/machotes/EditCustomTemplateModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { FastReviewResponse, DeepReviewResponse } from '@/lib/templates/templateReview';

import { IntentClassifier } from '@/components/machotes/IntentClassifier';
import { PipelineProgress } from '@/components/machotes/PipelineProgress';
import { UniversalDocEditor } from '@/components/machotes/UniversalDocEditor';
import { ValidationPanel } from '@/components/machotes/ValidationPanel';
import type { UniversalLegalDocument, PipelineState, ClassificationResult, UploadedSourceDocument, PipelineTraceStep } from '@/lib/legal-engine/types';
import { runGenerationPipeline, generateSection } from '@/lib/legal-engine/pipeline';
import { validateDocument } from '@/lib/legal-engine/validator';
import { exportUniversalToDocx } from '@/lib/legal-engine/exportDocxUniversal';
import { runMultiStepLegalQuery } from '@/lib/legal-engine/multiStep';
import { createSourceDocument } from '@/lib/legal-engine/context';

interface SavedDraftItem {
  id: string;
  title: string;
  documentType: string;
  updatedAt: string;
  structuredDoc?: any;
  status: string;
}

export default function MachotesPage() {
  const { setContextMode } = useLegalWorkspaceContext();
  const [customTemplates, setCustomTemplates] = useState<ProfessionalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [isAiFillOpen, setIsAiFillOpen] = useState(false);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'universal' | 'generator' | 'my-templates' | 'drafts'>('universal');
  
  // Universal Legal Engine States
  const [universalDoc, setUniversalDoc] = useState<UniversalLegalDocument | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [isUniversalGenerating, setIsUniversalGenerating] = useState(false);
  const [uploadedSourceDocs, setUploadedSourceDocs] = useState<UploadedSourceDocument[]>([]);
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

  // States for Unified Pipeline Input
  const [userPromptInput, setUserPromptInput] = useState('A mi archivo dame una contestación / recurso de revisión extraordinaria ante la sentencia de un amparo directo');
  const [analyzeUnderWarning, setAnalyzeUnderWarning] = useState(false);

  // States for Drafts Management
  const [savedDrafts, setSavedDrafts] = useState<SavedDraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  // States for RAG / Multi-step Query
  const [multiStepQuery, setMultiStepQuery] = useState('');
  const [multiStepTrace, setMultiStepTrace] = useState<PipelineTraceStep[]>([]);
  const [isMultiStepRunning, setIsMultiStepRunning] = useState(false);

  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Load custom templates and drafts on mount
  useEffect(() => {
    loadTemplates();
    loadDrafts();
  }, []);

  const loadTemplates = async () => {
    const t = await getCustomTemplates();
    setCustomTemplates(t);
  };

  const loadDrafts = async () => {
    setDraftsLoading(true);
    try {
      const res = await adminFetch('/api/legal-drafts');
      const data = await res.json();
      if (data.ok && data.drafts) {
        setSavedDrafts(data.drafts);
      }
    } catch {
      // Quiet fallback
    } finally {
      setDraftsLoading(false);
    }
  };

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
  const [reviewLoading, setReviewLoading] = useState<'fast' | 'deep' | null>(null);

  const renderedText = useMemo(() => {
    return renderToText(selectedTemplate, values);
  }, [selectedTemplate, values]);

  const validation = useMemo(() => {
    return validateTemplateValues(selectedTemplate, values);
  }, [selectedTemplate, values]);

  // Handler: Run Universal Pipeline for ANY document (800/2024, contestación, escrito, recurso, sin plantilla)
  const handleRunUniversalPipeline = async (classification?: ClassificationResult, instructionOverride?: string) => {
    const promptToUse = instructionOverride || userPromptInput || 'Redactar escrito jurídico formal con base en el expediente';
    
    // Check if source document validation is required
    const hasUnvalidatedSource = uploadedSourceDocs.some((d) => d.sourceValidated === false);
    if (hasUnvalidatedSource && !analyzeUnderWarning) {
      setFeedback({
        tone: 'warning',
        message: '⚠️ La fuente no está validada (OCR o verificación de páginas pendiente). Activa la opción "Generar bajo advertencia" o valida la fuente antes de continuar.',
      });
      return;
    }

    setIsUniversalGenerating(true);
    setFeedback(null);

    try {
      const doc = await runGenerationPipeline({
        userInstruction: promptToUse,
        sourceDocuments: uploadedSourceDocs,
        existingClassification: classification,
        allowUnvalidatedSource: analyzeUnderWarning,
        warningMode: analyzeUnderWarning,
      });

      setUniversalDoc(doc);
      setPipelineState(doc.generationMetadata.pipelineState);
      setActiveTab('universal');

      setFeedback({
        tone: 'success',
        message: `✅ Documento "${doc.title}" generado y estructurado mediante Motor Universal. Páginas procesadas: ${doc.sourceDocuments.reduce((acc, d) => acc + (d.pages?.length || 1), 0)}.`,
      });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Error al ejecutar el motor universal.' });
    } finally {
      setIsUniversalGenerating(false);
    }
  };

  // Handler: Save persistent draft to database (LegalDraft)
  const handleSaveDraft = async () => {
    if (!universalDoc) return;
    setFeedback(null);
    try {
      const payload = {
        title: universalDoc.title,
        documentType: universalDoc.documentType,
        matter: universalDoc.matter,
        jurisdiction: universalDoc.jurisdiction,
        renderedText: universalDoc.sections.flatMap(s => s.content.map(b => b.text)).join('\n\n'),
        structuredDoc: universalDoc,
        pipelineState: universalDoc.generationMetadata.pipelineState,
        sourceDocuments: universalDoc.sourceDocuments,
        validationResults: universalDoc.validation,
        generationMetadata: universalDoc.generationMetadata,
        status: 'DRAFT',
      };

      let res;
      if (currentDraftId) {
        res = await adminFetch(`/api/legal-drafts/${currentDraftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await adminFetch('/api/legal-drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al guardar el borrador.');
      }

      const saved = data.draft;
      setCurrentDraftId(saved.id);
      await loadDrafts();
      setFeedback({ tone: 'success', message: `✅ Borrador "${saved.title}" guardado en la base de datos.` });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Error al guardar el borrador.' });
    }
  };

  // Handler: Reopen a saved draft
  const handleReopenDraft = (draft: SavedDraftItem) => {
    if (!draft.structuredDoc) {
      setFeedback({ tone: 'warning', message: 'El borrador seleccionado no contiene estructura de documento universal.' });
      return;
    }
    setUniversalDoc(draft.structuredDoc);
    setPipelineState(draft.structuredDoc.generationMetadata?.pipelineState || null);
    setCurrentDraftId(draft.id);
    setActiveTab('universal');
    setFeedback({ tone: 'success', message: `📂 Borrador "${draft.title}" reabierto exitosamente.` });
  };

  // Handler: Convert current universal doc to versioned LegalTemplate
  const handleSaveAsVersionedTemplate = async () => {
    if (!universalDoc) return;
    try {
      const fullText = universalDoc.sections.flatMap(s => s.content.map(b => b.text)).join('\n\n');
      const res = await adminFetch('/api/templates/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: universalDoc.title,
          category: universalDoc.matter ? universalDoc.matter.charAt(0).toUpperCase() + universalDoc.matter.slice(1) : 'General',
          documentType: universalDoc.documentType,
          description: `Plantilla derivada de ${universalDoc.documentTypeLabel}`,
          legalBasis: universalDoc.legalBasis.join(', ') || undefined,
          content: fullText,
          originalText: fullText,
          structureJson: {
            sections: universalDoc.sections.map(s => ({ type: s.type, title: s.title }))
          },
          exportFormats: ['docx', 'pdf', 'text'],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al crear plantilla versionada.');
      }

      await loadTemplates();
      setFeedback({ tone: 'success', message: `💾 Plantilla versionada "${data.template.title}" creada y guardada en Mis Plantillas.` });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Error al guardar la plantilla.' });
    }
  };

  // Handler: Multi-step RAG query for long documents
  const handleRunMultiStepQuery = async () => {
    if (!multiStepQuery.trim() || uploadedSourceDocs.length === 0) {
      setFeedback({ tone: 'warning', message: 'Ingresa una pregunta y asegúrate de tener documentos cargados.' });
      return;
    }
    setIsMultiStepRunning(true);
    try {
      const result = await runMultiStepLegalQuery({
        question: multiStepQuery,
        sources: uploadedSourceDocs,
        maxSteps: 3,
      });
      setMultiStepTrace(result.trace);
      setFeedback({ tone: 'success', message: `🔍 Búsqueda RAG Multi-step completada en ${result.trace.length} etapas.` });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: 'Error en consulta multi-step.' });
    } finally {
      setIsMultiStepRunning(false);
    }
  };

  return (
    <>
      <main className="machote-page-container">
        <header className="machotes-header">
          <div className="machotes-header-content">
            <div className="machotes-header-left">
              <Link href="/legal-hub" className="machote-btn-back">
                ← Volver a Legal Hub
              </Link>
              <h1>Motor Universal y Editor de Documentos Jurídicos</h1>
              <p className="subtitle">
                Pipeline consolidado nativo en TypeScript: extracción por página, trazabilidad de citas, validación de fuentes, edición asistida y exportación DOCX/PDF profesional.
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
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="machote-tabs">
            <button
              type="button"
              onClick={() => setActiveTab('universal')}
              className={`machote-tab ${activeTab === 'universal' ? 'machote-tab--accent' : ''}`}
            >
              ⚡ Motor Universal Pipeline
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drafts')}
              className={`machote-tab ${activeTab === 'drafts' ? 'machote-tab--active' : ''}`}
            >
              💾 Mis Borradores ({savedDrafts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('generator')}
              className={`machote-tab ${activeTab === 'generator' ? 'machote-tab--active' : ''}`}
            >
              📄 Escritos Iniciales por Plantilla
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my-templates')}
              className={`machote-tab ${activeTab === 'my-templates' ? 'machote-tab--active' : ''}`}
            >
              📂 Mis Plantillas ({customTemplates.length})
            </button>
          </nav>
        </header>

        <SaveCustomTemplateModal
          isOpen={isSaveCustomOpen}
          onClose={() => setIsSaveCustomOpen(false)}
          onTemplateCreated={(newTemplate) => {
            setCustomTemplates((prev) => [newTemplate, ...prev.filter(t => t.id !== newTemplate.id)]);
            setSelectedTemplateId(newTemplate.id);
            setActiveTab('generator');
            setFeedback({ tone: 'success', message: `✅ Tu machote "${newTemplate.title}" fue guardado y cargado en el editor.` });
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

        {/* ⚡ MOTOR UNIVERSAL TAB */}
        {activeTab === 'universal' && (
          <div style={{ marginTop: '1rem' }}>
            {!universalDoc ? (
              <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <IntentClassifier
                  isProcessing={isUniversalGenerating}
                  onConfirmClassification={async (classification, userInstruction) => {
                    await handleRunUniversalPipeline(classification, userInstruction);
                  }}
                />

                {/* Source Document File Upload & Validation Section */}
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-main)' }}>
                    📎 Documentos de Soporte / Expedientes (Extracción completa por página sin límites)
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Adjunta demandas, sentencias u hojas del expediente. Se extraerán todas las páginas y se mantendrá trazabilidad exacta (documento → página → fragmento → argumento).
                  </p>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.rtf,.jpg,.jpeg,.png"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          const res = await adminFetch('/api/templates/analyze-upload', {
                            method: 'POST',
                            body: formData,
                          });
                          const payload = await res.json();
                          if (payload.ok) {
                            const extracted = payload.extractedText || '';
                            const pages = payload.pages || [
                              { page: 1, text: extracted, chars: extracted.length }
                            ];
                            const sourceDoc = createSourceDocument({
                              id: `src-${Date.now()}`,
                              filename: payload.sourceFileName || file.name,
                              name: payload.sourceFileName || file.name,
                              extractedText: extracted,
                              content: extracted,
                              pages,
                              sourceValidated: payload.sourceValidated !== false,
                              classification: payload.classification,
                            });
                            setUploadedSourceDocs((prev) => [...prev, sourceDoc]);
                            setFeedback({
                              tone: sourceDoc.sourceValidated ? 'success' : 'warning',
                              message: `Archivo "${file.name}" cargado (${pages.length} página(s), ${extracted.length.toLocaleString()} caracteres). ${sourceDoc.sourceValidated ? '✅ Fuente Validada' : '⚠️ Requiere Validación/OCR'}.`
                            });
                          } else {
                            setFeedback({ tone: 'error', message: payload.error || 'No se pudo procesar el archivo.' });
                          }
                        } catch {
                          setFeedback({ tone: 'error', message: 'Error al subir documento.' });
                        }
                      }}
                      style={{ fontSize: '0.85rem' }}
                    />

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={analyzeUnderWarning}
                        onChange={(e) => setAnalyzeUnderWarning(e.target.checked)}
                      />
                      Permitir generación bajo advertencia si la fuente no está validada
                    </label>
                  </div>

                  {uploadedSourceDocs.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Documentos listos para el pipeline:</div>
                      {uploadedSourceDocs.map((doc) => (
                        <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-muted)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                          <span>
                            📄 <strong>{doc.filename || doc.name || 'Documento'}</strong> ({doc.pages?.length || 1} págs, {(doc.extractedText?.length || 0).toLocaleString()} chars)
                            {doc.sourceValidated === false && (
                              <span style={{ marginLeft: '0.5rem', color: '#f59e0b', fontWeight: 700 }}>⚠️ Sin Validar</span>
                            )}
                            {doc.sourceValidated === true && (
                              <span style={{ marginLeft: '0.5rem', color: '#10b981', fontWeight: 700 }}>✓ Validado</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setUploadedSourceDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                            style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          >
                            ❌
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AutoContext / RAG Multi-Step Query Drawer */}
                {uploadedSourceDocs.length > 0 && (
                  <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-main)' }}>
                      🔍 Consulta RAG / Multi-Step en Expedientes Largos
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        value={multiStepQuery}
                        onChange={(e) => setMultiStepQuery(e.target.value)}
                        placeholder="Ej. ¿Qué dijo la responsable sobre la carga de la prueba en la página 2?"
                        className="machote-input-control"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={handleRunMultiStepQuery}
                        disabled={isMultiStepRunning}
                        className="machote-btn-secondary"
                      >
                        {isMultiStepRunning ? 'Buscando...' : '🔍 RAG Multi-step'}
                      </button>
                    </div>

                    {multiStepTrace.length > 0 && (
                      <div style={{ marginTop: '1rem', background: 'var(--surface-muted)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                        <strong>Traza de recuperación multi-etapa:</strong>
                        {multiStepTrace.map((t) => (
                          <div key={t.step} style={{ marginTop: '0.4rem', borderLeft: '2px solid #3b82f6', paddingLeft: '0.5rem' }}>
                            Etapa #{t.step}: {t.note} ({t.references.length} referencia(s) hallada(s))
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Universal Document Action Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUniversalDoc(null);
                      setPipelineState(null);
                      setCurrentDraftId(null);
                    }}
                    className="machote-btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    ← Iniciar Nuevo Escrito
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      💾 Guardar Borrador
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAsVersionedTemplate}
                      className="machote-btn-secondary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      📂 Convertir a Plantilla
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const buffer = await exportUniversalToDocx(universalDoc);
                          const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${universalDoc.title.replace(/[^a-zA-Z0-9\s-]/g, '')}.docx`;
                          a.click();
                          setFeedback({ tone: 'success', message: 'Documento DOCX exportado exitosamente.' });
                        } catch {
                          setFeedback({ tone: 'error', message: 'Error al exportar DOCX.' });
                        }
                      }}
                      className="machote-btn-primary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      📄 Exportar DOCX Real
                    </button>
                  </div>
                </div>

                {/* Pipeline Progress */}
                {pipelineState && <PipelineProgress state={pipelineState} />}

                {/* Universal Document Editor */}
                <UniversalDocEditor
                  document={universalDoc}
                  onUpdateDocument={(updated) => {
                    setUniversalDoc(updated);
                    const validation = validateDocument(updated);
                    setUniversalDoc({ ...updated, validation });
                  }}
                  onRegenerateSection={async (sectionId, instruction) => {
                    try {
                      const result = await generateSection(universalDoc, sectionId, instruction);
                      const updatedSections = universalDoc.sections.map((s) => {
                        if (s.id !== sectionId) return s;
                        return {
                          ...s,
                          content: [
                            {
                              id: `block-${Date.now()}`,
                              text: result.text,
                              layer: 'GENERATED_ARGUMENT' as const,
                              trustLevel: 'AI_INFERENCE' as const,
                              trust: 'AI_INFERENCE' as const,
                              sources: result.sources,
                              createdAt: new Date().toISOString(),
                            },
                          ],
                          isGenerated: true,
                          validationWarnings: result.warnings,
                        };
                      });
                      const updatedDoc = { ...universalDoc, sections: updatedSections, updatedAt: new Date().toISOString() };
                      const validation = validateDocument(updatedDoc);
                      setUniversalDoc({ ...updatedDoc, validation });
                      setFeedback({ tone: 'success', message: 'Sección regenerada exitosamente.' });
                    } catch (err: any) {
                      setFeedback({ tone: 'error', message: err.message || 'Error al regenerar sección.' });
                    }
                  }}
                />

                {/* Pre-Export Validation Panel */}
                <ValidationPanel
                  validation={universalDoc.validation}
                  onExport={async () => {
                    try {
                      const buffer = await exportUniversalToDocx(universalDoc);
                      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${universalDoc.title.replace(/[^a-zA-Z0-9\s-]/g, '')}.docx`;
                      a.click();
                      setFeedback({ tone: 'success', message: 'Documento DOCX exportado exitosamente.' });
                    } catch {
                      setFeedback({ tone: 'error', message: 'Error al exportar DOCX.' });
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* 💾 DRAFTS TAB VIEW */}
        {activeTab === 'drafts' && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Borradores Guardados ({savedDrafts.length})</h2>
              <button type="button" onClick={loadDrafts} className="machote-btn-secondary" style={{ fontSize: '0.85rem' }}>
                🔄 Recargar
              </button>
            </div>

            {draftsLoading ? (
              <p>Cargando borradores...</p>
            ) : savedDrafts.length === 0 ? (
              <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No tienes borradores guardados actualmente.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {savedDrafts.map((draft) => (
                  <div key={draft.id} className="glass-card" style={{ padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        {new Date(draft.updatedAt).toLocaleString('es-MX')}
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{draft.title}</h3>
                      <span className="machote-status-pill" style={{ fontSize: '0.75rem' }}>{draft.documentType}</span>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleReopenDraft(draft)}
                        className="machote-btn-primary"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      >
                        📂 Reabrir en Editor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 📄 GENERATOR BY TEMPLATE TAB */}
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
            </div>
          </>
        )}

        {/* 📂 MY TEMPLATES TAB */}
        {activeTab === 'my-templates' && (
          <div className="my-templates-container" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar por nombre, categoría o fundamento..."
                className="machote-input-control"
                style={{ flex: 1, minWidth: '250px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredCustomTemplates.map((t) => (
                <div key={t.id} className="glass-card" style={{ padding: '1.25rem' }}>
                  <h3>{t.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.description}</p>
                </div>
              ))}
            </div>
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
