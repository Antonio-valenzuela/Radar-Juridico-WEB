'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WorkspaceDocumentEditor } from './components/WorkspaceDocumentEditor';
import { WorkspaceDraftGeneratorModal } from './components/WorkspaceDraftGeneratorModal';
import { TemplateLibraryManager, TemplateItem } from './components/TemplateLibraryManager';
import { SaveCustomTemplateModal } from '@/components/machotes/SaveCustomTemplateModal';
import { EditCustomTemplateModal } from '@/components/machotes/EditCustomTemplateModal';

import type {
  UniversalLegalDocument,
  UploadedSourceDocument,
  CaseDocument,
  TemplateVersion,
  DocumentPage,
  DocumentNode,
  ContentBlock,
} from '@/lib/legal-engine/types';
import { createEmptyDocument } from '@/lib/legal-engine/types';
import { createSourceDocument } from '@/lib/legal-engine/context';

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

  // Documento activo en el visor paginado (Inicializado en null para cargar exclusivamente documentos reales)
  const [universalDoc, setUniversalDoc] = useState<UniversalLegalDocument | null>(null);
  const [activeSection, setActiveSection] = useState<DocumentNode | null>(null);
  const [, setSelectedTextHighlight] = useState<string | null>(null);

  const [uploadedSourceDocs, setUploadedSourceDocs] = useState<UploadedSourceDocument[]>([]);
  const [, setCaseDocuments] = useState<CaseDocument[]>([]);
  const [, setSelectedCaseDoc] = useState<CaseDocument | null>(null);
  const [caseFicha, setCaseFicha] = useState<CaseFicha | null>(null);

  // Plantillas
  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>([]);
  const [, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [selectedTemplateRefText, setSelectedTemplateRefText] = useState<string>('');

  // Modales
  const [isDraftGeneratorOpen, setIsDraftGeneratorOpen] = useState(false);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);
  const [editTemplateData, setEditTemplateData] = useState<any>(null);
  const [isEditCustomOpen, setIsEditCustomOpen] = useState(false);

  // Generación y Pipeline
  const [isUniversalGenerating, setIsUniversalGenerating] = useState(false);
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);

  // Feedback Banner
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const fileInputHiddenRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((tone: 'success' | 'error' | 'warning', message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 7000);
  }, []);

  // Cargar plantillas de la base de datos
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates/custom');
      const data = await res.json();
      if (data.ok && data.templates) {
        const mapped: TemplateItem[] = data.templates.map((t: any) => ({
          id: t.id,
          name: t.title,
          category: t.category || 'General',
          matterId: t.practiceArea || 'amparo',
          version: t.version || 1,
          description: t.description || '',
          updatedAt: t.updatedAt,
        }));
        setCustomTemplates(mapped);
      }
    } catch {
      // Silencioso
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  /* ── Cambio de Modo de Redacción ───────────────────────────────────────── */
  const handleSwitchMode = (mode: LegalWorkspaceMode) => {
    setActiveNavTab(mode);
    if (mode === 'universal') {
      // Mantiene el documento real actual
    } else if (mode === 'initial_writings') {
      if (!universalDoc) {
        const initialDoc: UniversalLegalDocument = createEmptyDocument({
          id: `doc-${Date.now()}`,
          title: 'Demanda de Amparo Indirecto',
          documentType: 'amparo_indirecto',
          documentTypeLabel: 'Amparo Indirecto',
          matter: 'Amparo',
          jurisdiction: 'Cd. de México',
          sections: [
            {
              id: 'sec-proemio',
              type: 'header',
              title: 'I. Quejoso y Acreditación de Personalidad',
              order: 1,
              isRepeatable: false,
              isEditable: true,
              isGenerated: false,
              isManuallyEdited: false,
              variables: [],
              validationErrors: [],
              validationWarnings: [],
              content: [
                {
                  id: 'blk-init-1',
                  layer: 'USER_POSITION',
                  trustLevel: 'VERIFIED',
                  text: 'C. JUEZ DE DISTRITO EN MATERIA DE AMPARO EN TURNO.\n\n[DATO PENDIENTE DE EXPEDIENTE: Nombre del quejoso], promoviendo por mi propio derecho...',
                  isManuallyEdited: false,
                  style: { fontFamily: 'inherit', fontSize: '13px', textAlign: 'justify', lineHeight: '1.6' },
                },
              ],
            },
          ],
        });
        setUniversalDoc(initialDoc);
        setActiveSection(initialDoc.sections[0]);
      }
      notify('success', 'Modo Escritos Iniciales.');
    } else if (mode === 'responses_resources') {
      if (!universalDoc) {
        const responseDoc: UniversalLegalDocument = createEmptyDocument({
          id: `doc-${Date.now()}`,
          title: 'Recurso de Revisión',
          documentType: 'recurso_revision',
          documentTypeLabel: 'Recurso de Revisión',
          matter: 'Amparo',
          jurisdiction: 'Cd. de México',
          sections: [
            {
              id: 'sec-proemio-resp',
              type: 'header',
              title: 'I. Proemio y Objeto del Recurso',
              order: 1,
              isRepeatable: false,
              isEditable: true,
              isGenerated: false,
              isManuallyEdited: false,
              variables: [],
              validationErrors: [],
              validationWarnings: [],
              content: [
                {
                  id: 'blk-resp-1',
                  layer: 'USER_POSITION',
                  trustLevel: 'VERIFIED',
                  text: 'H. TRIBUNAL COLEGIADO DE CIRCUITO EN TURNO.\n\n[DATO PENDIENTE DE EXPEDIENTE: Nombre del recurrente], comparezco a interponer formal Recurso de Revisión...',
                  isManuallyEdited: false,
                  style: { fontFamily: 'inherit', fontSize: '13px', textAlign: 'justify', lineHeight: '1.6' },
                },
              ],
            },
          ],
        });
        setUniversalDoc(responseDoc);
        setActiveSection(responseDoc.sections[0]);
      }
      notify('success', 'Modo Contestaciones y Recursos.');
    }
  };

  /* ── Carga y Procesamiento de Documento Real (PDF/DOCX) CON PRESERVACIÓN DE PÁGINAS REALES ── */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    if (fileInputHiddenRef.current) fileInputHiddenRef.current.value = '';

    notify('warning', `Procesando documento oficial "${fileList[0].name}" con preservación paginada...`);

    const sources: UploadedSourceDocument[] = [];
    const caseDocs: CaseDocument[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/templates/analyze-upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || 'No se pudo procesar el archivo.');
        }

        const sourceValidated = data.sourceValidated !== false;
        const pages: DocumentPage[] = data.pages?.length
          ? data.pages.map((p: any) => ({
              page: p.page,
              text: sanitizeClean(p.text || ''),
              chars: p.chars || 0,
            }))
          : [{ page: 1, text: sanitizeClean(data.extractedText || ''), chars: data.extractedText?.length || 0 }];

        const newSource: UploadedSourceDocument = createSourceDocument({
          id: data.fileId || `doc-${Date.now()}-${i}`,
          filename: file.name,
          name: file.name,
          type: file.type || ext,
          extractedText: sanitizeClean(data.extractedText || ''),
          pages,
          sourceValidated,
          sourceValidationMethod: data.sourceValidationMethod,
          qualityScore: data.qualityScore,
          warnings: data.warnings,
        });

        const newCaseDoc: CaseDocument = {
          id: newSource.id,
          name: file.name,
          type: ext,
          pageCount: pages.length,
          pages: pages.map((p) => ({
            page: p.page,
            text: p.text,
            chars: p.chars,
            ocrStatus: data.needsOcr ? 'OCR' : 'nativo',
          })),
          role: 'fuente_general',
          status: sourceValidated ? 'READY' : 'NEEDS_MANUAL_REVIEW',
          uploadedAt: new Date().toISOString(),
        };

        sources.push(newSource);
        caseDocs.push(newCaseDoc);

        if (i === 0) {
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

          // Cada página física del archivo original es una sección paginada exacta
          const sections: DocumentNode[] = pages.map((p, pIdx) => {
            const rawParagraphs = (p.text || '').split(/\n\s*\n/).filter((t) => t.trim().length > 0);
            const blocks: ContentBlock[] = (rawParagraphs.length > 0 ? rawParagraphs : [p.text || 'Sin texto extraído']).map((parText, bIdx) => {
              const trimmed = sanitizeClean(parText);
              const isAllUpper = trimmed.length > 4 && trimmed === trimmed.toUpperCase() && !/^\d+$/.test(trimmed);
              const isCenterHeading = isAllUpper || /^(quejoso|autoridad|asunto|hechos|conceptos|petitorios|protesto)/i.test(trimmed);

              return {
                id: `blk-${pIdx + 1}-${bIdx + 1}`,
                layer: 'USER_POSITION',
                trustLevel: 'VERIFIED',
                text: trimmed,
                isManuallyEdited: false,
                style: {
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  fontWeight: isAllUpper ? 'bold' : 'normal',
                  textAlign: isCenterHeading && trimmed.length < 120 ? 'center' : 'justify',
                  lineHeight: '1.6',
                  textTransform: isAllUpper ? 'uppercase' : 'none',
                },
              };
            });

            return {
              id: `sec-page-${pIdx + 1}`,
              type: pIdx === 0 ? 'header' : pIdx === pages.length - 1 ? 'closing' : 'argument',
              title: `Página ${p.page || pIdx + 1}`,
              order: pIdx + 1,
              isRepeatable: true,
              isEditable: true,
              isGenerated: false,
              isManuallyEdited: false,
              variables: [],
              validationErrors: [],
              validationWarnings: [],
              style: {
                fontFamily: 'inherit',
                fontWeight: 'bold',
                fontSize: '13px',
                textAlign: 'left',
              },
              content: blocks,
            };
          });

          const uploadedUniversalDoc: UniversalLegalDocument = createEmptyDocument({
            id: `doc-${Date.now()}`,
            title: fileNameWithoutExt,
            documentType: data.classification?.tipo_documento || 'machote_real',
            documentTypeLabel: data.classification?.tipo_documento || 'Documento Oficial',
            matter: data.classification?.materia || 'Amparo',
            jurisdiction: 'Cd. de México',
            parties: {
              actor: 'Parte promovente',
              demandado: 'Autoridad o contraparte',
            },
            caseRefs: {
              expediente: file.name,
            },
            sections,
            sourceDocuments: [newSource],
            originalFormat: ext as any,
            defaultFontFamily: 'Times New Roman, Times, "Liberation Serif", serif',
            defaultFontSize: '12pt',
            defaultLineHeight: '1.6',
            originalPageCount: pages.length,
            generationMetadata: {
              pipelineState: {
                currentStage: null,
                stages: {} as any,
                isComplete: true,
                hasErrors: false,
              },
              aiModel: 'gemini-legal-engine',
              aiUsed: false,
            },
            status: 'draft',
          });

          setUniversalDoc(uploadedUniversalDoc);
          setActiveSection(sections[0]);
          setSelectedTemplateRefText(sanitizeClean(data.extractedText || ''));
        }
      } catch (err: any) {
        notify('error', `Error en "${file.name}": ${err.message}`);
      }
    }

    setUploadedSourceDocs((prev) => [...prev, ...sources]);
    setCaseDocuments((prev) => [...prev, ...caseDocs]);
    if (caseDocs.length > 0) setSelectedCaseDoc(caseDocs[caseDocs.length - 1]);

    if (sources.length > 0) {
      const ficha = detectCaseFicha(sources.map((s) => s.extractedText || ''));
      setCaseFicha(ficha);
      notify('success', `Documento oficial "${fileList[0].name}" cargado en visor paginado (${caseDocs[0]?.pageCount || 1} páginas).`);
    }
  };

  const handleRemoveUploadedSource = (id: string) => {
    setUploadedSourceDocs((prev) => prev.filter((s) => s.id !== id));
    setCaseDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  /* ── Usar como Machote / Guardar Plantilla Reutilizable ────────────────── */
  const handleSaveAsTemplate = async (doc: UniversalLegalDocument) => {
    notify('warning', `Guardando "${doc.title}" como machote reutilizable en tu biblioteca...`);
    try {
      const fullContent = doc.sections.map((s) => s.content.map((b) => b.text).join('\n\n')).join('\n\n---\n\n');
      const res = await fetch('/api/templates/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: doc.title,
          description: `Machote oficial (${doc.documentTypeLabel || 'Legal'})`,
          category: doc.documentTypeLabel || 'Machote',
          practiceArea: doc.matter?.toLowerCase() || 'amparo',
          originalText: fullContent,
          content: fullContent,
          sourceFileName: doc.caseRefs?.expediente || `${doc.title}.pdf`,
          variables: { QUEJOSO: '', EXPEDIENTE: '', AUTORIDAD: '', FECHA: '' },
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo guardar la plantilla.');

      await loadTemplates();
      notify('success', `¡Machote "${doc.title}" guardado exitosamente como plantilla reutilizable!`);
    } catch (err: any) {
      notify('error', `Error al guardar como machote: ${err.message}`);
    }
  };

  /* ── Generar Escrito Basado en este Machote ────────────────────────────── */
  const handleGenerateFromMachote = (doc: UniversalLegalDocument) => {
    const fullText = doc.sections.map((s) => s.content.map((b) => b.text).join('\n\n')).join('\n\n');
    setSelectedTemplateRefText(fullText);
    setIsDraftGeneratorOpen(true);
  };

  /* ── Usar Plantilla Existente ──────────────────────────────────────────── */
  const handleUseTemplate = async (template: TemplateItem, version?: TemplateVersion) => {
    notify('warning', `Cargando machote "${template.name}"...`);
    try {
      const res = await fetch(`/api/templates/custom/${template.id}`);
      const data = await res.json();
      if (!data.ok || !data.template) throw new Error(data.error || 'No se pudo obtener la plantilla.');

      const tpl = data.template;
      const refText = sanitizeClean(tpl.originalText || tpl.content || '');
      setSelectedTemplate({ ...template, version: version?.version || template.version });
      setSelectedTemplateRefText(refText);

      // Parsear párrafos y páginas del machote real
      const rawParagraphs = refText.split(/\n\s*\n/).filter((t: string) => t.trim().length > 0);
      const blocks: ContentBlock[] = (rawParagraphs.length > 0 ? rawParagraphs : [refText || 'Sin texto']).map((parText: string, bIdx: number) => {
        const trimmed = sanitizeClean(parText);
        const isAllUpper = trimmed.length > 4 && trimmed === trimmed.toUpperCase() && !/^\d+$/.test(trimmed);
        const isCenterHeading = isAllUpper || /^(quejoso|autoridad|asunto|hechos|conceptos|petitorios|protesto)/i.test(trimmed);

        return {
          id: `blk-tpl-${bIdx + 1}`,
          layer: 'USER_POSITION' as const,
          trustLevel: 'VERIFIED' as const,
          text: trimmed,
          isManuallyEdited: false,
          style: {
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: isAllUpper ? 'bold' : 'normal',
            textAlign: isCenterHeading && trimmed.length < 120 ? 'center' : 'justify',
            lineHeight: '1.6',
            textTransform: isAllUpper ? 'uppercase' : 'none',
          },
        };
      });

      const loadedDoc: UniversalLegalDocument = createEmptyDocument({
        id: `doc-${tpl.id}-${Date.now()}`,
        templateId: tpl.id,
        title: tpl.title || template.name,
        documentType: tpl.documentType || 'machote',
        documentTypeLabel: tpl.category || 'Machote',
        matter: tpl.practiceArea || template.matterId || 'Amparo',
        jurisdiction: tpl.jurisdiction || 'Cd. de México',
        sections: [
          {
            id: `sec-tpl-1`,
            type: 'argument',
            title: tpl.title || template.name,
            order: 1,
            isRepeatable: false,
            isEditable: true,
            isGenerated: false,
            isManuallyEdited: false,
            variables: [],
            validationErrors: [],
            validationWarnings: [],
            content: blocks,
          },
        ],
        status: 'draft',
      });

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

  /* ── Generación de Escrito Completo (Con Motor de Reconstrucción de Caso y Teoría Jurídica) ── */
  const handleRunPipeline = async (payload: {
    userInstruction: string;
    intentLabel?: string;
    sourceDocs: UploadedSourceDocument[];
    selectedTemplate?: TemplateItem | null;
    templateRefText?: string;
  }) => {
    setIsUniversalGenerating(true);
    setPipelineStageIndex(0);
    notify('warning', 'Analizando expediente y redactando escrito judicial adaptado...');

    const stageTimer = window.setInterval(() => {
      setPipelineStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, 1200);

    try {
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
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Error al conectar con el servidor de redacción.');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setUniversalDoc(data.document);
      if (data.document.sections && data.document.sections.length > 0) {
        setActiveSection(data.document.sections[0]);
      }
      notify('success', 'Generación jurídica finalizada con éxito.');
    } catch (err: any) {
      notify('error', `Fallo en la generación: ${err.message}`);
    } finally {
      window.clearInterval(stageTimer);
      setIsUniversalGenerating(false);
    }
  };

  /* ── Regenerar Apartado ───────────────────────────────────────────────── */
  const handleRegenerateSection = async (sectionId: string, instruction?: string) => {
    if (!universalDoc) return;
    setIsUniversalGenerating(true);
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
      setIsUniversalGenerating(false);
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${universalDoc.title.replace(/[^a-z0-9]/gi, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      notify('success', 'Documento DOCX exportado exitosamente.');
    } catch (err: any) {
      notify('error', `Error al exportar DOCX: ${err.message}`);
    }
  };

  const handleExportPdf = async () => {
    if (!universalDoc) return;
    const payload = {
      documentType: universalDoc.documentTypeLabel,
      documentTitle: universalDoc.title,
      dateStr: new Date().toISOString(),
      renderedSections: universalDoc.sections.map((s) => ({
        title: s.title,
        content: s.content.map((b) => b.text).join('\n\n'),
      })),
    };
    try {
      const res = await fetch('/api/legal-engine/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Error al exportar PDF.');
      }

      const method = res.headers.get('X-Export-Method') || 'pdf';
      const contentType = res.headers.get('Content-Type') || '';

      if (method === 'pdf' && contentType.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${universalDoc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        notify('success', 'PDF Real descargado.');
      } else {
        const html = await res.text();
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          win.print();
        }
        notify('warning', 'Vista previa de impresión generada.');
      }
    } catch (error: any) {
      notify('error', error.message);
    }
  };

  const generatingStage = STAGES[pipelineStageIndex];

  return (
    <div className="machotes-shell h-[calc(100dvh-64px)] flex flex-col font-sans select-none overflow-hidden bg-[#f5f1e8]">
      {/* ── BARRA DE PESTAÑAS Y MODOS JURÍDICOS (UI EN INTER) ─────────────── */}
      <div className="shrink-0 px-4 py-2 bg-[#f5f1e8] border-b border-[#e8e2d5] font-sans">
        <div className="w-full flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1">
            {/* ⓘ Motor Universal (Drafts) */}
            <button
              onClick={() => handleSwitchMode('universal')}
              className={`mach-tab ${activeNavTab === 'universal' ? 'mach-tab-active' : ''}`}
            >
              <span>ⓘ</span>
              <span>Motor Universal (Drafts)</span>
            </button>

            {/* 📄 Escritos Iniciales */}
            <button
              onClick={() => handleSwitchMode('initial_writings')}
              className={`mach-tab ${activeNavTab === 'initial_writings' ? 'mach-tab-active' : ''}`}
            >
              <span>📄</span>
              <span>Escritos Iniciales</span>
            </button>

            {/* ⚖ Contestaciones y Reclamaciones */}
            <button
              onClick={() => handleSwitchMode('responses_resources')}
              className={`mach-tab ${activeNavTab === 'responses_resources' ? 'mach-tab-active' : ''}`}
            >
              <span>⚖</span>
              <span>Contestaciones y Reclamaciones</span>
            </button>

            {/* 📁 Mis Plantillas */}
            <button
              onClick={() => handleSwitchMode('my-templates')}
              className={`mach-tab ${activeNavTab === 'my-templates' ? 'mach-tab-active' : ''}`}
            >
              <span>📁</span>
              <span>Mis Plantillas</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BANNER DE NOTIFICACIONES / FEEDBACK ────────────────────────────── */}
      {feedback && (
        <div
          className={`mx-4 mt-2 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between border shadow-sm shrink-0 transition-all font-sans ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : feedback.tone === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-amber-50 border-amber-300 text-amber-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="hover:opacity-75 font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* ── CUERPO PRINCIPAL DEL WORKSPACE (DOCUMENTO DOMINANTE CON PANEL DE PÁGINAS) ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        {activeNavTab === 'my-templates' ? (
          /* TAB: MIS PLANTILLAS */
          <div className="w-full flex-1 p-6 overflow-y-auto bg-[#ede8dd] min-h-0 font-sans">
            <div className="max-w-6xl mx-auto w-full">
              <TemplateLibraryManager
                templates={customTemplates}
                onUseTemplate={(tpl) => handleUseTemplate(tpl)}
                onEditTemplate={(tpl) => handleEditTemplate(tpl)}
                onDeleteTemplate={(id) => handleDeleteTemplate(id)}
                onCreateNewTemplate={() => setIsSaveCustomOpen(true)}
              />
            </div>
          </div>
        ) : (
          /* VISTA PRINCIPAL: VISOR PAGINADO */
          <div className="flex w-full min-h-0 min-w-0 overflow-hidden">
            <WorkspaceDocumentEditor
              document={universalDoc}
              onUpdateDocument={(updated) => setUniversalDoc(updated)}
              onRegenerateSection={handleRegenerateSection}
              onExportDocx={handleExportDocx}
              onExportPdf={handleExportPdf}
              onSaveDraft={handleSaveDraft}
              onSaveAsTemplate={handleSaveAsTemplate}
              onGenerateFromMachote={handleGenerateFromMachote}
              activeSectionId={activeSection?.id}
              onSelectSection={(sec) => setActiveSection(sec)}
              onSelectTextHighlight={(text) => setSelectedTextHighlight(text)}
              isGenerating={isUniversalGenerating}
              pipelineStageLabel={generatingStage ? `Fase: ${generatingStage.label}` : undefined}
              onTriggerNewDraftModal={() => setIsDraftGeneratorOpen(true)}
              onTriggerUpload={() => fileInputHiddenRef.current?.click()}
            />
          </div>
        )}
      </div>

      {/* Input oculto para carga de archivos PDF / DOCX */}
      <input
        ref={fileInputHiddenRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt,.rtf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* MODAL 1: Generador de Borrador / Redacción con Machote */}
      {isDraftGeneratorOpen && (
        <WorkspaceDraftGeneratorModal
          isOpen={isDraftGeneratorOpen}
          onClose={() => setIsDraftGeneratorOpen(false)}
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
          isGenerating={isUniversalGenerating}
          onOpenUploadCustomTemplateModal={() => setIsSaveCustomOpen(true)}
        />
      )}

      {/* MODAL 2: Subir y Analizar Machote */}
      {isSaveCustomOpen && (
        <SaveCustomTemplateModal
          isOpen={isSaveCustomOpen}
          onClose={() => setIsSaveCustomOpen(false)}
          onTemplateCreated={() => {
            loadTemplates();
            notify('success', 'Machote guardado exitosamente en "Mis Plantillas".');
          }}
        />
      )}

      {/* MODAL 3: Editar Plantilla */}
      {isEditCustomOpen && (
        <EditCustomTemplateModal
          template={editTemplateData}
          isOpen={isEditCustomOpen}
          onClose={() => {
            setIsEditCustomOpen(false);
            setEditTemplateData(null);
          }}
          onTemplateUpdated={() => {
            loadTemplates();
            notify('success', 'Plantilla actualizada.');
          }}
        />
      )}
    </div>
  );
}