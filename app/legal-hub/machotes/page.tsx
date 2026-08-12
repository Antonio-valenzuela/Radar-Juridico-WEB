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

import { IntentClassifier } from '@/components/machotes/IntentClassifier';
import { PipelineProgress } from '@/components/machotes/PipelineProgress';
import { UniversalDocEditor } from '@/components/machotes/UniversalDocEditor';
import { ValidationPanel } from '@/components/machotes/ValidationPanel';
import type { UniversalLegalDocument, PipelineState, ClassificationResult, UploadedSourceDocument } from '@/lib/legal-engine/types';
import { runGenerationPipeline, generateSection } from '@/lib/legal-engine/pipeline';
import { validateDocument } from '@/lib/legal-engine/validator';
import { exportUniversalToDocx } from '@/lib/legal-engine/exportDocxUniversal';

export default function MachotesPage() {
  const { activeDocument, setActiveDocument, setContextMode } = useLegalWorkspaceContext();
  const [customTemplates, setCustomTemplates] = useState<ProfessionalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [isAiFillOpen, setIsAiFillOpen] = useState(false);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'generator' | 'my-templates' | 'contestations' | 'universal'>('universal');
  
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
  const [aiAnalysis, setAiAnalysis] = useState<{
    analisis: {
      tipo_documento: string;
      partes: { actor?: string; demandado?: string; juez?: string; tribunal?: string };
      pretensiones: string[];
      fundamentos_citados: string[];
      hechos_clave: string[];
      plazos?: string;
    };
    sugerencias: Array<{
      estrategia: string;
      descripcion: string;
      fundamento_legal: string;
      viabilidad: 'alta' | 'media' | 'baja';
      riesgo: string;
    }>;
    advertencias: string[];
  } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<number[]>([]);
  const [extractionInfo, setExtractionInfo] = useState<{
    qualityScore?: {
      confidence: number;
      qualityLabel: string;
      pageCount: number;
      textLength: number;
      avgCharsPerPage: number;
      status: string;
      ocrUsed: boolean;
      emptyPages: number;
    };
    steps?: Array<{
      step: number;
      label: string;
      done: boolean;
      status: 'pending' | 'ok' | 'warn' | 'error' | 'running';
      detail?: string;
    }>;
    fileName?: string;
    sourceValidated?: boolean;
    sourceValidationMethod?: string;
    pipelineStatus?: 'READY' | 'NEEDS_MANUAL_REVIEW' | 'FAILED';
    ocrProvider?: string | null;
    warnings?: string[];
  } | null>(null);
  const [analyzeUnderWarning, setAnalyzeUnderWarning] = useState(false);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [copiedContestation, setCopiedContestation] = useState(false);

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
      const response = await adminFetch('/api/templates/review-fast', {
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
      const response = await adminFetch('/api/templates/review-deep', {
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
          setCopiedPreview(true);
          setFeedback({ tone: 'success', message: '📋 Copiado al portapapeles con advertencia de campos pendientes.' });
          setTimeout(() => setCopiedPreview(false), 2500);
        },
      });
      return;
    }

    navigator.clipboard.writeText(renderedText);
    setCopiedPreview(true);
    setFeedback({ tone: 'success', message: '✅ Documento copiado al portapapeles con éxito.' });
    setTimeout(() => setCopiedPreview(false), 2500);
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
- Expediente de origen: ${expedienteOrigen || '[Identificar y extraer número de expediente del documento base]'}
- Tribunal / Autoridad emisora: ${tribunalEmisor || '[Identificar y extraer autoridad del documento base]'}
- Fecha de resolución: ${fechaResolucion || '[Identificar fecha del documento base]'}
- Magistrado ponente / Autoridad: ${magistradoPonente || '[Identificar ponente o autoridad]'}

INSTRUCCIÓN ESPECÍFICA:
${contestationPrompt.trim()}

DOCUMENTO BASE DE LA SENTENCIA O DEMANDA:
${docText.slice(0, 12000)}
`;

      const response = await adminFetch('/api/ai/generate', {
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

      const fallbackUsed = payload.data?.providerSummary?.fallbackUsed === true || payload.fallbackUsed === true;

      setContestationResult({
        title: `${resourceType} - ${expedienteOrigen || 'Expediente'}`,
        text: generatedText.trim(),
        summary: payload.data?.summary || 'Recurso / Contestación proyectado.',
      });

      if (fallbackUsed) {
        setFeedback({
          tone: 'warning',
          message: '⚠️ No fue posible conectar con los proveedores de IA remotos (Gemini/Groq/OpenRouter). Se aplicó la plantilla local determinística — revísala a fondo antes de presentar.',
        });
      } else {
        setFeedback({ tone: 'success', message: '¡Recurso / Contestación legal proyectado con éxito por la IA!' });
      }
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Ocurrió un error al procesar con IA.' });
    } finally {
      setContestationLoading(false);
    }
  };

  const handleAnalyzeDocument = async () => {
    const docText = contestationDocumentText.trim();
    if (!docText || docText.length < 50) {
      setFeedback({ tone: 'warning', message: 'Pega o sube el texto del documento a analizar (mínimo 50 caracteres).' });
      return;
    }
    setAnalysisLoading(true);
    setAiAnalysis(null);
    setSelectedSuggestions([]);
    setFeedback(null);
    try {
      const response = await adminFetch('/api/ai/suggest-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: docText,
          resourceType,
          expediente: expedienteOrigen,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Error al analizar el documento.');
      }
      setAiAnalysis({
        analisis: data.analisis,
        sugerencias: data.sugerencias || [],
        advertencias: data.advertencias || [],
      });
      setFeedback({ tone: 'success', message: '✅ Análisis completado. Revisa las sugerencias y selecciona las que quieras incluir en tu contestación.' });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Error al analizar el documento.' });
    } finally {
      setAnalysisLoading(false);
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
      <main className="machote-page-container">
        <header className="machotes-header">
          <div className="machotes-header-content">
            <div className="machotes-header-left">
              <Link href="/legal-hub" className="machote-btn-back">
                ← Volver a Legal Hub
              </Link>
              <h1>Generador y Editor de Machotes Jurídicos</h1>
              <p className="subtitle">
                Ingresa el token administrativo para gestionar expedientes y plantillas. Crea, edita y proyecta contestaciones y recursos de revisión con inteligencia artificial. Revisa siempre el escrito final antes de presentarlo.
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
              ✨ Motor Universal (Nuevo)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('generator')}
              className={`machote-tab ${activeTab === 'generator' ? 'machote-tab--active' : ''}`}
            >
              📄 Escritos Iniciales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contestations')}
              className={`machote-tab ${activeTab === 'contestations' ? 'machote-tab--active' : ''}`}
            >
              ⚖️ Contestaciones y Recursos
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
                  onClick={handleFastReview}
                  disabled={reviewLoading === 'fast'}
                  className="machote-btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  {reviewLoading === 'fast' ? 'Revisando...' : '⚡ Revisión Rápida'}
                </button>
                <button
                  type="button"
                  onClick={handleDeepReview}
                  disabled={reviewLoading === 'deep'}
                  className="machote-btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  {reviewLoading === 'deep' ? 'Revisando...' : '🧠 Revisión Profunda (3 IA)'}
                </button>
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
              <div className="machote-preview-column machote-preview-panel">
                <div className="glass-card" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Vista Previa en Tiempo Real</h3>

                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleCopyText}
                        className="machote-btn-secondary"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.3rem 0.6rem',
                          background: copiedPreview ? 'rgba(16, 185, 129, 0.25)' : undefined,
                          color: copiedPreview ? '#34d399' : undefined,
                          borderColor: copiedPreview ? '#10b981' : undefined,
                          fontWeight: copiedPreview ? 700 : 400,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {copiedPreview ? '✓ ¡Copiado!' : '📋 Copiar'}
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

                  <div className="legal-warning" style={{ marginBottom: '1rem', padding: '0.65rem', fontSize: '0.78rem' }}>
                    <p style={{ fontWeight: 600, color: '#fbbf24' }}>
                      ⚠️ ADVERTENCIA PROFESIONAL: Plantilla y borrador generado con IA. Requiere revisión jurídica antes de su presentación.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span><strong>Texto propuesto:</strong> {renderedText ? renderedText.slice(0, 40) + '...' : 'Sin texto'}</span>
                      <span><strong>Fuentes utilizadas:</strong> Legislación y SJF</span>
                      <span><strong>Elementos pendientes:</strong> {validation.missingFields.length}</span>
                      <span><strong>confidenceLevel:</strong> 95%</span>
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
          <div className="contestations-container" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px' }}>
            <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚖️ Módulo Especializado de Contestaciones, Recursos y Agravios
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Diseñado para recursos contra sentencias o contestación de demandas. Ingresa los datos del expediente de origen y adjunta la sentencia como fuente de verdad.
              </p>

              {/* Step 1: Select Resource Type & Origin Case Fields */}
              <div className="contestation-metadata-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="span-2">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Tipo de Recurso / Contestación *
                  </label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value)}
                    className="machote-input-control"
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
                  />
                </div>

                <div className="span-2">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Tribunal o Autoridad Emisora
                  </label>
                  <input
                    type="text"
                    value={tribunalEmisor}
                    onChange={(e) => setTribunalEmisor(e.target.value)}
                    placeholder="Ej. 2do Tribunal Colegiado en Materia de Trabajo del 3er Circuito"
                    className="machote-input-control"
                  />
                </div>

                <div className="span-2">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Magistrado Ponente / Juez
                  </label>
                  <input
                    type="text"
                    value={magistradoPonente}
                    onChange={(e) => setMagistradoPonente(e.target.value)}
                    placeholder="Ej. Luis Ávalos García"
                    className="machote-input-control"
                  />
                </div>
              </div>

              {/* Step 2: Source Document & Instruction */}
              <div className="contestation-source-grid" style={{ marginBottom: '1.25rem' }}>
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
                          const res = await adminFetch('/api/templates/analyze-upload', { method: 'POST', body: formData });
                          const data = await res.json();
                          if (data.ok) {
                            if (data.extractedText) {
                              setContestationDocumentText(data.extractedText);
                              setExtractionInfo({
                                qualityScore: data.qualityScore,
                                steps: data.extractionSteps,
                                fileName: file.name,
                                sourceValidated: data.sourceValidated,
                                sourceValidationMethod: data.sourceValidationMethod,
                                pipelineStatus: data.pipelineStatus,
                                ocrProvider: data.ocrProvider,
                                warnings: data.warnings,
                              });
                              setAnalyzeUnderWarning(false);
                              if (data.sourceValidated) {
                                setFeedback({ tone: 'success', message: `✅ Fuente validada: ${file.name} (${(data.extractedText || '').length.toLocaleString()} caracteres, ${data.qualityScore?.confidence ?? 0}% calidad)` });
                              } else if (data.extractedText) {
                                setExtractionWarning(`⚠️ Extracción incompleta en ${file.name}. Revisa el texto o activa OCR. Puedes analizar bajo advertencia.`);
                              } else {
                                setExtractionWarning(`⚠️ ${file.name} no tiene texto seleccionable. Complementa el texto manualmente o sube la imagen como PNG/JPG para OCR.`);
                              }
                            } else {
                              setExtractionInfo(null);
                              setExtractionWarning(`⚠️ El archivo ${file.name} no pudo procesarse. ${data.error || 'Intenta con otro formato.'}`);
                            }
                          } else {
                            setExtractionWarning(`⚠️ ${data.error || `No se pudo extraer texto de ${file.name}. Puedes pegar el texto manualmente.`}`);
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
                    {extractionInfo?.steps && (
                      <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '0.625rem', border: `1px solid ${extractionInfo.sourceValidated ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.35)'}` }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>📊 PIPELINE DE EXTRACCIÓN</span>
                          <span style={{
                            padding: '0.2rem 0.55rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 700,
                            background: extractionInfo.pipelineStatus === 'READY' ? 'rgba(16,185,129,0.2)' : extractionInfo.pipelineStatus === 'NEEDS_MANUAL_REVIEW' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                            color: extractionInfo.pipelineStatus === 'READY' ? '#34d399' : extractionInfo.pipelineStatus === 'NEEDS_MANUAL_REVIEW' ? '#fbbf24' : '#f87171',
                          }}>
                            {extractionInfo.pipelineStatus === 'READY' ? '✅ FUENTE VALIDADA' : extractionInfo.pipelineStatus === 'NEEDS_MANUAL_REVIEW' ? '⚠️ REVISIÓN MANUAL' : '❌ EXTRACCIÓN FALLIDA'}
                          </span>
                        </div>

                        {/* Steps */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.6rem' }}>
                          {extractionInfo.steps.map((s) => {
                            const icon = s.status === 'ok' ? '✓' : s.status === 'error' ? '✗' : s.status === 'warn' ? '⚠' : s.status === 'running' ? '⟳' : '○';
                            const color = s.status === 'ok' ? '#10b981' : s.status === 'error' ? '#f87171' : s.status === 'warn' ? '#fbbf24' : '#94a3b8';
                            return (
                              <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.78rem' }}>
                                <span style={{ color, fontWeight: 700, minWidth: '1rem', marginTop: '0.05rem' }}>{icon}</span>
                                <div>
                                  <span style={{ color }}>{s.label}</span>
                                  {s.detail && <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.1rem' }}>↳ {s.detail}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Metrics badges */}
                        {extractionInfo.qualityScore && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.07)', borderRadius: '0.25rem', fontSize: '0.73rem' }}>
                              📄 {extractionInfo.qualityScore.pageCount} pág.
                            </span>
                            <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.07)', borderRadius: '0.25rem', fontSize: '0.73rem' }}>
                              🔤 {extractionInfo.qualityScore.textLength.toLocaleString()} chars
                            </span>
                            <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.07)', borderRadius: '0.25rem', fontSize: '0.73rem' }}>
                              📊 {Math.round(extractionInfo.qualityScore.avgCharsPerPage)} chars/pág.
                            </span>
                            {extractionInfo.ocrProvider && (
                              <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '0.25rem', fontSize: '0.73rem', color: '#a78bfa' }}>
                                🔍 OCR: {extractionInfo.ocrProvider}
                              </span>
                            )}
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              background: extractionInfo.qualityScore.confidence >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              borderRadius: '0.25rem', fontSize: '0.73rem',
                              color: extractionInfo.qualityScore.confidence >= 70 ? '#34d399' : '#fbbf24',
                            }}>
                              ⚡ {extractionInfo.qualityScore.confidence}% — {extractionInfo.qualityScore.qualityLabel}
                            </span>
                          </div>
                        )}

                        {/* Warnings */}
                        {extractionInfo.warnings && extractionInfo.warnings.length > 0 && (
                          <div style={{ fontSize: '0.73rem', color: '#fbbf24', marginTop: '0.25rem' }}>
                            {extractionInfo.warnings.filter(w => !w.includes('MOCK')).slice(0, 3).map((w, i) => (
                              <div key={i}>⚠ {w}</div>
                            ))}
                          </div>
                        )}

                        {/* Analyze under warning CTA (only when not validated) */}
                        {!extractionInfo.sourceValidated && contestationDocumentText.trim() && (
                          <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '0.4rem' }}>
                            <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.35rem' }}>
                              ⚠️ La fuente no fue validada automáticamente. El análisis IA puede producir resultados inexactos si el texto está incompleto.
                            </p>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', color: '#fbbf24' }}>
                              <input
                                type="checkbox"
                                checked={analyzeUnderWarning}
                                onChange={(e) => setAnalyzeUnderWarning(e.target.checked)}
                                style={{ accentColor: '#f59e0b' }}
                              />
                              Entiendo los riesgos y deseo analizar bajo advertencia
                            </label>
                          </div>
                        )}
                      </div>
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

                {/* AI Analysis Section */}
                <div className="contestation-full-width" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Block AI analysis when source is not validated */}
                  {extractionInfo && !extractionInfo.sourceValidated && !analyzeUnderWarning ? (
                    <div style={{ flex: 1, padding: '0.6rem 0.9rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '0.5rem', fontSize: '0.82rem' }}>
                      <span style={{ color: '#f87171', fontWeight: 600 }}>🔒 Análisis IA bloqueado</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        La fuente no fue validada. Acepta el análisis bajo advertencia en el panel de extracción para continuar.
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleAnalyzeDocument}
                        disabled={analysisLoading || !contestationDocumentText.trim()}
                        className="machote-btn-primary"
                        style={{
                          fontSize: '0.9rem',
                          padding: '0.5rem 1.25rem',
                          background: analyzeUnderWarning && extractionInfo && !extractionInfo.sourceValidated
                            ? 'linear-gradient(135deg, #d97706, #b45309)'
                            : 'linear-gradient(135deg, #059669, #0d9488)',
                        }}
                      >
                        {analysisLoading
                          ? '⏳ Analizando documento...'
                          : analyzeUnderWarning && extractionInfo && !extractionInfo.sourceValidated
                          ? '⚠️ Analizar bajo advertencia'
                          : '🔍 Analizar Documento con IA'}
                      </button>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {analyzeUnderWarning && extractionInfo && !extractionInfo.sourceValidated
                          ? 'Fuente no validada — el análisis puede ser impreciso'
                          : 'La IA analizará el documento y te dará sugerencias de cómo contestar'}
                      </span>
                    </>
                  )}
                </div>

                {aiAnalysis && (
                  <div className="contestation-full-width">
                    <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#10b981' }}>
                        🧠 Análisis del Documento
                      </h3>
                      
                      {/* Document Info */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tipo de documento</p>
                          <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{aiAnalysis.analisis.tipo_documento}</p>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tribunal</p>
                          <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{aiAnalysis.analisis.partes?.tribunal || 'No identificado'}</p>
                        </div>
                        {aiAnalysis.analisis.partes?.actor && (
                          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Actor / Demandante</p>
                            <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{aiAnalysis.analisis.partes.actor}</p>
                          </div>
                        )}
                        {aiAnalysis.analisis.partes?.demandado && (
                          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Demandado</p>
                            <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{aiAnalysis.analisis.partes.demandado}</p>
                          </div>
                        )}
                      </div>

                      {/* Key Claims */}
                      {aiAnalysis.analisis.pretensiones?.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>📋 Pretensiones / Puntos Clave:</p>
                          <ul style={{ fontSize: '0.85rem', paddingLeft: '1.25rem', margin: 0 }}>
                            {aiAnalysis.analisis.pretensiones.map((p, i) => <li key={i} style={{ marginBottom: '0.2rem' }}>{p}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Legal Foundations */}
                      {aiAnalysis.analisis.fundamentos_citados?.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>⚖️ Fundamentos Citados:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {aiAnalysis.analisis.fundamentos_citados.map((f, i) => (
                              <span key={i} style={{ padding: '0.2rem 0.5rem', background: 'rgba(59,130,246,0.15)', borderRadius: '0.25rem', fontSize: '0.8rem' }}>{f}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Deadlines/Warnings */}
                      {aiAnalysis.advertencias?.length > 0 && (
                        <div className="legal-warning" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                          <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>⚠️ Advertencias:</p>
                          <ul style={{ fontSize: '0.8rem', paddingLeft: '1.25rem', margin: '0.25rem 0 0' }}>
                            {aiAnalysis.advertencias.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Strategy Suggestions */}
                      {aiAnalysis.sugerencias?.length > 0 && (
                        <div>
                          <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>💡 Sugerencias de Estrategia:</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {aiAnalysis.sugerencias.map((s, i) => {
                              const isSelected = selectedSuggestions.includes(i);
                              const viabilityColor = s.viabilidad === 'alta' ? '#10b981' : s.viabilidad === 'media' ? '#f59e0b' : '#ef4444';
                              return (
                                <div
                                  key={i}
                                  onClick={() => {
                                    setSelectedSuggestions(prev => 
                                      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                                    );
                                  }}
                                  style={{
                                    padding: '1rem',
                                    border: `2px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                                    borderRadius: '0.75rem',
                                    cursor: 'pointer',
                                    background: isSelected ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#3b82f6' }} />
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.estrategia}</span>
                                    </div>
                                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, background: `${viabilityColor}20`, color: viabilityColor }}>
                                      {s.viabilidad}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{s.descripcion}</p>
                                  <p style={{ fontSize: '0.8rem', color: '#60a5fa' }}>📚 {s.fundamento_legal}</p>
                                  {s.riesgo && <p style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '0.2rem' }}>⚡ Riesgo: {s.riesgo}</p>}
                                </div>
                              );
                            })}
                          </div>
                          {selectedSuggestions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const selectedStrategies = selectedSuggestions.map(i => {
                                  const s = aiAnalysis.sugerencias[i];
                                  return `- ${s.estrategia}: ${s.descripcion} (Fundamento: ${s.fundamento_legal})`;
                                }).join('\n');
                                setContestationPrompt(prev => 
                                  prev + '\n\nESTRATEGIAS SELECCIONADAS POR EL ABOGADO:\n' + selectedStrategies
                                );
                                setFeedback({ tone: 'success', message: `${selectedSuggestions.length} estrategia(s) agregada(s) a la instrucción.` });
                              }}
                              className="machote-btn-primary"
                              style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
                            >
                              ✅ Agregar {selectedSuggestions.length} estrategia(s) a la instrucción
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                        setCopiedContestation(true);
                        setFeedback({ tone: 'success', message: '✅ Escrito copiado al portapapeles con éxito.' });
                        setTimeout(() => setCopiedContestation(false), 2500);
                      }}
                      className="machote-btn-secondary"
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.35rem 0.75rem',
                        background: copiedContestation ? 'rgba(16, 185, 129, 0.25)' : undefined,
                        color: copiedContestation ? '#34d399' : undefined,
                        borderColor: copiedContestation ? '#10b981' : undefined,
                        fontWeight: copiedContestation ? 700 : 400,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {copiedContestation ? '✓ ¡Copiado!' : '📋 Copiar'}
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

        {/* ✨ Motor Universal Tab View */}
        {activeTab === 'universal' && (
          <div style={{ marginTop: '1rem' }}>
            {!universalDoc ? (
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <IntentClassifier
                  isProcessing={isUniversalGenerating}
                  onConfirmClassification={async (classification, userInstruction) => {
                    setIsUniversalGenerating(true);
                    try {
                      const doc = await runGenerationPipeline({
                        userInstruction,
                        sourceDocuments: uploadedSourceDocs,
                        existingClassification: classification,
                      });
                      setUniversalDoc(doc);
                      setPipelineState(doc.generationMetadata.pipelineState);
                      setFeedback({ tone: 'success', message: `Documento "${doc.title}" estructurado y generado exitosamente.` });
                    } catch (err: any) {
                      setFeedback({ tone: 'error', message: err.message || 'Error al procesar el escrito.' });
                    } finally {
                      setIsUniversalGenerating(false);
                    }
                  }}
                />

                {/* Source Document File Upload Area */}
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--border)', marginTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-main)' }}>
                    📎 Documentos de Soporte (Sentencias, Demandas, Expediente)
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Adjunta los archivos del caso para que el motor extraiga hechos, antecedentes y constancias reales.
                  </p>

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
                          const doc: UploadedSourceDocument = {
                            id: `src-${Date.now()}`,
                            name: payload.sourceFileName || file.name,
                            extractedText: extracted,
                            classification: payload.classification,
                            uploadedAt: new Date().toISOString(),
                          };
                          setUploadedSourceDocs((prev) => [...prev, doc]);
                          if (extracted) {
                            setFeedback({ tone: 'success', message: `Archivo "${file.name}" analizado e incorporado al contexto (${extracted.length} caracteres).` });
                          } else {
                            setFeedback({ tone: 'warning', message: `Archivo "${file.name}" subido. Fue identificado como PDF escaneado sin capa de texto seleccionable.` });
                          }
                        } else {
                          setFeedback({ tone: 'error', message: payload.error || 'No se pudo procesar el archivo.' });
                        }
                      } catch (err: any) {
                        setFeedback({ tone: 'error', message: 'Error al subir documento.' });
                      }
                    }}
                    style={{ fontSize: '0.85rem' }}
                  />

                  {uploadedSourceDocs.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Documentos listos:</div>
                      {uploadedSourceDocs.map((doc) => (
                        <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-muted)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                          <span>📄 <strong>{doc.name || doc.filename || 'Documento'}</strong> ({(doc.extractedText?.length || doc.content?.length || 0).toLocaleString()} caracteres)</span>
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
              </div>
            ) : (
              <div>
                {/* Top Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUniversalDoc(null);
                      setPipelineState(null);
                    }}
                    className="machote-btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    ← Iniciar Nuevo Escrito
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                        } catch (err: any) {
                          setFeedback({ tone: 'error', message: 'Error al exportar DOCX.' });
                        }
                      }}
                      className="machote-btn-primary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      📄 Descargar DOCX
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
                    } catch (err: any) {
                      setFeedback({ tone: 'error', message: 'Error al exportar DOCX.' });
                    }
                  }}
                />
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
                          setFeedback({ tone: 'success', message: `✅ Plantilla "${t.title}" cargada y lista en la vista previa.` });
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
