<<<<<<< Updated upstream
"use client";
=======
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WorkspaceDocumentEditor } from './components/WorkspaceDocumentEditor';
import { WorkspaceDraftGeneratorModal, GenerationStatus, GenerationResult } from './components/WorkspaceDraftGeneratorModal';
import { TemplateLibraryManager, TemplateItem } from './components/TemplateLibraryManager';
import { CaseDocumentsReader } from './components/CaseDocumentsReader';
import { SaveCustomTemplateModal } from '@/components/machotes/SaveCustomTemplateModal';
import { EditCustomTemplateModal } from '@/components/machotes/EditCustomTemplateModal';
>>>>>>> Stashed changes

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch, getAdminToken, setAdminToken } from '@/lib/client/adminToken';
import { templates } from '@/lib/templates/templateDefinitions';
import type {
<<<<<<< Updated upstream
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

export default function MachotesPage() {
  const { setActiveDocument } = useLegalWorkspaceContext();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
=======
  UniversalLegalDocument,
  UploadedSourceDocument,
  CaseDocument,
  TemplateVersion,
  DocumentPage,
  DocumentNode,
  ContentBlock,
} from '@/lib/legal-engine/types';
import { createEmptyDocument } from '@/lib/legal-engine/types';
import { createSourceDocument, structuredTemplateToUniversalDocument } from '@/lib/legal-engine/context';

export type LegalWorkspaceMode =
  | 'universal'
  | 'initial_writings'
  | 'responses_resources'
  | 'my-templates';

interface CaseFicha {
  expediente: string;
  actor: string;
  demandado: string;
  abogado: string;
  autoridad: string;
  fechas: string;
  materia: string;
  tipo: string;
  confianza: number;
}

const STAGES = [
  { id: 'classify', label: 'Clasificación' },
  { id: 'extract', label: 'Extracción' },
  { id: 'analyze', label: 'Análisis' },
  { id: 'structure', label: 'Estructura' },
  { id: 'identify_issues', label: 'Problemas jurídicos' },
  { id: 'generate_sections', label: 'Redacción por apartados' },
  { id: 'review_coherence', label: 'Revisión de coherencia' },
  { id: 'validate', label: 'Validación y calidad' },
];

function sanitizeClean(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFD]/g, '')
    .replace(/[□■]+/g, ' ')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1] && m[1].trim().length > 1) {
      return m[1].trim().replace(/[.;:,]*$/, '');
    }
  }
  return '';
}

function detectCaseFicha(texts: string[]): CaseFicha {
  const full = texts.join('\n\n');

  const expediente =
    firstMatch(full, [
      /(?:expediente|juicio|toca|amparo\s+directo|amparo\s+indirecto|proceso)\s*[:\-]?\s*([0-9]{1,6}\s*[\/\-\.]\s*[0-9]{2,4})/i,
    ]) || firstMatch(full, [/\b(\d{1,6}\/\d{4})\b/i]);

  const actor =
    firstMatch(full, [/(?:quejoso|actor|promovente|accionante|parte\s+actora)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i]) ||
    firstMatch(full, [/\b(?:C\.)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i]);

  const demandado =
    firstMatch(full, [/(?:demandado|parte\s+demandada|tercero\s+interesado)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i]);

  const abogado =
    firstMatch(full, [/(?:abogado\s+(?:patrono|defensor)|apoderado\s+legal|autorizado|representante\s+legal)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i]) ||
    firstMatch(full, [/\b(?:Lic\.)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i]);

  const autoridad =
    firstMatch(full, [/(?:autoridad\s+responsable|autoridad\s+señalada\s+como\s+responsable|autoridad\s+responsable\s+es)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i]) ||
    firstMatch(full, [/(?:responsable|órgano\s+jurisdiccional|tribunal|juzgado)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i]);

  const fechasMatch = full.match(/(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})|\b(\d{1,2}\/\d{1,2}\/\d{4})\b/gi);
  const fechas = fechasMatch ? Array.from(new Set(fechasMatch.map((f) => f.replace(/^,?\s*/, '')))).slice(0, 3).join(' · ') : '';

  let materia = 'Amparo';
  if (/laboral|trabajador|patr[oó]n|laudo|junta|burocr[áa]tico/i.test(full)) materia = 'Laboral';
  else if (/amparo|constitucional/i.test(full)) materia = 'Amparo';
  else if (/mercantil|comercio|cheque|pagar[ée]|t[ií]tulos\s+de\s+cr[ée]dito/i.test(full)) materia = 'Mercantil';
  else if (/civil|herencia|sucesi[oó]n|obligaciones|contrato/i.test(full)) materia = 'Civil';

  let tipo = 'Amparo Directo';
  if (/recurso\s+de\s+revisi[oó]n/i.test(full)) tipo = 'Recurso de Revisión';
  else if (/recurso\s+de\s+queja/i.test(full)) tipo = 'Recurso de Queja';
  else if (/contestaci[oó]n/i.test(full) && /demanda/i.test(full)) tipo = 'Contestación de Demanda';
  else if (/amparo\s+directo/i.test(full)) tipo = 'Amparo Directo';
  else if (/amparo\s+indirecto/i.test(full)) tipo = 'Amparo Indirecto';

  const foundCount = [expediente, actor, demandado, abogado, autoridad, fechas].filter(Boolean).length;
  const confianza = Math.min(100, Math.round(35 + foundCount * 11));

  return { expediente, actor, demandado, abogado, autoridad, fechas, materia, tipo, confianza };
}

export default function MachotesPage() {
  const [activeNavTab, setActiveNavTab] = useState<LegalWorkspaceMode>('universal');
  const [universalDoc, setUniversalDoc] = useState<UniversalLegalDocument | null>(null);
  const [activeSection, setActiveSection] = useState<DocumentNode | null>(null);
  const [selectedTextHighlight, setSelectedTextHighlight] = useState<string | null>(null);
  const [uploadedSourceDocs, setUploadedSourceDocs] = useState<UploadedSourceDocument[]>([]);
  const [caseDocuments, setCaseDocuments] = useState<CaseDocument[]>([]);
  const [selectedCaseDoc, setSelectedCaseDoc] = useState<CaseDocument | null>(null);
  const [caseFicha, setCaseFicha] = useState<CaseFicha | null>(null);
  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [selectedTemplateRefText, setSelectedTemplateRefText] = useState<string>('');
  const [isDraftGeneratorOpen, setIsDraftGeneratorOpen] = useState(false);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);
  const [editTemplateData, setEditTemplateData] = useState<any>(null);
  const [isEditCustomOpen, setIsEditCustomOpen] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [generationOperation, setGenerationOperation] = useState<'full-document' | 'section' | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const isUniversalGenerating = generationStatus === 'processing';
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const fileInputHiddenRef = useRef<HTMLInputElement>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
>>>>>>> Stashed changes

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [selectedTemplateId]);

<<<<<<< Updated upstream
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

  // Group templates by category
  const categories = useMemo(() => {
    const cats: Record<string, ProfessionalTemplate[]> = {};
    templates.forEach(t => {
      if (!cats[t.category]) cats[t.category] = [];
      cats[t.category].push(t);
    });
    return cats;
=======
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates/custom');
      const data = await res.json();
      if (data.ok && data.templates) {
        setCustomTemplates(data.templates.map((t: any) => ({
          id: t.id,
          name: t.title,
          category: t.category || 'General',
          matterId: t.practiceArea || t.category?.toLowerCase() || 'amparo',
          version: t.version || 1,
          description: t.description || undefined,
          updatedAt: t.updatedAt || new Date().toISOString(),
          pageCount: t.pageCount || undefined,
          sourceFileName: t.sourceFileName || undefined,
          structureJson: t.structureJson || null,
        })));
      }
    } catch {}
>>>>>>> Stashed changes
  }, []);

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
<<<<<<< Updated upstream
      const doc = renderToDocument(selectedTemplate, values);
      const { exportToDocx } = await import('@/lib/templates/exportDocx');
      const buffer = await exportToDocx(doc);
      const blob = new Blob([Uint8Array.from(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
=======
      const res = await fetch(`/api/templates/custom/${template.id}`);
      const data = await res.json();
      if (!data.ok || !data.template) throw new Error(data.error || 'No se pudo obtener la plantilla.');

      const tpl = data.template;
      const refText = sanitizeClean(tpl.originalText || tpl.content || '');
      setSelectedTemplate({ ...template, version: version?.version || template.version });
      setSelectedTemplateRefText(refText);

      const fileUrl =
        tpl.structureJson?.storage?.fileUrl ||
        (tpl.sourceFileName ? `/api/templates/files/${tpl.structureJson?.storage?.savedFileName || tpl.sourceFileName}` : undefined);

      const loadedDoc = structuredTemplateToUniversalDocument(tpl, fileUrl);

      setUniversalDoc(loadedDoc);
      setActiveSection(loadedDoc.sections[0]);
      setActiveNavTab('universal');
      notify('success', `Machote "${tpl.title}" abierto exitosamente.`);
    } catch (err: any) {
      notify('error', `Error al usar plantilla: ${err.message}`);
    }
  };

  const handleEditTemplate = async (template: TemplateItem) => {
    try {
      const res = await fetch(`/api/templates/custom/${template.id}`);
      const data = await res.json();
      if (!data.ok || !data.template) throw new Error(data.error || 'No se pudo abrir plantilla.');
      setEditTemplateData(data.template);
      setIsEditCustomOpen(true);
    } catch (err: any) {
      notify('error', `Error: ${err.message}`);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/custom/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        notify('success', 'Plantilla eliminada correctamente.');
        loadTemplates();
      } else {
        notify('error', data.error || 'No se pudo eliminar.');
      }
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  /* ── Generación de Escrito Completo (Con Motor Jurídico Real) ─────────── */
  const handleRunPipeline = async (payload: {
    userInstruction: string;
    intentLabel?: string;
    sourceDocs: UploadedSourceDocument[];
    selectedTemplate?: TemplateItem | null;
    templateRefText?: string;
  }): Promise<GenerationResult> => {
    if (generationStatus === 'processing') {
      return { success: false, error: 'Ya hay una generación en curso.' };
    }

    console.log('[Machotes][Generate] START');
    setGenerationStatus('processing');
    setGenerationOperation('full-document');
    setGenerationError(null);
    setPipelineStageIndex(0);
    setFeedback(null);
    notify('warning', 'Analizando expediente y redactando escrito judicial adaptado...');

    const stageTimer = window.setInterval(() => {
      setPipelineStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, 1200);

    const controller = new AbortController();
    generationAbortRef.current = controller;

    // Timeout de 5 minutos (5 * 60 * 1000 = 300,000 ms)
    const timeoutDuration = 5 * 60 * 1000;
    const timeoutId = window.setTimeout(() => {
      console.log('[Machotes][Generate] TIMEOUT');
      controller.abort();
    }, timeoutDuration);

    try {
      console.log('[Machotes][Generate] REQUEST_SENT');
      const res = await fetch('/api/legal-engine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInstruction: payload.userInstruction,
          sourceDocuments: payload.sourceDocs.length > 0 ? payload.sourceDocs : uploadedSourceDocs,
          allowUnvalidatedSource: true,
          referenceDocumentText: payload.templateRefText || selectedTemplateRefText || undefined,
          referenceDocumentId: payload.selectedTemplate?.id,
          documentTypeLabel: payload.intentLabel || payload.selectedTemplate?.category || undefined,
        }),
        signal: controller.signal,
      });

      console.log('[Machotes][Generate] RESPONSE_RECEIVED');
      window.clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const rawText = await res.text();
        const truncatedBody = rawText.substring(0, 300);
        const errMsg = `El servidor devolvió una respuesta no válida.\nStatus: ${res.status} ${res.statusText}\nContent-Type: ${contentType}\nBody: ${truncatedBody}...`;
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      if (!data?.ok) {
        throw new Error(data?.error || 'El servidor no pudo generar el documento.');
      }

      if (!data.document) {
        throw new Error('El servidor respondió correctamente, pero no devolvió un documento.');
      }

      console.log('[Machotes][Generate] DOCUMENT_RECEIVED');
      setUniversalDoc(data.document);
      if (data.document.sections && data.document.sections.length > 0) {
        setActiveSection(data.document.sections[0]);
      }
      setPipelineStageIndex(STAGES.length - 1);
      setGenerationStatus('success');
      notify('success', '✓ Contestación generada correctamente. El documento está listo para revisión.');
      console.log('[Machotes][Generate] SUCCESS');
      return { success: true, document: data.document };
    } catch (err: any) {
      window.clearTimeout(timeoutId);

      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        console.log('[Machotes][Generate] ABORTED');
        const errorMsg = 'La generación excedió el tiempo máximo de espera de 5 minutos o fue cancelada por el usuario.';
        setGenerationError(errorMsg);
        setGenerationStatus('cancelled');
        notify('error', errorMsg);
        return { success: false, error: errorMsg };
      } else {
        const errorMsg = err.message || 'Error desconocido';
        console.log('[Machotes][Generate] ERROR:', errorMsg);
        setGenerationError(errorMsg);
        setGenerationStatus('error');
        notify('error', `No se pudo generar la contestación: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } finally {
      window.clearInterval(stageTimer);
      generationAbortRef.current = null;
      setGenerationOperation(null);
    }
  };

  /* ── Regenerar Apartado ───────────────────────────────────────────────── */
  const handleRegenerateSection = async (sectionId: string, instruction?: string) => {
    if (!universalDoc) return;
    if (generationStatus === 'processing') return;
    setGenerationStatus('processing');
    setGenerationOperation('section');
    notify('warning', 'Actualizando apartado con IA...');

    try {
      const res = await fetch('/api/legal-engine/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: universalDoc, sectionId, instruction }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Error en el servidor de IA.');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const updatedSections = universalDoc.sections.map((sec) => {
        if (sec.id === sectionId) {
          const blockId = sec.content[0]?.id || crypto.randomUUID();
          return {
            ...sec,
            isManuallyEdited: false,
            content: [
              {
                id: blockId,
                layer: 'GENERATED_ARGUMENT' as const,
                trustLevel: 'VERIFIED' as const,
                text: sanitizeClean(data.text),
                sources: data.sources,
                isManuallyEdited: false,
                style: sec.content[0]?.style || {
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  textAlign: 'justify',
                  lineHeight: '1.6',
                },
              },
            ],
          };
        }
        return sec;
      });

      const updated = { ...universalDoc, sections: updatedSections, updatedAt: new Date().toISOString() };
      setUniversalDoc(updated);
      const updatedActive = updated.sections.find((s) => s.id === sectionId) || null;
      if (updatedActive) setActiveSection(updatedActive);

      notify('success', 'Apartado actualizado correctamente.');
    } catch (err: any) {
      notify('error', `No se pudo regenerar el apartado: ${err.message}`);
    } finally {
      setGenerationStatus('idle');
      setGenerationOperation(null);
    }
  };

  /* ── Guardar / Exportar ────────────────────────────────────────────────── */
  const handleSaveDraft = async (): Promise<boolean> => {
    if (!universalDoc) return false;
    try {
      const res = await fetch('/api/legal-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: universalDoc.title,
          documentType: universalDoc.documentType,
          matter: universalDoc.matter,
          structuredDoc: universalDoc,
          sourceDocuments: universalDoc.sourceDocuments,
          generationMetadata: universalDoc.generationMetadata,
          status: universalDoc.status === 'final' ? 'READY_FOR_PROFESSIONAL_REVIEW' : 'DRAFT',
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      try {
        localStorage.setItem('jr_last_draft_id', data.draft.id);
      } catch { /* noop */ }
      notify('success', `Borrador guardado: "${data.draft.title}".`);
      return true;
    } catch (err: any) {
      notify('error', `No se pudo guardar el borrador: ${err.message}`);
      return false;
    }
  };

  const handleExportDocx = async () => {
    if (!universalDoc) return;
    try {
      const res = await fetch('/api/legal-engine/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: universalDoc }),
      });
      if (!res.ok) throw new Error('Error al generar DOCX en servidor.');

      const blob = await res.blob();
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
  const handleExportPdf = async () => {
    if (!universalDoc) return;
    const payload = {
      documentType: universalDoc.documentTypeLabel,
      documentTitle: universalDoc.title,
      dateStr: new Date().toISOString(),
      renderedSections: universalDoc.sections.map((s) => ({
        title: s.title,
        content: s.content.map((b) => b.text).join('\n\n'),
        blocks: s.content,
      })),
    };
    try {
      const res = await fetch('/api/legal-engine/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
            <div className="flex items-center gap-2">
=======
          </div>
        ) : activeNavTab === 'responses_resources' ? (
          /* TAB 3: CONTESTACIONES Y RECURSOS (PANEL DE COTEJO DOCUMENTAL 1:1) */
          <div className="flex w-full min-h-0 min-w-0 overflow-hidden">
            <CaseDocumentsReader
              documents={caseDocuments}
              sourceDocs={uploadedSourceDocs}
              selectedDocId={selectedCaseDoc?.id}
              onSelectDocument={(doc) => setSelectedCaseDoc(doc)}
              onUploadNewDocument={() => fileInputHiddenRef.current?.click()}
              onGenerateResponse={(fragment) => {
                if (fragment) {
                  setSelectedTextHighlight(fragment);
                }
                setIsDraftGeneratorOpen(true);
              }}
              onOpenEditor={() => {
                setUniversalViewMode('editor');
                setActiveNavTab('universal');
              }}
            />
          </div>
        ) : activeNavTab === 'initial_writings' && initialViewMode === 'form' ? (
          /* TAB 2: ESCRITOS INICIALES - FORMULARIO JURÍDICO ESPECIALIZADO */
          <div className="w-full min-h-0 overflow-y-auto font-sans">
            <div className="w-full max-w-[1800px] mx-auto px-5 md:px-6 py-5 md:py-6 space-y-4">
              {/* Encabezado Superior */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
                <div className="space-y-0.5">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Escritos Iniciales
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Genera demandas y escritos iniciales con fundamentación procesal y técnica jurídica.
                  </p>
                </div>

                {universalDoc && (
                  <button
                    onClick={() => setInitialViewMode('editor')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <span>Continuar al editor jurídico</span>
                    <span>→</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4.5 items-start">
                {/* Columna Principal: Formulario Estructurado */}
                <div className={`${hasInitialContext ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4`}>
                  <div className="border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">
                      Datos procesales del escrito inicial
                    </h2>
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-800">
                    {/* Materia y Tipo de Escrito */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Materia</label>
                        <select
                          value={initialForm.materia}
                          onChange={(e) => setInitialForm((prev) => ({ ...prev, materia: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
                        >
                          <option value="Amparo">Amparo</option>
                          <option value="Laboral">Laboral</option>
                          <option value="Civil">Civil</option>
                          <option value="Mercantil">Mercantil</option>
                          <option value="Administrativo/Fiscal">Administrativo / Fiscal</option>
                          <option value="Familiar">Familiar</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Tipo de Escrito / Juicio</label>
                        <input
                          type="text"
                          value={initialForm.tipoEscrito}
                          onChange={(e) => setInitialForm((prev) => ({ ...prev, tipoEscrito: e.target.value }))}
                          placeholder="Ej. Demanda de Amparo Indirecto"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                        />
                      </div>
                    </div>

                    {/* Partes Procesales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Parte Promovente / Quejoso</label>
                        <input
                          type="text"
                          value={initialForm.promovente}
                          onChange={(e) => setInitialForm((prev) => ({ ...prev, promovente: e.target.value }))}
                          placeholder="Nombre completo o razón social"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Autoridad Responsable / Demandado</label>
                        <input
                          type="text"
                          value={initialForm.demandado}
                          onChange={(e) => setInitialForm((prev) => ({ ...prev, demandado: e.target.value }))}
                          placeholder="Nombre o autoridad señalada"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                        />
                      </div>
                    </div>

                    {/* Prestaciones / Pretensiones */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Prestaciones / Acto Reclamado</label>
                      <textarea
                        rows={2}
                        value={initialForm.pretensiones}
                        onChange={(e) => setInitialForm((prev) => ({ ...prev, pretensiones: e.target.value }))}
                        placeholder="Indica qué solicitas o cuál es el acto impugnado..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                      />
                    </div>

                    {/* Hechos */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Hechos Fundatorios</label>
                      <textarea
                        rows={3}
                        value={initialForm.hechos}
                        onChange={(e) => setInitialForm((prev) => ({ ...prev, hechos: e.target.value }))}
                        placeholder="Relata cronológicamente los antecedentes y hechos relevantes..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                      />
                    </div>

                    {/* Pruebas e Instrucciones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Pruebas a Ofrecer (Opcional)</label>
                        <input
                          type="text"
                          value={initialForm.pruebas}
                          onChange={(e) => setInitialForm((prev) => ({ ...prev, pruebas: e.target.value }))}
                          placeholder="Ej. Documental pública, testimonial, etc."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Instrucción Especial para IA</label>
                        <input
                          type="text"
                          value={initialForm.instrucciones}
                          onChange={(e) => setInitialForm((prev) => ({ ...prev, instrucciones: e.target.value }))}
                          placeholder="Ej. Énfasis en suplencia de la queja..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                        />
                      </div>
                    </div>

                    {/* Botón de Acción Principal */}
                    <div className="pt-2 flex items-center justify-end gap-3">
                      <button
                        onClick={async () => {
                          const promptText = `Formular ${initialForm.tipoEscrito || 'Demanda'} en materia ${initialForm.materia}. Promovente: ${initialForm.promovente || 'Parte actora'}. Demandado/Autoridad: ${initialForm.demandado || 'Autoridad señalada'}. Acto/Prestaciones: ${initialForm.pretensiones || 'Las que en derecho procedan'}. Hechos: ${initialForm.hechos || 'Hechos expuestos'}. Pruebas: ${initialForm.pruebas || 'De ley'}. Instrucciones: ${initialForm.instrucciones || 'Formato formal judicial'}.`;
                          const result = await handleRunPipeline({
                            userInstruction: promptText,
                            intentLabel: initialForm.tipoEscrito || 'Escrito Inicial',
                            sourceDocs: uploadedSourceDocs,
                          });
                          if (result.success) {
                            setInitialViewMode('editor');
                          }
                        }}
                        disabled={isUniversalGenerating}
                        className="px-6 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition flex items-center gap-2"
                      >
                        <span>⚡</span>
                        <span>{isUniversalGenerating ? 'Generando Escrito Inicial...' : 'Generar Escrito Inicial con IA'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Contexto real del expediente (solo si existe) */}
                {hasInitialContext && (
                  <div className="lg:col-span-5 space-y-4">
                    {caseFicha && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          <span>📋</span>
                          <span>Ficha del expediente</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-700">
                          {caseFicha.expediente && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Expediente</span>
                              <p className="font-mono font-semibold text-[#0B2545]">{caseFicha.expediente}</p>
                            </div>
                          )}
                          {caseFicha.materia && (
                            <div className="space-y-0.5">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Materia</span>
                              <p className="font-semibold">{caseFicha.materia}</p>
                            </div>
                          )}
                          {caseFicha.tipo && (
                            <div className="space-y-0.5">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Tipo</span>
                              <p className="font-semibold truncate">{caseFicha.tipo}</p>
                            </div>
                          )}
                          {caseFicha.actor && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Parte promovente</span>
                              <p className="font-semibold">{caseFicha.actor}</p>
                            </div>
                          )}
                          {caseFicha.demandado && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Demandado / Autoridad</span>
                              <p className="font-semibold">{caseFicha.demandado}</p>
                            </div>
                          )}
                          {caseFicha.abogado && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Abogado</span>
                              <p className="font-semibold">{caseFicha.abogado}</p>
                            </div>
                          )}
                          {caseFicha.autoridad && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Autoridad</span>
                              <p className="font-semibold">{caseFicha.autoridad}</p>
                            </div>
                          )}
                          {caseFicha.fechas && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Fechas</span>
                              <p className="font-semibold">{caseFicha.fechas}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {uploadedSourceDocs.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2.5">
                        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          <span>📄</span>
                          <span>Documentos del expediente</span>
                        </h3>
                        <div className="space-y-1.5">
                          {uploadedSourceDocs.map((doc) => (
                            <div key={doc.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 truncate font-mono">
                              📄 {doc.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeNavTab === 'universal' && universalViewMode === 'analysis' ? (
          /* TAB 1: MOTOR UNIVERSAL — 3 COLUMNAS (Contexto | Análisis jurídico | Fuentes y trazabilidad) */
          <div className="w-full min-h-0 overflow-y-auto font-sans">
            <div className="w-full max-w-[1800px] mx-auto px-5 md:px-6 py-5 md:py-6 space-y-4">
              {/* Encabezado Superior */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
                <div className="space-y-0.5">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Motor Jurídico
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Analiza problemas jurídicos utilizando documentos, legislación, jurisprudencia y fuentes verificables.
                  </p>
                </div>
                {universalDoc && (
                  <button
                    onClick={() => setUniversalViewMode('editor')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <span>Continuar al editor jurídico</span>
                    <span>→</span>
                  </button>
                )}
              </div>

              {/* Grid de 3 Columnas Exacto a la Referencia */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4.5 items-start">
                {/* ── COLUMNA 1: CONTEXTO (lg:col-span-3) ── */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                    Contexto
                  </h2>

                  <div className="space-y-3.5 text-xs text-slate-800">
                    {/* Pregunta Jurídica */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Pregunta jurídica</label>
                      <textarea
                        rows={4}
                        value={universalForm.pregunta}
                        onChange={(e) => setUniversalForm((prev) => ({ ...prev, pregunta: e.target.value }))}
                        placeholder="Escribe la consulta o problema procesal a analizar..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0B2545] leading-relaxed"
                      />
                    </div>

                    {/* Documentos */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">Documentos</span>
                        <button
                          type="button"
                          onClick={() => fileInputHiddenRef.current?.click()}
                          className="text-[11px] font-bold text-[#0B2545] hover:underline"
                        >
                          [+ Agregar]
                        </button>
                      </div>

                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {uploadedSourceDocs.length === 0 ? (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-400 italic">
                            Sin documentos adjuntos.
                          </div>
                        ) : (
                          uploadedSourceDocs.map((doc) => (
                            <div key={doc.id} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 truncate font-mono flex items-center gap-1.5">
                              <span>📄</span>
                              <span className="truncate">{doc.name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Expediente */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Expediente</label>
                      <input
                        type="text"
                        value={universalForm.expediente || liveCaseFicha?.expediente || ''}
                        onChange={(e) => setUniversalForm((prev) => ({ ...prev, expediente: e.target.value }))}
                        placeholder="Número de expediente (ej. 123/2024)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
                      />
                      {liveCaseFicha?.expediente && !universalForm.expediente && (
                        <p className="text-[10px] text-slate-400 italic">
                          Detectado en documento: {liveCaseFicha.expediente}
                        </p>
                      )}
                    </div>

                    {/* Materia */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Materia</label>
                      <select
                        value={universalForm.materia}
                        onChange={(e) => setUniversalForm((prev) => ({ ...prev, materia: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
                      >
                        <option value="Amparo">[Amparo]</option>
                        <option value="Laboral">[Laboral]</option>
                        <option value="Civil">[Civil]</option>
                        <option value="Mercantil">[Mercantil]</option>
                        <option value="Administrativo/Fiscal">[Administrativo / Fiscal]</option>
                      </select>
                    </div>

                    {/* Jurisdicción */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Jurisdicción</label>
                      <select
                        value={universalForm.jurisdiccion}
                        onChange={(e) => setUniversalForm((prev) => ({ ...prev, jurisdiccion: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
                      >
                        <option value="Federal">[Federal]</option>
                        <option value="Local - CDMX">[Local - CDMX]</option>
                        <option value="Local - Estados">[Local - Entidad Federativa]</option>
                      </select>
                    </div>

                    {/* Fuentes Checkboxes */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <span className="font-bold text-slate-700 block">Fuentes</span>
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={universalForm.fuentes.legislacion}
                            onChange={(e) => setUniversalForm((prev) => ({ ...prev, fuentes: { ...prev.fuentes, legislacion: e.target.checked } }))}
                            className="rounded border-slate-300 text-[#0B2545]"
                          />
                          <span>Legislación</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={universalForm.fuentes.jurisprudencia}
                            onChange={(e) => setUniversalForm((prev) => ({ ...prev, fuentes: { ...prev.fuentes, jurisprudencia: e.target.checked } }))}
                            className="rounded border-slate-300 text-[#0B2545]"
                          />
                          <span>Jurisprudencia</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={universalForm.fuentes.expediente}
                            onChange={(e) => setUniversalForm((prev) => ({ ...prev, fuentes: { ...prev.fuentes, expediente: e.target.checked } }))}
                            className="rounded border-slate-300 text-[#0B2545]"
                          />
                          <span>Documentos del expediente</span>
                        </label>
                      </div>
                    </div>

                    {/* Botón Ejecutar Análisis */}
                    <div className="pt-2">
                      <button
                        onClick={async () => {
                          await handleRunPipeline({
                            userInstruction: universalForm.pregunta,
                            intentLabel: 'Análisis Jurídico',
                            sourceDocs: uploadedSourceDocs,
                          });
                        }}
                        disabled={isUniversalGenerating}
                        className="w-full py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition flex items-center justify-center gap-2"
                      >
                        <span>⚡</span>
                        <span>{isUniversalGenerating ? 'Ejecutando análisis...' : 'Ejecutar análisis'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── COLUMNA 2: ANÁLISIS JURÍDICO (lg:col-span-6) ── */}
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  {/* Status Bar Superior */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-600 font-medium overflow-x-auto no-scrollbar">
                      <span className="font-bold text-slate-700">Estado:</span>
                      <span className={`font-bold flex items-center gap-0.5 ${uploadedSourceDocs.length > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {uploadedSourceDocs.length > 0 ? '✓' : '○'} Doc. procesados
                      </span>
                      <span className={`font-bold flex items-center gap-0.5 ${universalDoc !== null ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {universalDoc !== null ? '✓' : '○'} Análisis generado
                      </span>
                      <span className={`font-bold flex items-center gap-0.5 ${universalDoc?.generationMetadata?.aiUsed === true ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {universalDoc?.generationMetadata?.aiUsed === true ? '✓' : '○'} IA ejecutada
                      </span>
                      <span className={`font-bold flex items-center gap-0.5 ${uploadedSourceDocs.length > 0 && uploadedSourceDocs.every(d => d.sourceValidated !== false) ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {uploadedSourceDocs.length > 0 && uploadedSourceDocs.every(d => d.sourceValidated !== false) ? '✓' : '○'} Fuentes verificadas
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 shrink-0">
                      Fuentes: {uploadedSourceDocs.length > 0 ? uploadedSourceDocs.length : 'Ninguna'}
                    </span>
                  </div>

                  {/* Contenido del Análisis */}
                  {isUniversalGenerating ? (
                    <div className="py-8 space-y-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-800">
                        <span className="w-4 h-4 rounded-full border-2 border-[#234e4b] border-t-transparent animate-spin shrink-0" />
                        <span className="font-bold">Ejecutando análisis: {generatingStage?.label || 'Procesando...'}</span>
                      </div>
                    </div>
                  ) : uploadedSourceDocs.length === 0 && !universalDoc ? (
                    <div className="machotes-empty">
                      No hay información analizada todavía. Adjunta un documento y ejecuta el análisis.
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs text-slate-800">
                      <div className="space-y-1">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Problema jurídico</span>
                        <p className="font-semibold text-slate-900 leading-snug">
                          {universalForm.pregunta || universalDoc?.title || 'Sin problema jurídico capturado.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div className="space-y-1.5">
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Datos detectados</span>
                          {liveCaseFicha && (liveCaseFicha.actor || liveCaseFicha.demandado || liveCaseFicha.autoridad || liveCaseFicha.expediente) ? (
                            <ul className="text-[11px] text-slate-700 leading-relaxed">
                              {liveCaseFicha.expediente && <li><strong>Expediente:</strong> {liveCaseFicha.expediente}</li>}
                              {liveCaseFicha.actor && <li><strong>Actor:</strong> {liveCaseFicha.actor}</li>}
                              {liveCaseFicha.demandado && <li><strong>Demandado:</strong> {liveCaseFicha.demandado}</li>}
                              {liveCaseFicha.autoridad && <li><strong>Autoridad:</strong> {liveCaseFicha.autoridad}</li>}
                            </ul>
                          ) : (
                            <div className="machotes-empty">Sin datos estructurados detectados.</div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Documentos fuente</span>
                          <ul className="text-[11px] text-slate-700 leading-relaxed">
                            {uploadedSourceDocs.map((doc) => <li key={doc.id}>{doc.name}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Estructura disponible</span>
                        {universalDoc?.sections?.length ? (
                          <div className="grid gap-2">
                            {universalDoc.sections.slice(0, 8).map((section) => (
                              <div key={section.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                <strong className="text-slate-900">{section.title}</strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="machotes-empty">El análisis todavía no ha producido apartados estructurados.</div>
                        )}
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Conclusión</span>
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11.5px] text-slate-800 leading-relaxed">
                          La conclusión se mostrará aquí únicamente cuando exista una salida del motor para este expediente.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Barra de Acciones Inferior */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleSaveDraft()}
                      className="flex-1 min-w-[120px] py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition text-center"
                    >
                      Guardar análisis
                    </button>
                    <button
                      onClick={() => setUniversalViewMode('editor')}
                      className="flex-1 min-w-[140px] py-2 px-3 bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-bold rounded-xl shadow-xs transition text-center"
                    >
                      Convertir en escrito
                    </button>
                    <button
                      onClick={() => handleExportDocx()}
                      className="py-2 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition text-center"
                    >
                      Exportar
                    </button>
                  </div>
                </div>

                {/* ── COLUMNA 3: FUENTES Y TRAZABILIDAD (lg:col-span-3) ── */}
                <div className="lg:col-span-3 space-y-3.5">
                  <h2 className="text-sm font-bold text-slate-900 px-1">
                    Fuentes y trazabilidad
                  </h2>

                  {uploadedSourceDocs.length === 0 ? (
                    <div className="machotes-empty">No hay fuentes del expediente cargadas.</div>
                  ) : (
                    uploadedSourceDocs.slice(0, 8).map((doc) => (
                      <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                          <span>📄</span>
                          <span className="font-semibold text-slate-600 truncate">Documento fuente</span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xs font-bold text-slate-900 truncate">{doc.name}</h3>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Páginas: <strong className="text-slate-700">{doc.pages?.length || 1}</strong></span>
                            <span>Estado: <strong className="text-slate-700">{doc.sourceValidated === false ? 'Revisión' : 'Verificada'}</strong></span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedCaseDoc(caseDocuments.find((c) => c.id === doc.id) || null)} className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl shadow-2xs transition">Ver fuente</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

                  ) : (
          /* TAB 1 (O ESCRITOS EN MODO EDITOR): VISOR PAGINADO Y EDITOR CARTA 1:1 */
          <div className="flex w-full min-h-0 min-w-0 overflow-hidden flex-col">
            <div className="shrink-0 bg-white border-b border-[#ded8c9] px-4 py-2 flex items-center justify-between shadow-xs">
              <span className="text-xs font-bold text-[#0B2545]">
                {activeNavTab === 'initial_writings'
                  ? `Escrito Inicial en Editor Paginado: ${universalDoc?.title || 'Demanda'}`
                  : `Editor Jurídico Paginado: ${universalDoc?.title || 'Documento en Redacción'}`}
              </span>
>>>>>>> Stashed changes
              <button
                type="button"
                onClick={triggerQuickReview}
                className="bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 font-medium text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5"
              >
                ⚡ Revisión Rápida
              </button>
              <button
                type="button"
                onClick={triggerDeepReview}
                className="bg-purple-700 hover:bg-purple-800 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition shadow flex items-center gap-1.5"
              >
                🧠 Revisión Profunda (3 IA)
              </button>
            </div>
          </div>
        </header>

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
            <span style={{ fontSize: '0.8rem', color: '#93c5fd' }}>Fundamento: {selectedTemplate.legalBasis}</span>
          </div>
          <div className="machote-status-pill">
            En revisión
          </div>
        </div>

        <div className="legal-warning glass-card" style={{ marginBottom: '2rem' }}>
          <strong>ADVERTENCIA PROFESIONAL:</strong> {selectedTemplate.disclaimer}
          {selectedTemplate.warnings && selectedTemplate.warnings.length > 0 && (
            <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
              {selectedTemplate.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>

        {hasDraftMarkers && (
          <div className="legal-warning glass-card" role="alert" style={{ marginBottom: '2rem', borderColor: '#f59e0b' }}>
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

<<<<<<< Updated upstream
            <div className="machote-fields">
              {selectedTemplate.sections.map(section => {
                const canUseAI = aiEnabledSections.has(section.id);
=======
      {/* MODAL 1: Generador de Borrador / Redacción con Machote */}
      {isDraftGeneratorOpen && (
        <WorkspaceDraftGeneratorModal
          isOpen={isDraftGeneratorOpen}
          onClose={() => {
            setIsDraftGeneratorOpen(false);
            setGenerationStatus('idle');
            setGenerationError(null);
          }}
          tabMode={activeNavTab === 'my-templates' ? 'universal' : activeNavTab}
          onGenerate={handleRunPipeline}
          templates={customTemplates}
          uploadedSources={uploadedSourceDocs}
          onUploadFiles={handleFileUpload}
          onRemoveUploadedSource={handleRemoveUploadedSource}
          caseFicha={caseFicha}
          onAnalyzeCase={() => {
            if (uploadedSourceDocs.length > 0) {
              const ficha = detectCaseFicha(uploadedSourceDocs.map((s) => s.extractedText || ''));
              setCaseFicha(ficha);
              notify('success', `Caso detectado: ${ficha.materia} · ${ficha.tipo}`);
            }
          }}
          generationStatus={generationStatus}
          generationError={generationError}
          pipelineStageIndex={pipelineStageIndex}
          onContinueToEditor={() => {
            setIsDraftGeneratorOpen(false);
            setGenerationStatus('idle');
            setGenerationError(null);
            if (activeNavTab === 'initial_writings') {
              setInitialViewMode('editor');
            } else {
              setUniversalViewMode('editor');
              setActiveNavTab('universal');
            }
            notify('success', '✓ Documento abierto en el editor jurídico.');
          }}
          onCancelGeneration={() => {
            console.log('[Machotes][Generate] CANCELLED');
            generationAbortRef.current?.abort();
            generationAbortRef.current = null;
            setGenerationStatus('cancelled');
            setGenerationOperation(null);
            notify('warning', 'La generación de documento fue cancelada.');
          }}
          onOpenUploadCustomTemplateModal={() => setIsSaveCustomOpen(true)}
        />
      )}
>>>>>>> Stashed changes

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
            >
              {renderedText || 'Complete el formulario para ver la previsualización del documento.'}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
