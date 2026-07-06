"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fillGuidedTemplate, GUIDED_LEGAL_TEMPLATES } from "@/lib/legalOperations";

const DEFAULT_TEMPLATE = GUIDED_LEGAL_TEMPLATES[0];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(content: string, type: string, fileName: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function MachotesGuiadosPage() {
  const [selectedId, setSelectedId] = useState(DEFAULT_TEMPLATE.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [manualDraft, setManualDraft] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("Copiar texto");

  const selectedTemplate =
    GUIDED_LEGAL_TEMPLATES.find((template) => template.id === selectedId) || DEFAULT_TEMPLATE;

  const generatedText = useMemo(
    () => `${fillGuidedTemplate(selectedTemplate, values)}\n\nNota: ${selectedTemplate.disclaimer}`,
    [selectedTemplate, values]
  );
  const documentText = manualDraft ?? generatedText;

  const categories = Array.from(new Set(GUIDED_LEGAL_TEMPLATES.map((template) => template.category)));
  const requiredFields = selectedTemplate.fields.filter((field) => field.required);
  const completedRequired = requiredFields.filter((field) => values[field.id]?.trim()).length;
  const pendingRequired = Math.max(requiredFields.length - completedRequired, 0);

  function updateField(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setManualDraft(null);
  }

  function selectTemplate(id: string) {
    setSelectedId(id);
    setValues({});
    setManualDraft(null);
    setCopyStatus("Copiar texto");
  }

  async function copyText() {
    await navigator.clipboard.writeText(documentText);
    setCopyStatus("Copiado");
    window.setTimeout(() => setCopyStatus("Copiar texto"), 2000);
  }

  function downloadText() {
    downloadBlob(documentText, "text/plain;charset=utf-8", `${selectedTemplate.id}.txt`);
  }

  function downloadWord() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      selectedTemplate.title
    )}</title></head><body><pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;">${escapeHtml(
      documentText
    )}</pre></body></html>`;
    downloadBlob(html, "application/msword;charset=utf-8", `${selectedTemplate.id}.doc`);
  }

  function printPdf() {
    window.print();
  }

  return (
    <>
      <div className="bg-gradient"></div>
      <main className="container legal-hub-shell">
        <nav className="document-nav">
          <Link href="/legal-hub">Volver al Centro Jurídico</Link>
          <Link href="/legal-hub/leyes-vigentes">Leyes vigentes</Link>
          <Link href="/legal-hub/expedientes">Expedientes</Link>
        </nav>

        <section className="machotes-page-header">
          <span className="badge">Machotes guiados</span>
          <h1>Formatos para amparo, civil, familiar, mercantil y revocación.</h1>
          <p className="subtitle">
            Elige un escrito, llena campos esenciales y genera una base editable. Cada machote requiere
            revisión profesional antes de presentarse.
          </p>
        </section>

        <section className="machote-template-toolbar">
          <label className="machote-template-select">
            <span>Tipo de escrito</span>
            <select value={selectedId} onChange={(event) => selectTemplate(event.target.value)}>
              {categories.map((category) => (
                <optgroup key={category} label={category}>
                  {GUIDED_LEGAL_TEMPLATES.filter((template) => template.category === category).map(
                    (template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    )
                  )}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="machote-template-summary">
            <strong>{selectedTemplate.category}</strong>
            <span>{selectedTemplate.description}</span>
          </div>
          <div className="machote-status-pill">
            Campos obligatorios {completedRequired}/{requiredFields.length}
          </div>
        </section>

        <section className="machotes-workspace">
          <aside className="machote-panel machote-form-panel">
            <div className="machote-panel-heading">
              <span className="document-label">Datos del escrito</span>
              <h2>{selectedTemplate.title}</h2>
              <p>
                Completa los datos base. Los campos vacíos quedan marcados como pendientes dentro del texto.
              </p>
            </div>

            <div className="machote-fields">
              {selectedTemplate.fields.map((field) => (
                <label key={field.id} className="machote-field">
                  <span>
                    {field.label}
                    {field.required && <em>Obligatorio</em>}
                  </span>
                  <input
                    value={values[field.id] || ""}
                    onChange={(event) => updateField(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                </label>
              ))}
            </div>

            <p className="machote-warning">
              Este formato es una base de trabajo y requiere revisión profesional antes de presentarse.
              {pendingRequired > 0 && ` Faltan ${pendingRequired} campo(s) obligatorio(s).`}
            </p>

            <div className="machote-action-grid">
              <button type="button" className="machote-action-primary" onClick={downloadWord}>
                Descargar Word
              </button>
              <button type="button" className="machote-action-secondary" onClick={printPdf}>
                Imprimir / guardar PDF
              </button>
              <button type="button" className="machote-action-secondary" onClick={downloadText}>
                Descargar texto
              </button>
              <button type="button" className="machote-action-secondary" onClick={copyText}>
                {copyStatus}
              </button>
            </div>
          </aside>

          <section className="machote-preview-panel">
            <div className="machote-preview-header">
              <div>
                <span className="document-label">Vista previa editable</span>
                <h2>Documento generado</h2>
              </div>
              <span className="machote-draft-badge">{manualDraft ? "Editado manualmente" : "Autogenerado"}</span>
            </div>
            <textarea
              className="machote-document-paper legal-preview-editor"
              value={documentText}
              onChange={(event) => setManualDraft(event.target.value)}
              aria-label="Texto generado editable"
            />
          </section>
        </section>
      </main>
    </>
  );
}
