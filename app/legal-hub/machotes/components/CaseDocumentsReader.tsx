'use client';

import React, { useState } from 'react';
import { CaseDocument } from '../../../../lib/legal-engine/types';

interface CaseDocumentsReaderProps {
  documents: CaseDocument[];
  selectedDocId?: string | null;
  onSelectDocument: (doc: CaseDocument) => void;
  onUploadNewDocument?: () => void;
}

export function CaseDocumentsReader({
  documents,
  selectedDocId,
  onSelectDocument,
  onUploadNewDocument,
}: CaseDocumentsReaderProps) {
  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const [activePage, setActivePage] = useState(1);

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
          Documentos del Caso ({documents.length})
        </h3>
        {onUploadNewDocument && (
          <button
            onClick={onUploadNewDocument}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded transition"
          >
            + Agregar Expediente
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Document List */}
        <div className="w-56 bg-slate-900/60 border-r border-slate-800 p-3 space-y-2 overflow-y-auto">
          {documents.length === 0 ? (
            <div className="text-xs text-slate-500 italic p-3">
              No hay documentos cargados en el expediente.
            </div>
          ) : (
            documents.map((doc) => {
              const isSelected = doc.id === selectedDoc?.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    onSelectDocument(doc);
                    setActivePage(1);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <span className="truncate max-w-[130px]">{doc.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{doc.type}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{doc.pageCount} pág(s)</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        doc.status === 'READY'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {doc.status === 'READY' ? 'VERIFICADA' : 'PARCIAL / OCR'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Document Content Reader (Read-Only Source) */}
        <div className="flex-1 flex flex-col bg-slate-950 p-4 overflow-y-auto">
          {selectedDoc ? (
            <div className="flex-1 flex flex-col space-y-4">
              {/* Document Info Header */}
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs">
                <div>
                  <h4 className="font-bold text-slate-200">{selectedDoc.name}</h4>
                  <p className="text-[11px] text-slate-400">
                    Página {activePage} de {selectedDoc.pageCount} — Ingestión Local
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-xs font-semibold"
                  >
                    ←
                  </button>
                  <span className="font-mono text-amber-400">{activePage}</span>
                  <button
                    onClick={() => setActivePage((p) => Math.min(selectedDoc.pageCount, p + 1))}
                    disabled={activePage === selectedDoc.pageCount}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-xs font-semibold"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Source Text Page Canvas */}
              <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-lg p-6 font-serif text-sm leading-relaxed whitespace-pre-wrap text-slate-300 overflow-y-auto">
                {selectedDoc.pages && selectedDoc.pages[activePage - 1]
                  ? selectedDoc.pages[activePage - 1].text
                  : 'Sin contenido en la página seleccionada.'}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic">
              Seleccione un documento del caso para inspeccionar su contenido fuente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
