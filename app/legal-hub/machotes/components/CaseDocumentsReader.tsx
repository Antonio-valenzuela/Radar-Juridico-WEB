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
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] flex items-center space-x-2">
          <span>📁 Documentos del Caso ({documents.length})</span>
        </h3>
        {onUploadNewDocument && (
          <button
            onClick={onUploadNewDocument}
            className="machote-btn-primary text-xs px-3 py-1.5"
          >
            + Agregar Documento
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Document List */}
        <div className="w-64 bg-slate-50/70 border-r border-slate-200 p-3 space-y-2 overflow-y-auto">
          {documents.length === 0 ? (
            <div className="text-xs text-slate-500 italic p-3 text-center">
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
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    isSelected
                      ? 'bg-white border-[#0B2545] text-[#0B2545] shadow-sm font-semibold'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                    <span className="truncate max-w-[130px] font-bold">{doc.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase">
                      {doc.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{doc.pageCount} pág(s)</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        doc.status === 'READY'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
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
        <div className="flex-1 flex flex-col bg-slate-50/40 p-4 overflow-y-auto">
          {selectedDoc ? (
            <div className="flex-1 flex flex-col space-y-3">
              {/* Document Info Header */}
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-sm">
                <div>
                  <h4 className="font-bold text-[#0B2545]">{selectedDoc.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    Página {activePage} de {selectedDoc.pageCount} — Fuente Inmutable
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300"
                  >
                    ←
                  </button>
                  <span className="font-mono font-bold text-[#0B2545] text-xs px-2">{activePage}</span>
                  <button
                    onClick={() => setActivePage((p) => Math.min(selectedDoc.pageCount, p + 1))}
                    disabled={activePage === selectedDoc.pageCount}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Source Text Page Canvas */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 font-serif text-sm leading-relaxed whitespace-pre-wrap text-slate-800 shadow-inner overflow-y-auto">
                {selectedDoc.pages && selectedDoc.pages[activePage - 1]
                  ? selectedDoc.pages[activePage - 1].text
                  : 'Sin contenido en la página seleccionada.'}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
              Seleccione un documento del caso para inspeccionar su contenido fuente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
