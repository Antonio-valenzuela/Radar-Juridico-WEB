"use client";

import React, { useState } from 'react';
import { TemplateCategory, ProfessionalTemplate } from '@/lib/templates/templateTypes';
import { createTemplateFromText, saveCustomTemplate } from '@/lib/templates/customTemplateStore';

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
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    // Read text files directly
    if (selected.type.includes('text') || selected.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentContent(event.target?.result as string || '');
      };
      reader.readAsText(selected);
    } else {
      // For DOCX / PDF, prompt user to review extracted text or use title
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError('Por favor ingresa un nombre para el machote.');
      return;
    }
    if (!documentContent.trim() && !file) {
      setError('Por favor escribe o pega el contenido de tu escrito o selecciona un archivo.');
      return;
    }

    setLoading(true);
    try {
      const contentToUse = documentContent.trim() || `[MACHOTE PERSONALIZADO: ${title}]\n\nContenido base subido desde archivo: ${file?.name || 'Formato del litigante'}`;
      const newTemplate = createTemplateFromText(title.trim(), category, legalBasis.trim(), contentToUse);
      saveCustomTemplate(newTemplate);
      onTemplateCreated(newTemplate);
      onClose();
    } catch {
      setError('Ocurrió un error al guardar la plantilla personalizada.');
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
