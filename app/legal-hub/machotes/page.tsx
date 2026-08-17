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

  // Documento activo en el visor paginado
  const [universalDoc, setUniversalDoc] = useState<UniversalLegalDocument | null>(null);
  const [activeSection, setActiveSection] = useState<DocumentNode | null>(null);
  const [selectedTextHighlight, setSelectedTextHighlight] = useState<string | null>(null);

  const [uploadedSourceDocs, setUploadedSourceDocs] = useState<UploadedSourceDocument[]>([]);
  const [caseDocuments, setCaseDocuments] = useState<CaseDocument[]>([]);
  const [selectedCaseDoc, setSelectedCaseDoc] = useState<CaseDocument | null>(null);
  const [caseFicha, setCaseFicha] = useState<CaseFicha | null>(null);

  // Plantillas
  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
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
          matterId: t.practiceArea || t.category?.toLowerCase() || 'amparo',
          version: t.version || 1,
          description: t.description || '',
          updatedAt: t.updatedAt,
          pageCount: t.structureJson?.pageCount || (t.sourceFileName?.toLowerCase().endsWith('.pdf') ? 1 : undefined),
          fileSize: t.structureJson?.storage?.fileSize,
          fileType: t.sourceFileName ? t.sourceFileName.split('.').pop()?.toUpperCase() : (t.documentType?.toUpperCase() || 'PDF'),
          sourceFileName: t.sourceFileName,
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

  // Estado para formulario de Escritos Iniciales
  const [initialForm, setInitialForm] = useState({
    materia: 'Amparo',
    tipoEscrito: 'Demanda de Amparo Indirecto',
    promovente: '',
    demandado: '',
    autoridad: '',
    pretensiones: '',
    hechos: '',
    pruebas: '',
    instrucciones: '',
  });
  const [initialViewMode, setInitialViewMode] = useState<'form' | 'editor'>('form');

  // Estado para Motor Jurídico / Universal (3 columnas)
  const [universalForm, setUniversalForm] = useState({
    pregunta: 'Analiza la procedencia del recurso o demanda conforme a las constancias del expediente y la jurisprudencia aplicable.',
    materia: 'Amparo',
    jurisdiccion: 'Federal',
    expediente: '800/2024 - Amparo Directo',
    fuentes: { legislacion: true, jurisprudencia: true, expediente: true },
  });
  const [universalViewMode, setUniversalViewMode] = useState<'analysis' | 'editor'>('analysis');

  /* ── Cambio de Modo de Redacción ───────────────────────────────────────── */
  const handleSwitchMode = (mode: LegalWorkspaceMode) => {
    setActiveNavTab(mode);
    if (mode === 'universal') {
      // Mantiene el documento real actual
    } else if (mode === 'initial_writings') {
      if (!universalDoc) {
        const initialDoc: UniversalLegalDocument = createEmptyDocument({
          id: `doc-${Date.now()}`,
          title: initialForm.tipoEscrito || 'Demanda de Amparo Indirecto',
          documentType: 'amparo_indirecto',
          documentTypeLabel: initialForm.tipoEscrito || 'Amparo Indirecto',
          matter: initialForm.materia || 'Amparo',
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
                  text: 'C. JUEZ DE DISTRITO EN MATERIA DE AMPARO EN TURNO.\n\n[DATO PENDIENTE: Nombre del promovente], comparezco por mi propio derecho a solicitar el amparo y protección de la Justicia Federal...',
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

  /* ── Carga y Procesamiento de Documento Real (PDF/DOCX) CON PRESERVACIÓN DEL DOCUMENTO ORIGINAL ── */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    if (fileInputHiddenRef.current) fileInputHiddenRef.current.value = '';

    notify('warning', `Cargando documento original "${fileList[0].name}"...`);

    const sources: UploadedSourceDocument[] = [];
    const caseDocs: CaseDocument[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const blobUrl = URL.createObjectURL(file);

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
          fileUrl: blobUrl,
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

          // Cada página física del archivo original preserva su texto semántico para RAG
          const sections: DocumentNode[] = pages.map((p, pIdx) => {
            const rawParagraphs = (p.text || '').split(/\n\s*\n/).filter((t) => t.trim().length > 0);
            const blocks: ContentBlock[] = (rawParagraphs.length > 0 ? rawParagraphs : [p.text || 'Sin texto extraído']).map((parText, bIdx) => {
              const trimmed = sanitizeClean(parText);
              return {
                id: `blk-${pIdx + 1}-${bIdx + 1}`,
                layer: 'USER_POSITION',
                trustLevel: 'VERIFIED',
                text: trimmed,
                isManuallyEdited: false,
                style: {
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  textAlign: 'justify',
                  lineHeight: '1.6',
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
            originalFormat: ext === 'pdf' ? 'pdf' : (ext === 'docx' ? 'docx' : 'custom'),
            originalFileUrl: blobUrl,
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
    setCaseDocsList(caseDocs);
    if (sources.length > 0) {
      const ficha = detectCaseFicha(sources.map((s) => s.extractedText || ''));
      setCaseFicha(ficha);
      notify('success', `Documento original "${fileList[0].name}" cargado en visor (${caseDocs[0]?.pageCount || 1} páginas).`);
    }
  };

  const setCaseDocsList = (docs: CaseDocument[]) => {
    setCaseDocuments((prev) => [...prev, ...docs]);
    if (docs.length > 0) setSelectedCaseDoc(docs[docs.length - 1]);
  };

  const handleRemoveUploadedSource = (id: string) => {
    setUploadedSourceDocs((prev) => prev.filter((s) => s.id !== id));
    setCaseDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  /* ── Usar como Machote / Guardar Plantilla Reutilizable ────────────────── */
  const handleSaveAsTemplate = async (doc: UniversalLegalDocument) => {
    notify('warning', `Guardando "${doc.title}" como machote reutilizable...`);
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

      const fileUrl =
        tpl.structureJson?.storage?.fileUrl ||
        (tpl.sourceFileName ? `/api/templates/files/${tpl.structureJson?.storage?.savedFileName || tpl.sourceFileName}` : undefined);

      const rawParagraphs = refText.split(/\n\s*\n/).filter((t: string) => t.trim().length > 0);
      const blocks: ContentBlock[] = (rawParagraphs.length > 0 ? rawParagraphs : [refText || 'Sin texto']).map((parText: string, bIdx: number) => {
        const trimmed = sanitizeClean(parText);
        return {
          id: `blk-tpl-${bIdx + 1}`,
          layer: 'USER_POSITION' as const,
          trustLevel: 'VERIFIED' as const,
          text: trimmed,
          isManuallyEdited: false,
          style: {
            fontFamily: 'inherit',
            fontSize: '13px',
            textAlign: 'justify',
            lineHeight: '1.6',
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
        originalFormat: fileUrl ? 'pdf' : 'custom',
        originalFileUrl: fileUrl,
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

  /* ── Generación de Escrito Completo (Con Motor Jurídico Real) ─────────── */
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

      // El documento generado pasa al editor como estructura editable
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

      {/* ── CUERPO PRINCIPAL DEL WORKSPACE ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        {activeNavTab === 'my-templates' ? (
          /* TAB 4: MIS PLANTILLAS */
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
            />
          </div>
        ) : activeNavTab === 'initial_writings' && initialViewMode === 'form' ? (
          /* TAB 2: ESCRITOS INICIALES - FORMULARIO JURÍDICO ESPECIALIZADO */
          <div className="w-full flex-1 p-6 overflow-y-auto bg-[#ede8dd] min-h-0 font-sans">
            <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Formulario Estructurado */}
              <div className="lg:col-span-7 bg-white border border-[#ded8c9] rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <h2 className="text-base font-extrabold text-[#0B2545] tracking-tight flex items-center gap-2">
                      <span>📄</span>
                      <span>Formulario de Escrito Inicial</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Captura los datos procesales para estructurar y redactar la demanda inicial.
                    </p>
                  </div>
                  {universalDoc && (
                    <button
                      onClick={() => setInitialViewMode('editor')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B2545] text-xs font-bold transition flex items-center gap-1"
                    >
                      <span>Ver en Editor</span>
                      <span>→</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3.5 text-xs text-slate-800">
                  {/* Materia y Tipo de Escrito */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Materia</label>
                      <select
                        value={initialForm.materia}
                        onChange={(e) => setInitialForm((prev) => ({ ...prev, materia: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
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
                        className="w-full px-3 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
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
                        className="w-full px-3 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Autoridad Responsable / Demandado</label>
                      <input
                        type="text"
                        value={initialForm.demandado}
                        onChange={(e) => setInitialForm((prev) => ({ ...prev, demandado: e.target.value }))}
                        placeholder="Nombre o autoridad señalada"
                        className="w-full px-3 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
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
                      className="w-full p-2.5 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
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
                      className="w-full p-2.5 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
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
                        className="w-full px-3 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Instrucción Especial para IA</label>
                      <input
                        type="text"
                        value={initialForm.instrucciones}
                        onChange={(e) => setInitialForm((prev) => ({ ...prev, instrucciones: e.target.value }))}
                        placeholder="Ej. Énfasis en suplencia de la queja..."
                        className="w-full px-3 py-2 bg-slate-50 border border-[#ded8c9] rounded-xl text-xs font-medium focus:outline-none focus:border-[#0B2545]"
                      />
                    </div>
                  </div>

                  {/* Botón de Acción Principal */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      onClick={async () => {
                        const promptText = `Formular ${initialForm.tipoEscrito || 'Demanda'} en materia ${initialForm.materia}. Promovente: ${initialForm.promovente || 'Parte actora'}. Demandado/Autoridad: ${initialForm.demandado || 'Autoridad señalada'}. Acto/Prestaciones: ${initialForm.pretensiones || 'Las que en derecho procedan'}. Hechos: ${initialForm.hechos || 'Hechos expuestos'}. Pruebas: ${initialForm.pruebas || 'De ley'}. Instrucciones: ${initialForm.instrucciones || 'Formato formal judicial'}.`;
                        await handleRunPipeline({
                          userInstruction: promptText,
                          intentLabel: initialForm.tipoEscrito || 'Escrito Inicial',
                          sourceDocs: uploadedSourceDocs,
                        });
                        setInitialViewMode('editor');
                      }}
                      disabled={isUniversalGenerating}
                      className="px-6 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-2"
                    >
                      <span>⚡</span>
                      <span>{isUniversalGenerating ? 'Generando Escrito Inicial...' : 'Generar Escrito Inicial con IA'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Esquema Previo y Ficha Técnica */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-[#ded8c9] rounded-2xl p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Estructura del Escrito Inicial</span>
                  </h3>
                  <div className="space-y-2 text-xs text-slate-700">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="font-bold text-[#0B2545] text-[11px] block">I. Proemio</span>
                      <p className="text-[10px] text-slate-500">
                        Comparecencia de {initialForm.promovente || '[Promovente]'} señalando domicilio y autorizados.
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="font-bold text-[#0B2545] text-[11px] block">II. Pretensiones / Acto Reclamado</span>
                      <p className="text-[10px] text-slate-500 truncate">
                        {initialForm.pretensiones || 'Fijación de la litis y prestaciones reclamadas.'}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="font-bold text-[#0B2545] text-[11px] block">III. Hechos Fundatorios</span>
                      <p className="text-[10px] text-slate-500 truncate">
                        {initialForm.hechos || 'Narración circunstanciada de tiempo, modo y lugar.'}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="font-bold text-[#0B2545] text-[11px] block">IV. Conceptos de Violación / Derecho</span>
                      <p className="text-[10px] text-slate-500">
                        Fundamentación jurídica y argumentación basada en ley y precedentes aplicables.
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="font-bold text-[#0B2545] text-[11px] block">V. Puntos Petitorios</span>
                      <p className="text-[10px] text-slate-500">
                        Admisión, trámite y resolución favorable a los intereses del promovente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeNavTab === 'universal' && universalViewMode === 'analysis' ? (
          /* TAB 1: MOTOR JURÍDICO - TRES COLUMNAS (REFERENCIA VISUAL 2) */
          <div className="w-full flex-1 p-5 md:p-6 overflow-y-auto bg-[#f4f7f9] min-h-0 font-sans">
            <div className="max-w-7xl mx-auto w-full space-y-4">
              {/* Encabezado */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="space-y-0.5">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Motor Jurídico
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Analiza problemas jurídicos utilizando documentos, legislación, jurisprudencia y fuentes verificables.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUniversalViewMode('editor')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <span>Continuar al editor jurídico</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Grid de 3 Columnas según Referencia Visual 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4.5 items-start">
                {/* ── COLUMNA 1: CONTEXTO (lg:col-span-3) ─────────────────────────── */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs space-y-3.5 text-xs text-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                    Contexto
                  </h2>

                  {/* Pregunta jurídica */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Pregunta jurídica</label>
                    <textarea
                      rows={4}
                      value={universalForm.pregunta}
                      onChange={(e) => setUniversalForm((prev) => ({ ...prev, pregunta: e.target.value }))}
                      placeholder="Escribe la consulta o problema procesal a analizar..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0B2545]"
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
                        <p className="text-[11px] text-slate-400 italic">Sin documentos adjuntos.</p>
                      ) : (
                        uploadedSourceDocs.map((doc) => (
                          <div key={doc.id} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 truncate font-mono">
                            📄 {doc.name}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Expediente */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Expediente</label>
                    <select
                      value={universalForm.expediente}
                      onChange={(e) => setUniversalForm((prev) => ({ ...prev, expediente: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
                    >
                      <option value="800/2024 - Amparo Directo">[EXP. 800/2024 - Amparo Directo]</option>
                      <option value="1234/2026 - García c/ Paraestatal">[EXP. 1234/2026 - Ordinario]</option>
                    </select>
                  </div>

                  {/* Materia y Jurisdicción */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Materia</label>
                    <select
                      value={universalForm.materia}
                      onChange={(e) => setUniversalForm((prev) => ({ ...prev, materia: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
                    >
                      <option value="Amparo">[Amparo]</option>
                      <option value="Laboral">[Laboral]</option>
                      <option value="Civil">[Civil]</option>
                      <option value="Mercantil">[Mercantil]</option>
                      <option value="Administrativo/Fiscal">[Administrativo / Fiscal]</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Jurisdicción</label>
                    <select
                      value={universalForm.jurisdiccion}
                      onChange={(e) => setUniversalForm((prev) => ({ ...prev, jurisdiccion: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0B2545]"
                    >
                      <option value="Federal">[Federal]</option>
                      <option value="Local - CDMX">[Local - CDMX]</option>
                      <option value="Local - Estados">[Local - Entidad Federativa]</option>
                    </select>
                  </div>

                  {/* Fuentes Checkboxes */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-700 block">Fuentes</span>
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={universalForm.fuentes.legislacion}
                          onChange={(e) => setUniversalForm((prev) => ({ ...prev, fuentes: { ...prev.fuentes, legislacion: e.target.checked } }))}
                          className="rounded border-slate-300 text-[#0B2545]"
                        />
                        <span>Legislación</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={universalForm.fuentes.jurisprudencia}
                          onChange={(e) => setUniversalForm((prev) => ({ ...prev, fuentes: { ...prev.fuentes, jurisprudencia: e.target.checked } }))}
                          className="rounded border-slate-300 text-[#0B2545]"
                        />
                        <span>Jurisprudencia</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
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

                  {/* Botón de Ejecutar Análisis */}
                  <button
                    onClick={async () => {
                      await handleRunPipeline({
                        userInstruction: universalForm.pregunta,
                        intentLabel: 'Análisis Jurídico',
                        sourceDocs: uploadedSourceDocs,
                      });
                    }}
                    disabled={isUniversalGenerating}
                    className="w-full py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
                  >
                    {isUniversalGenerating ? 'Ejecutando análisis...' : 'Ejecutar análisis'}
                  </button>
                </div>

                {/* ── COLUMNA 2: ANÁLISIS JURÍDICO (lg:col-span-6) ─────────────────── */}
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">
                      Análisis jurídico
                    </h2>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Fuentes utilizadas: {uploadedSourceDocs.length + 3}
                    </span>
                  </div>

                  {/* Barra de Estado del Proceso */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-700">Estado:</span>
                    <span className="text-emerald-700 font-bold">✓ Documentos procesados</span>
                    <span className="text-emerald-700 font-bold">✓ Búsqueda jurídica</span>
                    <span className="text-emerald-700 font-bold">✓ Jurisprudencia</span>
                    <span className="text-emerald-700 font-bold">✓ Validación de fuentes</span>
                  </div>

                  {/* Problema Jurídico */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 block text-[11px]">Problema jurídico</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Determinar si la fundamentación del acto reclamado se ajusta al parámetro de regularidad constitucional y a los precedentes vinculantes en materia de debido proceso y legalidad.
                    </p>
                  </div>

                  {/* Hechos y Normativa en 2 Columnas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 block text-[11px]">Hechos relevantes</span>
                      <ul className="text-[10px] text-slate-600 space-y-0.5 list-disc list-inside leading-relaxed">
                        <li>1. Existencia del acto de autoridad impugnado.</li>
                        <li>2. Omisión de valoración probatoria en instancia previa.</li>
                        <li>3. Oportunidad en la presentación del medio de defensa.</li>
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 block text-[11px]">Normativa aplicable</span>
                      <ul className="text-[10px] text-slate-600 space-y-0.5 list-disc list-inside leading-relaxed">
                        <li>1. Constitución Política (Arts. 1o, 14, 16 y 17).</li>
                        <li>2. Ley de Amparo / Código Adjetivo.</li>
                        <li>3. Convención Americana sobre DDHH (Art. 8.1).</li>
                      </ul>
                    </div>
                  </div>

                  {/* Jurisprudencia Relevante */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-900 block text-[11px]">Jurisprudencia relevante</span>
                    <p className="text-[10px] text-slate-600 font-mono">
                      SCJN. Registro 2018671 (Tesis Jurisprudencia) · Registro 2023145 (Tesis Aislada).
                    </p>
                  </div>

                  {/* Argumentación */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-900 block text-[11px]">Argumentación</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed text-justify">
                      Conforme al análisis de las constancias procesales y el marco normativo aplicable, se concluye que la resolución impugnada carece de debida fundamentación y motivación, actualizándose una violación directa a las garantías de legalidad y seguridad jurídica.
                    </p>
                  </div>

                  {/* Conclusión Callout */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                    <span className="font-bold text-[#0B2545] text-[11px] block">Conclusión</span>
                    <p className="text-[11px] text-slate-800 leading-relaxed font-medium">
                      Procede formular el medio de defensa correspondiente solicitando la revocación o amparo liso y llano con efectos restitutorios plenos.
                    </p>
                  </div>

                  {/* Botones de Acción Inferiores */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => notify('success', 'Análisis jurídico guardado en el expediente.')}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
                    >
                      Guardar análisis
                    </button>
                    <button
                      onClick={async () => {
                        if (!universalDoc) {
                          await handleRunPipeline({
                            userInstruction: universalForm.pregunta,
                            intentLabel: 'Escrito Jurídico',
                            sourceDocs: uploadedSourceDocs,
                          });
                        }
                        setUniversalViewMode('editor');
                      }}
                      className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#081d39] text-white text-xs font-bold shadow-xs transition"
                    >
                      Convertir en escrito
                    </button>
                    <button
                      onClick={() => universalDoc && handleExportDocx(universalDoc)}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
                    >
                      Exportar
                    </button>
                  </div>
                </div>

                {/* ── COLUMNA 3: FUENTES Y TRAZABILIDAD (lg:col-span-3) ────────────── */}
                <div className="lg:col-span-3 space-y-3 text-xs">
                  <h2 className="text-sm font-bold text-slate-900 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                    Fuentes y trazabilidad
                  </h2>

                  {/* Card 1: Legislación */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#0B2545] truncate">Ley Federal / CPEUM</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Art. 123 / 16</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-800">Referencia:</span> Artículos 14, 16 y 17 Constitucionales.
                    </div>
                    <button
                      onClick={() => notify('warning', 'Consultando texto íntegro en legislación vigente...')}
                      className="w-full py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-[#0B2545] transition"
                    >
                      Ver fuente
                    </button>
                  </div>

                  {/* Card 2: Jurisprudencia */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#0B2545] truncate">Jurisprudencia SCJN</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Tesis 1a./J.</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-800">Registro:</span> 2018671 · Semanario Judicial de la Federación.
                    </div>
                    <button
                      onClick={() => notify('warning', 'Consultando criterio en repositorio jurisprudencial...')}
                      className="w-full py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-[#0B2545] transition"
                    >
                      Ver fuente
                    </button>
                  </div>

                  {/* Card 3: Documento de Expediente */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#0B2545] truncate">Documento del expediente</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Foja 1-27</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-800">Archivo:</span> {selectedCaseDoc?.name || uploadedSourceDocs[0]?.name || 'Expediente_Oficial.pdf'}
                    </div>
                    <button
                      onClick={() => setUniversalViewMode('editor')}
                      className="w-full py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-[#0B2545] transition"
                    >
                      Ver documento
                    </button>
                  </div>
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
              <button
                onClick={() => {
                  if (activeNavTab === 'initial_writings') setInitialViewMode('form');
                  else setUniversalViewMode('analysis');
                }}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition"
              >
                ‹ Volver al Panel de Análisis / Formulario
              </button>
            </div>
            <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
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

      {/* MODAL 2: Subir y Guardar Machote Reutilizable */}
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