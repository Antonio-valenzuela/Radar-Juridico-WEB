'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WorkspaceLibraryPanel } from './components/WorkspaceLibraryPanel';
import { WorkspaceDocumentEditor } from './components/WorkspaceDocumentEditor';
import { WorkspaceContextualAIPanel } from './components/WorkspaceContextualAIPanel';
import { WorkspaceDraftGeneratorModal } from './components/WorkspaceDraftGeneratorModal';
import { TemplateLibraryManager, TemplateItem } from './components/TemplateLibraryManager';
import { PaginatedDocumentEditor } from './components/PaginatedDocumentEditor';
import { SaveCustomTemplateModal } from '@/components/machotes/SaveCustomTemplateModal';
import { EditCustomTemplateModal } from '@/components/machotes/EditCustomTemplateModal';

import type {
  UniversalLegalDocument,
  UploadedSourceDocument,
  CaseDocument,
  TemplateVersion,
  DocumentPage,
  DocumentNode,
} from '@/lib/legal-engine/types';
import { createSourceDocument } from '@/lib/legal-engine/context';

/* ────────────────────────────────────────────────────────────────────────────
   Ficha de caso y utilidades deterministas
──────────────────────────────────────────────────────────────────────────── */
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
  else if (/familiar|divorcio|alimentos|patria\s+potestad/i.test(full)) materia = 'Familiar';
  else if (/administrativ|fiscal|multa|procedimiento\s+administrativo/i.test(full)) materia = 'Administrativo';

  let tipo = 'Amparo Directo';
  if (/recurso\s+de\s+revisi[oó]n/i.test(full)) tipo = 'Recurso de Revisión';
  else if (/recurso\s+de\s+queja/i.test(full)) tipo = 'Recurso de Queja';
  else if (/contestaci[oó]n/i.test(full) && /demanda/i.test(full)) tipo = 'Contestación de Demanda';
  else if (/amparo\s+directo/i.test(full)) tipo = 'Amparo Directo';
  else if (/amparo\s+indirecto/i.test(full)) tipo = 'Amparo Indirecto';
  else if (/agravios/i.test(full)) tipo = 'Expresión de Agravios';

  const foundCount = [expediente, actor, demandado, abogado, autoridad, fechas].filter(Boolean).length;
  const confianza = Math.min(100, Math.round(35 + foundCount * 11));

  return { expediente, actor, demandado, abogado, autoridad, fechas, materia, tipo, confianza };
}

export default function MachotesPage() {
  const [activeNavTab, setActiveNavTab] = useState<'universal' | 'initial_writings' | 'responses_resources' | 'my-templates'>('universal');

  // Paneles retráctiles independientes
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(true);
  const [isContextualAiCollapsed, setIsContextualAiCollapsed] = useState(false);

  // Estados Documentales
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
    window.setTimeout(() => setFeedback(null), 8000);
  }, []);

  // Cargar plantillas y último borrador
  useEffect(() => {
    loadTemplates();
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem('jr_last_draft_id');
    } catch { /* sin localStorage */ }
    if (lastId) {
      handleLoadLastDraft(lastId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // En pantallas pequeñas los paneles laterales inician como drawers cerrados
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 900) setIsLibraryCollapsed(true);
    if (window.innerWidth < 1199) setIsContextualAiCollapsed(true);
  }, []);

  // Seleccionar primer apartado activo cuando cambie el documento
  useEffect(() => {
    if (universalDoc && universalDoc.sections && universalDoc.sections.length > 0) {
      if (!activeSection || !universalDoc.sections.some((s) => s.id === activeSection.id)) {
        setActiveSection(universalDoc.sections[0]);
      }
    }
  }, [universalDoc, activeSection]);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/templates/custom');
      const data = await res.json();
      if (data.ok && data.templates) {
        const mapped: TemplateItem[] = data.templates.map((t: any) => ({
          id: t.id,
          name: t.title,
          category: t.category,
          matterId: t.practiceArea || 'amparo',
          version: t.version || 1,
          description: t.description || '',
          updatedAt: t.updatedAt,
        }));
        setCustomTemplates(mapped);
      }
    } catch {
      // Fallback silencioso
    }
  };

  /* ── Carga y Procesamiento Multi-archivo con OCR Real ────────────────── */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    if (fileInputHiddenRef.current) fileInputHiddenRef.current.value = '';

    notify('warning', `Procesando ${fileList.length} documento(s) con OCR y análisis jurídico local...`);

    const sources: UploadedSourceDocument[] = [];
    const caseDocs: CaseDocument[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/templates/analyze-upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || 'El servidor no pudo procesar el archivo.');
        }

        const sourceValidated = data.sourceValidated !== false;
        const pages: DocumentPage[] = data.pages?.length
          ? data.pages
          : [{ page: 1, text: data.extractedText || '', chars: data.extractedText?.length || 0 }];

        const newSource: UploadedSourceDocument = createSourceDocument({
          id: data.fileId || `doc-${Date.now()}-${i}`,
          filename: file.name,
          name: file.name,
          type: file.type,
          extractedText: data.extractedText,
          pages,
          sourceValidated,
          sourceValidationMethod: data.sourceValidationMethod,
          qualityScore: data.qualityScore,
          warnings: data.warnings,
        });

        const newCaseDoc: CaseDocument = {
          id: newSource.id,
          name: file.name,
          type: file.name.split('.').pop() || 'pdf',
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
      notify('success', `${sources.length} documento(s) procesado(s). Caso identificado: ${ficha.materia} · ${ficha.tipo}.`);
    }
  };

  const handleRemoveUploadedSource = (id: string) => {
    setUploadedSourceDocs((prev) => prev.filter((s) => s.id !== id));
    setCaseDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selectedCaseDoc?.id === id) setSelectedCaseDoc(null);
  };

  /* ── Seleccionar Plantilla (Copia de Trabajo) ─────────────────────────── */
  const handleUseTemplate = async (template: TemplateItem, version?: TemplateVersion) => {
    notify('warning', `Cargando estructura de "${template.name}"...`);
    try {
      const res = await fetch(`/api/templates/custom/${template.id}`);
      const data = await res.json();
      if (!data.ok || !data.template) throw new Error(data.error || 'No se pudo obtener la plantilla.');

      const refText = data.template.originalText || data.template.content || '';
      setSelectedTemplate({ ...template, version: version?.version || template.version });
      setSelectedTemplateRefText(refText);

      notify('success', `Machote "${template.name}" cargado como copia de trabajo (${refText.length.toLocaleString()} caracteres). El original no se modifica; Radar adaptará su estructura.`);
      setActiveNavTab('universal');
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

  /* ── Generación de Escrito Completo ───────────────────────────────────── */
  const handleRunPipeline = async (payload: {
    userInstruction: string;
    intentLabel?: string;
    sourceDocs: UploadedSourceDocument[];
    selectedTemplate?: TemplateItem | null;
    templateRefText?: string;
  }) => {
    setIsUniversalGenerating(true);
    setPipelineStageIndex(0);
    notify('warning', 'Redactando escrito jurídico completo por apartados...');

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
          referenceDocumentId: payload.selectedTemplate?.id || selectedTemplate?.id,
          documentTypeLabel: payload.intentLabel || selectedTemplate?.category || undefined,
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
      notify('success', 'Generar Escrito Completo finalizado con éxito.');
    } catch (err: any) {
      notify('error', `Fallo en la generación: ${err.message}`);
    } finally {
      window.clearInterval(stageTimer);
      setIsUniversalGenerating(false);
    }
  };

  /* ── Regenerar Apartado o Aplicar Sugerencia Contextual ────────────────── */
  const handleRegenerateSection = async (sectionId: string, instruction?: string) => {
    if (!universalDoc) return;
    setIsUniversalGenerating(true);
    notify('warning', 'Actualizando apartado con IA jurídica...');

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
                text: data.text,
                sources: data.sources,
                isManuallyEdited: false,
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

  const handleApplySuggestion = async (suggestionText: string) => {
    if (!universalDoc || !activeSection) return;
    const instruction = `Aplica la siguiente sugerencia contextual al apartado "${activeSection.title}": ${suggestionText}. Desarrolla la argumentación jurídica con rigor, fundamentación y citas legales pertinentes.`;
    await handleRegenerateSection(activeSection.id, instruction);
  };

  /* ── Guardar / Reabrir Borrador ───────────────────────────────────────── */
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
      } catch { /* ignorar */ }
      notify('success', `Borrador guardado: "${data.draft.title}".`);
      return true;
    } catch (err: any) {
      notify('error', `No se pudo guardar el borrador: ${err.message}`);
      return false;
    }
  };

  const handleLoadLastDraft = async (draftId?: string) => {
    let idToLoad = draftId;
    if (!idToLoad) {
      try {
        idToLoad = localStorage.getItem('jr_last_draft_id') || undefined;
      } catch { /* noop */ }
    }
    if (!idToLoad) {
      notify('warning', 'No hay un borrador guardado recientemente.');
      return;
    }
    try {
      const res = await fetch(`/api/legal-drafts/${idToLoad}`);
      const data = await res.json();
      if (!data.ok || !data.draft?.structuredDoc) throw new Error(data.error || 'Borrador no encontrado.');
      setUniversalDoc(data.draft.structuredDoc);
      if (data.draft.structuredDoc.sections?.length > 0) {
        setActiveSection(data.draft.structuredDoc.sections[0]);
      }
      notify('success', `Borrador "${data.draft.title}" reabierto.`);
    } catch (err: any) {
      notify('error', `Error al reabrir borrador: ${err.message}`);
    }
  };

  /* ── Exportar a DOCX y PDF Real ────────────────────────────────────────── */
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
        notify('success', 'PDF REAL generado en servidor y descargado.');
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
    <div className="machotes-shell h-[calc(100dvh-64px)] flex flex-col font-sans select-none overflow-hidden">
      {/* ── BARRA DE PESTAÑAS (Pill Style idéntica al Mockup) ────────────── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--mach-border)' }}>
        <div className="w-full max-w-[1800px] mx-auto px-5 py-2.5 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1">
            {/* ⚙ Motor Universal (Drafts) */}
            <button
              onClick={() => {
                setActiveNavTab('universal');
                if (!universalDoc) setIsDraftGeneratorOpen(true);
              }}
              className={`mach-tab ${activeNavTab === 'universal' ? 'mach-tab-active' : ''}`}
            >
              <span>⚙️</span>
              <span>Motor Universal (Drafts)</span>
            </button>

            {/* 📝 Escritos Iniciales */}
            <button
              onClick={() => {
                setActiveNavTab('initial_writings');
                setIsDraftGeneratorOpen(true);
              }}
              className={`mach-tab ${activeNavTab === 'initial_writings' ? 'mach-tab-active' : ''}`}
            >
              <span>📝</span>
              <span>Escritos Iniciales</span>
            </button>

            {/* ⚖ Contestaciones y Recursos */}
            <button
              onClick={() => {
                setActiveNavTab('responses_resources');
                setIsDraftGeneratorOpen(true);
              }}
              className={`mach-tab ${activeNavTab === 'responses_resources' ? 'mach-tab-active' : ''}`}
            >
              <span>⚖️</span>
              <span>Contestaciones y Recursos</span>
            </button>

            {/* 📁 Mis Plantillas */}
            <button
              onClick={() => setActiveNavTab('my-templates')}
              className={`mach-tab ${activeNavTab === 'my-templates' ? 'mach-tab-active' : ''}`}
            >
              <span>📁</span>
              <span>Mis Plantillas ({customTemplates.length})</span>
            </button>
          </div>

          {/* Botón ➕ Subir Machote */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsSaveCustomOpen(true)}
              className="mach-button-primary flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>Subir Machote</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BANNER DE NOTIFICACIONES / FEEDBACK ────────────────────────────── */}
      {feedback && (
        <div
          className={`mx-5 mt-2 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between border shadow-sm shrink-0 transition-all legal-info-box jr-card ${
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

      {/* ── CUERPO PRINCIPAL DEL WORKSPACE ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        {activeNavTab === 'my-templates' ? (
          /* TAB: MIS PLANTILLAS (Administrador Completo) */
          <div className="w-full max-w-[1800px] mx-auto px-5 min-h-0">
            <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full min-h-0">
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
          /* VISTA PRINCIPAL: 3 PANELES RETRÁCTILES (Biblioteca | Hoja Carta | Contextual IA) */
          <div className="flex w-full max-w-[1800px] mx-auto px-5 min-h-0 min-w-0">
            {/* PANEL IZQUIERDO: BIBLIOTECA DE DOCUMENTOS */}
            <WorkspaceLibraryPanel
              isCollapsed={isLibraryCollapsed}
              onToggleCollapse={() => setIsLibraryCollapsed(!isLibraryCollapsed)}
              caseDocuments={caseDocuments}
              uploadedSources={uploadedSourceDocs}
              templates={customTemplates}
              currentDoc={universalDoc}
              selectedCaseDocId={selectedCaseDoc?.id}
              onSelectCaseDocument={(doc) => setSelectedCaseDoc(doc)}
              onUseTemplate={(tpl) => handleUseTemplate(tpl)}
              onOpenCreateTemplateModal={() => setIsSaveCustomOpen(true)}
              onDeleteTemplate={(id) => handleDeleteTemplate(id)}
            />

            {/* PANEL CENTRAL: DOCUMENTO EN HOJA CARTA */}
            <WorkspaceDocumentEditor
              document={universalDoc}
              onUpdateDocument={(updated) => setUniversalDoc(updated)}
              onRegenerateSection={handleRegenerateSection}
              onExportDocx={handleExportDocx}
              onExportPdf={handleExportPdf}
              onSaveDraft={handleSaveDraft}
              activeSectionId={activeSection?.id}
              onSelectSection={(sec) => setActiveSection(sec)}
              onSelectTextHighlight={(text) => setSelectedTextHighlight(text)}
              isGenerating={isUniversalGenerating}
              pipelineStageLabel={generatingStage ? `Fase: ${generatingStage.label}` : undefined}
              onTriggerNewDraftModal={() => setIsDraftGeneratorOpen(true)}
              onTriggerUpload={() => fileInputHiddenRef.current?.click()}
              onToggleLibrary={() => setIsLibraryCollapsed((c) => !c)}
              onToggleAI={() => setIsContextualAiCollapsed((c) => !c)}
            />

            {/* PANEL DERECHO: CONTEXTUAL IA */}
            <WorkspaceContextualAIPanel
              isCollapsed={isContextualAiCollapsed}
              onToggleCollapse={() => setIsContextualAiCollapsed(!isContextualAiCollapsed)}
              document={universalDoc}
              activeSection={activeSection}
              selectedTextHighlight={selectedTextHighlight}
              onApplySuggestion={handleApplySuggestion}
              isGenerating={isUniversalGenerating}
            />
          </div>
        )}
      </div>

      {/* Input oculto para carga de archivos */}
      <input
        ref={fileInputHiddenRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* MODAL 1: Generador de Borrador y Estrategia */}
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
            notify('success', 'Machote analizado y guardado en tu biblioteca.');
          }}
        />
      )}

      {/* MODAL 3: Editar Plantilla / Crear Versión */}
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
            notify('success', 'Plantilla actualizada (nueva versión creada).');
          }}
        />
      )}
    </div>
  );
}