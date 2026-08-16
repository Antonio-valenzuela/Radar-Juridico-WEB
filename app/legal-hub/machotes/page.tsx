'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PaginatedDocumentEditor } from './components/PaginatedDocumentEditor';
import { CaseDocumentsReader } from './components/CaseDocumentsReader';
import { TemplateLibraryManager, TemplateItem } from './components/TemplateLibraryManager';
import { SaveCustomTemplateModal } from '@/components/machotes/SaveCustomTemplateModal';

import type {
  UniversalLegalDocument,
  PipelineState,
  UploadedSourceDocument,
  CaseDocument,
  TemplateVersion,
} from '@/lib/legal-engine/types';
import { runGenerationPipeline, generateSection } from '@/lib/legal-engine/pipeline';
import { exportUniversalToDocx } from '@/lib/legal-engine/exportDocxUniversal';
import { generatePrintHtml } from '@/lib/templates/exportPdf';
import { createSourceDocument } from '@/lib/legal-engine/context';

export default function MachotesPage() {
  const [activeTab, setActiveTab] = useState<'universal' | 'initial_writings' | 'responses_resources' | 'my-templates'>('universal');

  // Universal Document Engine States
  const [universalDoc, setUniversalDoc] = useState<UniversalLegalDocument | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [isUniversalGenerating, setIsUniversalGenerating] = useState(false);
  const [uploadedSourceDocs, setUploadedSourceDocs] = useState<UploadedSourceDocument[]>([]);
  const [caseDocuments, setCaseDocuments] = useState<CaseDocument[]>([]);
  const [selectedCaseDoc, setSelectedCaseDoc] = useState<CaseDocument | null>(null);

  // User prompt input
  const [userPromptInput, setUserPromptInput] = useState<string>(
    'Contestar demanda laboral burocrática e interponer recurso de revisión contra la ejecutoria del Amparo Directo 800/2024'
  );

  // Template Library & Custom Templates
  const [customTemplates, setCustomTemplates] = useState<TemplateItem[]>([]);
  const [isSaveCustomOpen, setIsSaveCustomOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/templates/custom');
      const data = await res.json();
      if (data.ok && data.templates) {
        const mapped: TemplateItem[] = data.templates.map((t: any) => ({
          id: t.id,
          name: t.title,
          category: t.category,
          matterId: t.practiceArea || 'laboral',
          version: t.version || 1,
          description: t.description || '',
          updatedAt: t.updatedAt,
        }));
        setCustomTemplates(mapped);
      }
    } catch {
      // Quiet fallback
    }
  };

  // Handle Ingestion of New File (PDF, Scan, JPG, PNG, DOCX)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        setFeedback({ tone: 'warning', message: `Analizando e ingiriendo documento "${file.name}"...` });
        const res = await fetch('/api/templates/analyze-upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.ok) {
          const newSource: UploadedSourceDocument = createSourceDocument({
            id: data.fileId || `doc-${Date.now()}-${i}`,
            filename: file.name,
            extractedText: data.text,
            pages: data.pages || [{ page: 1, text: data.text, chars: data.text?.length || 0 }],
            sourceValidated: data.sourceValidated !== false,
          });

          const newCaseDoc: CaseDocument = {
            id: newSource.id,
            name: file.name,
            type: file.name.split('.').pop() || 'pdf',
            pageCount: newSource.pages?.length || 1,
            pages: newSource.pages,
            role: 'fuente_general',
            status: newSource.sourceValidated ? 'READY' : 'NEEDS_MANUAL_REVIEW',
            uploadedAt: new Date().toISOString(),
          };

          setUploadedSourceDocs((prev) => [...prev, newSource]);
          setCaseDocuments((prev) => [...prev, newCaseDoc]);
          setSelectedCaseDoc(newCaseDoc);

          setFeedback({
            tone: 'success',
            message: `Documento "${file.name}" ingerido exitosamente (${newCaseDoc.pageCount} pág/s, ${newSource.sourceValidated ? 'FUENTE VERIFICADA' : 'REQUIERE OCR/REVISIÓN'}).`,
          });
        } else {
          setFeedback({ tone: 'error', message: `Error al procesar "${file.name}": ${data.error}` });
        }
      } catch (err: any) {
        setFeedback({ tone: 'error', message: `Fallo de conexión al cargar "${file.name}": ${err.message}` });
      }
    }
  };

  // Run Modular Multi-Pass Document Generation
  const handleRunPipeline = async () => {
    setIsUniversalGenerating(true);
    setFeedback({ tone: 'warning', message: 'Ejecutando pipeline modular de redacción jurídica...' });

    try {
      const generatedDoc = await runGenerationPipeline(
        {
          userInstruction: userPromptInput,
          sourceDocuments: uploadedSourceDocs,
          allowUnvalidatedSource: true,
        },
        {
          onStageStart: (stage) => {
            setPipelineState((prev) => ({
              currentStage: stage,
              stages: {
                ...(prev?.stages || ({} as any)),
                [stage]: { stage, status: 'running', startedAt: new Date().toISOString() },
              },
              isComplete: false,
              hasErrors: false,
            }));
          },
          onStageComplete: (stage) => {
            setPipelineState((prev) => ({
              currentStage: stage,
              stages: {
                ...(prev?.stages || ({} as any)),
                [stage]: { stage, status: 'complete', completedAt: new Date().toISOString() },
              },
              isComplete: stage === 'validate',
              hasErrors: false,
            }));
          },
        }
      );

      setUniversalDoc(generatedDoc);
      setFeedback({ tone: 'success', message: 'Escrito jurídico generado exitosamente con estructura extensa.' });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: `Error en la generación: ${err.message}` });
    } finally {
      setIsUniversalGenerating(false);
    }
  };

  // Handle Section Regeneration
  const handleRegenerateSection = async (sectionId: string, instruction?: string) => {
    if (!universalDoc) return;
    setIsUniversalGenerating(true);

    try {
      const res = await generateSection(universalDoc, sectionId, instruction);
      const updatedSections = universalDoc.sections.map((sec) => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            isManuallyEdited: false,
            content: [
              {
                id: sec.content[0]?.id || crypto.randomUUID(),
                layer: 'GENERATED_ARGUMENT' as const,
                trustLevel: 'VERIFIED' as const,
                text: res.text,
                sources: res.sources,
                isManuallyEdited: false,
              },
            ],
          };
        }
        return sec;
      });

      setUniversalDoc({
        ...universalDoc,
        sections: updatedSections,
        updatedAt: new Date().toISOString(),
      });

      setFeedback({ tone: 'success', message: 'Apartado regenerado e integrado correctamente.' });
    } catch (err: any) {
      setFeedback({ tone: 'error', message: `Fallo al regenerar apartado: ${err.message}` });
    } finally {
      setIsUniversalGenerating(false);
    }
  };

  // Export DOCX
  const handleExportDocx = async () => {
    if (!universalDoc) return;
    try {
      const buffer = await exportUniversalToDocx(universalDoc);
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${universalDoc.title.replace(/[^a-z0-9]/gi, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({ tone: 'error', message: `Error al exportar a DOCX: ${err.message}` });
    }
  };

  // Export Print HTML / PDF
  const handleExportPdf = () => {
    if (!universalDoc) return;
    const fullText = universalDoc.sections.map((s) => s.content.map((b) => b.text).join('\n\n')).join('\n\n');
    const html = generatePrintHtml({
      title: universalDoc.title,
      header: universalDoc.documentTypeLabel,
      body: fullText,
      sections: universalDoc.sections.map((s) => ({ title: s.title, content: s.content.map((b) => b.text).join('\n\n') })),
      footer: 'Documento redactado con Radar Jurídico',
      warnings: [],
      disclaimer: '',
      generatedAt: new Date().toISOString(),
    });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  // Use Template from Library
  const handleUseTemplate = async (template: TemplateItem, version?: TemplateVersion) => {
    setFeedback({ tone: 'warning', message: `Creando nuevo borrador basado en la plantilla "${template.name}"...` });
    try {
      const res = await fetch('/api/legal-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Borrador - ${template.name}`,
          documentType: template.category || 'machote',
          status: 'DRAFT',
        }),
      });

      const data = await res.json();
      if (data.ok && data.draft) {
        setFeedback({ tone: 'success', message: `Borrador "${data.draft.title}" creado. Cargue los documentos del caso para iniciar la adaptación.` });
        setActiveTab('universal');
      }
    } catch (err: any) {
      setFeedback({ tone: 'error', message: `Error al usar plantilla: ${err.message}` });
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-7xl py-8 space-y-8 font-sans">
      {/* ── Page Title & Hero Header ────────────────────────────────────────── */}
      <div className="space-y-3 border-b border-slate-200 pb-6">
        <Link href="/legal-hub" className="back-link">
          ← Volver a Centro Jurídico
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0B2545]">
          Generador y Editor de Machotes Jurídicos
        </h1>
        <p className="subtitle text-slate-600 text-base max-w-3xl">
          Elaboración asistida por IA local • Trazabilidad por foja • Perfil de redacción del abogado
        </p>
      </div>

      {/* ── Feedback Message Banner ───────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`px-5 py-3 rounded-xl text-xs font-bold flex items-center justify-between border shadow-sm ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : feedback.tone === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-amber-50 border-amber-300 text-amber-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="hover:opacity-75 text-sm font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setActiveTab('universal')}
          className={
            activeTab === 'universal'
              ? 'bg-[#0B2545] text-white shadow-md font-bold rounded-xl px-5 py-2.5 text-xs transition-all'
              : 'text-slate-600 hover:text-[#0B2545] bg-white border border-slate-200 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm transition-all'
          }
        >
          ⚙️ Motor Universal
        </button>
        <button
          onClick={() => setActiveTab('initial_writings')}
          className={
            activeTab === 'initial_writings'
              ? 'bg-[#0B2545] text-white shadow-md font-bold rounded-xl px-5 py-2.5 text-xs transition-all'
              : 'text-slate-600 hover:text-[#0B2545] bg-white border border-slate-200 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm transition-all'
          }
        >
          📝 Escritos Iniciales
        </button>
        <button
          onClick={() => setActiveTab('responses_resources')}
          className={
            activeTab === 'responses_resources'
              ? 'bg-[#0B2545] text-white shadow-md font-bold rounded-xl px-5 py-2.5 text-xs transition-all'
              : 'text-slate-600 hover:text-[#0B2545] bg-white border border-slate-200 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm transition-all'
          }
        >
          ⚖️ Contestaciones y Recursos
        </button>
        <button
          onClick={() => setActiveTab('my-templates')}
          className={
            activeTab === 'my-templates'
              ? 'bg-[#0B2545] text-white shadow-md font-bold rounded-xl px-5 py-2.5 text-xs transition-all'
              : 'text-slate-600 hover:text-[#0B2545] bg-white border border-slate-200 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm transition-all'
          }
        >
          📁 Mis Plantillas ({customTemplates.length})
        </button>
      </div>

      {/* ── TAB: MIS PLANTILLAS ────────────────────────────────────────────── */}
      {activeTab === 'my-templates' && (
        <TemplateLibraryManager
          templates={customTemplates}
          onUseTemplate={handleUseTemplate}
          onEditTemplate={(tpl) => setEditingTemplate(tpl)}
          onDeleteTemplate={async (id) => {
            await fetch(`/api/templates/custom/${id}`, { method: 'DELETE' });
            loadTemplates();
          }}
          onCreateNewTemplate={() => setIsSaveCustomOpen(true)}
        />
      )}

      {/* ── TAB: MOTOR UNIVERSAL & WRITINGS ───────────────────────────────── */}
      {activeTab !== 'my-templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Case Documents & Pipeline Controls (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Document Ingestion Card */}
            <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-md space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] flex items-center space-x-2">
                <span>📄 1. Documentos del Expediente</span>
              </h3>
              <p className="text-xs text-slate-600">
                Suba cualquier PDF, scan, JPG, PNG o Word. Se procesará localmente sin subir datos privados.
              </p>
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-[#0B2545] rounded-xl cursor-pointer bg-slate-50/60 transition group text-center">
                <span className="text-3xl mb-2 group-hover:scale-110 transition">📥</span>
                <span className="text-xs font-bold text-[#0B2545]">Arrastrar o Seleccionar Archivos</span>
                <span className="text-[10px] text-slate-500 mt-1">PDF · DOCX · JPG · PNG (Procesamiento Local)</span>
                <input type="file" multiple onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {/* Instruction Prompt Card */}
            <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-md space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] flex items-center space-x-2">
                <span>✍️ 2. Instrucción Jurídica del Caso</span>
              </h3>
              <textarea
                rows={4}
                value={userPromptInput}
                onChange={(e) => setUserPromptInput(e.target.value)}
                placeholder="Describa la instrucción del escrito a elaborar..."
                className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B2545] font-sans"
              />
              <button
                onClick={handleRunPipeline}
                disabled={isUniversalGenerating}
                className="machote-btn-primary w-full py-3 text-xs uppercase tracking-wider justify-center"
              >
                <span>{isUniversalGenerating ? 'Generando...' : '⚡ Generar Escrito Estructurado'}</span>
              </button>
            </div>

            {/* Case Documents Reader Component */}
            <div className="h-[480px]">
              <CaseDocumentsReader
                documents={caseDocuments}
                selectedDocId={selectedCaseDoc?.id}
                onSelectDocument={(doc) => setSelectedCaseDoc(doc)}
              />
            </div>
          </div>

          {/* Right Column: Paginated Lawyer Document Editor Canvas (8 cols) */}
          <div className="lg:col-span-8 h-[900px]">
            {universalDoc ? (
              <PaginatedDocumentEditor
                document={universalDoc}
                onUpdateDocument={(updated) => setUniversalDoc(updated)}
                onRegenerateSection={handleRegenerateSection}
                onExportDocx={handleExportDocx}
                onExportPdf={handleExportPdf}
                caseDocuments={caseDocuments}
                isGenerating={isUniversalGenerating}
              />
            ) : (
              <div className="h-full bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-md">
                <span className="text-5xl text-slate-300">📜</span>
                <h3 className="text-lg font-bold text-[#0B2545]">Editor Documental Jurídico</h3>
                <p className="text-xs text-slate-500 max-w-md">
                  Cargue sus documentos o introduzca una instrucción para generar un escrito estructurado en formato paginado Carta con navegación y edición granular.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isSaveCustomOpen && (
        <SaveCustomTemplateModal
          isOpen={isSaveCustomOpen}
          onClose={() => setIsSaveCustomOpen(false)}
          onTemplateCreated={() => loadTemplates()}
        />
      )}
    </div>
  );
}
