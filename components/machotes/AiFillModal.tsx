"use client";

import React, { useState } from "react";
import { PdfUploader } from "./PdfUploader";
import { FieldReviewPanel, DetectedFieldItem } from "./FieldReviewPanel";

interface AiFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  templateSections: Array<{ id: string; title: string; required?: boolean }>;
  currentFields: Record<string, any>;
  onApplyFields: (fields: Record<string, string>) => void;
}

export function AiFillModal({
  isOpen,
  onClose,
  templateName,
  templateSections,
  currentFields,
  onApplyFields,
}: AiFillModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "pdf">("text");
  const [textDescription, setTextDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Review step state
  const [reviewData, setReviewData] = useState<{
    detectedFields: Record<string, DetectedFieldItem>;
    missingFields: string[];
    warnings: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleProcess = async () => {
    setError(null);
    setLoading(true);
    setLoadingStep("Validando entrada...");

    try {
      const formData = new FormData();
      formData.append("templateName", templateName);

      if (activeTab === "pdf") {
        if (!selectedFile) {
          throw new Error("Por favor selecciona un archivo PDF.");
        }
        setLoadingStep("Extrayendo texto del PDF...");
        formData.append("file", selectedFile);
        formData.append("mode", "pdf");
      } else {
        if (!textDescription.trim()) {
          throw new Error("Por favor describe el asunto o pega los hechos.");
        }
        setLoadingStep("Analizando texto con IA...");
        formData.append("text", textDescription);
        formData.append("mode", "text");
      }

      setLoadingStep("Ejecutando análisis estructurado y verificando evidencias...");
      const res = await fetch("/api/templates/ai-fill", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "No se pudo procesar el autollenado.");
      }

      setLoadingStep("Preparando propuestas de campos...");

      const rawFields = json.data?.fields || {};
      const detectedFields: Record<string, DetectedFieldItem> = {};

      for (const section of templateSections) {
        const aiField = rawFields[section.id] || rawFields[section.title.toLowerCase()];
        if (aiField && aiField.value) {
          detectedFields[section.id] = {
            key: section.id,
            label: section.title,
            currentValue: String(currentFields[section.id] || ""),
            detectedValue: String(aiField.value),
            confidence: Number(aiField.confidence || 0.85),
            evidence: aiField.evidence,
          };
        }
      }

      // If no exact match found, map generic fields
      if (Object.keys(detectedFields).length === 0) {
        for (const [k, v] of Object.entries(rawFields)) {
          const valObj = v as any;
          if (valObj && valObj.value) {
            detectedFields[k] = {
              key: k,
              label: k.replace(/_/g, " "),
              currentValue: String(currentFields[k] || ""),
              detectedValue: String(valObj.value),
              confidence: Number(valObj.confidence || 0.8),
              evidence: valObj.evidence,
            };
          }
        }
      }

      setReviewData({
        detectedFields,
        missingFields: json.data?.missingFields || [],
        warnings: json.data?.warnings || [],
      });
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleApplySelected = (fields: Record<string, string>) => {
    onApplyFields(fields);
    setReviewData(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span>✨ Autollenado Inteligente del Machote</span>
            </h2>
            <p className="text-xs text-slate-300">
              Plantilla seleccionada: <span className="font-semibold text-white">{templateName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold text-lg px-2"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {reviewData ? (
            <FieldReviewPanel
              detectedFields={reviewData.detectedFields}
              missingFields={reviewData.missingFields}
              warnings={reviewData.warnings}
              onApplySelected={handleApplySelected}
              onCancel={() => setReviewData(null)}
            />
          ) : (
            <>
              {/* Mode Tabs */}
              <div className="flex border-b border-slate-200 gap-4 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  className={`pb-2.5 px-1 border-b-2 transition ${
                    activeTab === "text"
                      ? "border-blue-700 text-blue-900 font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  1. Describir el asunto
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pdf")}
                  className={`pb-2.5 px-1 border-b-2 transition ${
                    activeTab === "pdf"
                      ? "border-blue-700 text-blue-900 font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  2. Subir formato anterior en PDF
                </button>
              </div>

              {/* Tab 1: Text Description */}
              {activeTab === "text" && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Describe los hechos, partes, fechas, juzgado y acto reclamado:
                  </label>
                  <textarea
                    value={textDescription}
                    onChange={(e) => setTextDescription(e.target.value)}
                    disabled={loading}
                    rows={8}
                    placeholder="Ejemplo: El Sr. Juan Pérez López fue notificado el 15 de julio de una orden emitida por el Juzgado Segundo Civil de Guadalajara en el expediente 452/2026..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
                  />
                </div>
              )}

              {/* Tab 2: PDF Upload */}
              {activeTab === "pdf" && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Selecciona un archivo PDF previo (demanda, contestación o formato anterior):
                  </label>
                  <PdfUploader
                    disabled={loading}
                    onFileSelected={(file) => setSelectedFile(file)}
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium">
                  {error}
                </div>
              )}

              {loading && (
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-center gap-3 text-xs text-purple-900 animate-pulse">
                  <span className="w-3 h-3 rounded-full bg-purple-600 animate-ping" />
                  <span className="font-semibold">{loadingStep}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!reviewData && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={loading || (activeTab === "text" && !textDescription.trim()) || (activeTab === "pdf" && !selectedFile)}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-xl shadow transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{loading ? "Analizando..." : "Analizar y rellenar machote"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
