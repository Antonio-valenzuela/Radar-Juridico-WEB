"use client";

import React, { useState } from 'react';
import { TemplateCategory, ProfessionalTemplate, TemplateStructure } from '@/lib/templates/templateTypes';
import { buildTemplateFromStructure, createTemplateFromText, saveCustomTemplate } from '@/lib/templates/customTemplateStore';

interface SaveCustomTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated: (newTemplate: ProfessionalTemplate) => void;
}

export function SaveCustomTemplateModal({
  isOpen,
  onClose,
  onTemplateCreated,
}: SaveCustomTemplateModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('Amparo');
  const [legalBasis, setLegalBasis] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{
    es_juridico: boolean;
    tipo_documento: string;
    confianza: number;
    razon: string;
    secciones_detectadas: string[];
    extractedText?: string;
    structureJson?: TemplateStructure;
    needsOcr?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setAnalysis(null);
    setError(null);

    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }

    if (selected.type.includes('text') || selected.name.toLowerCase().endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = (event.target?.result as string) || '';
        setDocumentContent(text);
      };
      reader.readAsText(selected);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selected);
      const response = await fetch('/api/templates/analyze-upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'No fue posible analizar el archivo.');
      }
      setAnalysis({
        ...payload.classification,
        extractedText: payload.extractedText,
        structureJson: payload.structureJson,
        needsOcr: payload.needsOcr,
      });
      setDocumentContent(payload.extractedText || '');
    } catch (err: any) {
      setError(err.message || 'Error al analizar el archivo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Por favor ingresa un nombre para el machote.');
      return;
    }
    if (!documentContent.trim() && !file) {
      setError('Por favor escribe o pega el contenido de tu escrito o selecciona un archivo.');
      return;
    }
    if (analysis && !analysis.es_juridico && !analysis.needsOcr) {
      setError('El documento no parece un machote jurídico.');
      return;
    }

    setLoading(true);
    try {
      const contentToUse = documentContent.trim() || (file?.name
        ? `[MACHOTE DESDE DOCUMENTO ADJUNTO: ${title}]\n\nArchivo cargado: ${file.name}\n\nNota: Este machote fue registrado desde el archivo (${file.name}). Puedes editar este texto para agregar las cláusulas o apartados cuando lo requieras.`
        : `[MACHOTE PERSONALIZADO: ${title}]`);

      const newTemplate = analysis?.structureJson && analysis.es_juridico
        ? buildTemplateFromStructure(title.trim(), category, legalBasis.trim(), analysis.structureJson, contentToUse, file?.name)
        : createTemplateFromText(title.trim(), category, legalBasis.trim(), contentToUse);

      const savedTemplate = await saveCustomTemplate(newTemplate);
      onTemplateCreated(savedTemplate);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ocurrió un error al guardar la plantilla personalizada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="machote-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-label="Guardar Machote Personalizado"
    >
      <div
        className="machote-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="machote-modal-header">
          <div>
            <h2>📥 Subir y Guardar Mi Propio Machote</h2>
            <p>Guarda tus plantillas y formatos para usarlos y modificarlos en cualquier momento</p>
          </div>
          <button onClick={onClose} className="machote-modal-close">
            ✕
          </button>
        </div>

        <div className="machote-modal-body">
          <div className="machote-input-group">
            <label>
              Nombre de tu machote / plantilla *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Demanda de amparo indirecto procesal penal (Personalizada)"
              className="machote-input-control"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="machote-input-group">
              <label>Materia / Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="machote-input-control"
              >
                <option value="Amparo">Amparo</option>
                <option value="Civil">Civil</option>
                <option value="Familiar">Familiar</option>
                <option value="Mercantil">Mercantil</option>
                <option value="Administrativo/Fiscal">Administrativo/Fiscal</option>
                <option value="General">General</option>
              </select>
            </div>

            <div className="machote-input-group">
              <label>Fundamento normativo (opcional)</label>
              <input
                type="text"
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                placeholder="Ej. Arts. 107 y 108 Ley de Amparo"
                className="machote-input-control"
              />
            </div>
          </div>

          <div className="machote-input-group">
            <label>
              Cargar archivo (.docx, .pdf, .txt) o pegar texto de tu machote
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              style={{ marginBottom: '0.5rem', display: 'block', fontSize: '0.85rem' }}
            />

            {analysis ? (
              <div className="legal-info-box" style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #d1d5db' }}>
                <p className="font-semibold">Resultado del análisis</p>
                <p>¿Es jurídico?: <strong>{analysis.es_juridico ? 'Sí' : 'No'}</strong></p>
                <p>Tipo: {analysis.tipo_documento || 'No determinado'}</p>
                <p>Confianza: {analysis.confianza}%</p>
                <p>Razón: {analysis.razon}</p>
                {analysis.secciones_detectadas.length > 0 && (
                  <p>Secciones detectadas: {analysis.secciones_detectadas.join(', ')}</p>
                )}
                {analysis.structureJson?.campos?.length ? (
                  <p>Campos inferidos: {analysis.structureJson.campos.map((campo) => campo.etiqueta).join(', ')}</p>
                ) : null}
                {analysis.needsOcr && (
                  <p style={{ color: '#047857', fontWeight: 500, marginTop: '0.25rem' }}>
                    ✔ Archivo escaneado aceptado correctamente como machote. Puedes guardarlo directamente o pegar texto adicional si deseas edición.
                  </p>
                )}
              </div>
            ) : null}

            <textarea
              value={documentContent}
              onChange={(e) => setDocumentContent(e.target.value)}
              rows={7}
              placeholder="Pega aquí el texto completo de tu machote o escrito base con los apartados que utilizas normalmente en tu despacho..."
              className="machote-input-control"
            />
          </div>

          {error && (
            <div className="legal-warning" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
        </div>

        <div className="machote-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="machote-btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="machote-btn-primary"
          >
            💾 Guardar como Machote Reutilizable
          </button>
        </div>
      </div>
    </div>
  );
}
