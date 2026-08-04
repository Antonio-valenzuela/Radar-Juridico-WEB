"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";

export type ContextMode = "current_document" | "current_case" | "current_bulletin" | "none";

export interface LegalWorkspaceDocumentContext {
  draftId?: string;
  templateId?: string;
  documentType?: string;
  templateName?: string;
  matter?: string;
  jurisdiction?: string;
  procedureType?: string;
  fields?: Record<string, any>;
  sections?: Record<string, string>;
  previewText?: string;
  pendingMarkers?: string[];
  updatedAt?: string;
}

export interface LegalWorkspaceCaseContext {
  caseId?: string;
  expedienteNumber?: string;
  court?: string;
  actor?: string;
  demandado?: string;
  matter?: string;
}

export interface LegalWorkspaceBulletinContext {
  subscriptionId?: string;
  expediente?: string;
  sourceId?: string;
  sourceName?: string;
}

interface LegalWorkspaceContextType {
  route: string;
  module: string;
  contextMode: ContextMode;
  activeDocument: LegalWorkspaceDocumentContext | null;
  activeCase: LegalWorkspaceCaseContext | null;
  activeBulletin: LegalWorkspaceBulletinContext | null;
  setContextMode: (mode: ContextMode) => void;
  setActiveDocument: (doc: LegalWorkspaceDocumentContext | null) => void;
  updateDocumentFields: (fields: Record<string, any>, previewText?: string, pendingMarkers?: string[]) => void;
  clearActiveDocument: () => void;
  setActiveCase: (caseCtx: LegalWorkspaceCaseContext | null) => void;
  setActiveBulletin: (bulletinCtx: LegalWorkspaceBulletinContext | null) => void;
}

const LegalWorkspaceContext = createContext<LegalWorkspaceContextType | undefined>(undefined);

function detectModuleFromPath(pathname: string): string {
  if (pathname.includes("/machotes")) return "machotes";
  if (pathname.includes("/expedientes")) return "expedientes";
  if (pathname.includes("/boletines")) return "boletines";
  if (pathname.includes("/cambios")) return "cambios";
  if (pathname.includes("/jurisprudencia")) return "jurisprudencia";
  if (pathname.includes("/leyes")) return "leyes";
  if (pathname.includes("/documents") || pathname.includes("/items")) return "documentos";
  return "general";
}

export function LegalWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const currentModule = detectModuleFromPath(pathname);

  const [activeDocument, setActiveDocumentState] = useState<LegalWorkspaceDocumentContext | null>(() => {
    try {
      const saved = sessionStorage.getItem("juridico_active_draft");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeCase, setActiveCaseState] = useState<LegalWorkspaceCaseContext | null>(null);
  const [activeBulletin, setActiveBulletinState] = useState<LegalWorkspaceBulletinContext | null>(null);

  const [contextMode, setContextModeState] = useState<ContextMode>('none');

  const setContextMode = useCallback((mode: ContextMode) => {
    setContextModeState(mode);
  }, []);

  const setActiveDocument = useCallback((doc: LegalWorkspaceDocumentContext | null) => {
    setActiveDocumentState((prev) => {
      if (
        prev === doc ||
        (prev &&
          doc &&
          prev.templateId === doc.templateId &&
          prev.previewText === doc.previewText &&
          JSON.stringify(prev.fields) === JSON.stringify(doc.fields))
      ) {
        return prev;
      }
      return doc;
    });

    if (doc) {
      setContextModeState("current_document");
      try {
        sessionStorage.setItem("juridico_active_draft", JSON.stringify(doc));
      } catch {}
    } else {
      try {
        sessionStorage.removeItem("juridico_active_draft");
      } catch {}
    }
  }, []);

  const updateDocumentFields = useCallback((
    fields: Record<string, any>,
    previewText?: string,
    pendingMarkers?: string[]
  ) => {
    setActiveDocumentState((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        fields: { ...(prev.fields || {}), ...fields },
        previewText: previewText !== undefined ? previewText : prev.previewText,
        pendingMarkers: pendingMarkers !== undefined ? pendingMarkers : prev.pendingMarkers,
        updatedAt: new Date().toISOString(),
      };
      try {
        sessionStorage.setItem("juridico_active_draft", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const clearActiveDocument = useCallback(() => {
    setActiveDocumentState(null);
    setContextModeState('none');
    try {
      sessionStorage.removeItem("juridico_active_draft");
    } catch {}
  }, []);

  const setActiveCase = useCallback((caseCtx: LegalWorkspaceCaseContext | null) => {
    setActiveCaseState(caseCtx);
    if (caseCtx) setContextModeState('current_case');
  }, []);

  const setActiveBulletin = useCallback((bulletinCtx: LegalWorkspaceBulletinContext | null) => {
    setActiveBulletinState(bulletinCtx);
    if (bulletinCtx) setContextModeState('current_bulletin');
  }, []);

  const contextValue = useMemo(() => ({
    route: pathname,
    module: currentModule,
    contextMode,
    activeDocument,
    activeCase,
    activeBulletin,
    setContextMode,
    setActiveDocument,
    updateDocumentFields,
    clearActiveDocument,
    setActiveCase,
    setActiveBulletin,
  }), [
    pathname,
    currentModule,
    contextMode,
    activeDocument,
    activeCase,
    activeBulletin,
    setContextMode,
    setActiveDocument,
    updateDocumentFields,
    clearActiveDocument,
    setActiveCase,
    setActiveBulletin,
  ]);

  return (
    <LegalWorkspaceContext.Provider value={contextValue}>
      {children}
    </LegalWorkspaceContext.Provider>
  );
}

export function useLegalWorkspaceContext() {
  const context = useContext(LegalWorkspaceContext);
  if (!context) {
    return {
      route: "",
      module: "general",
      contextMode: "none" as ContextMode,
      activeDocument: null,
      activeCase: null,
      activeBulletin: null,
      setContextMode: () => {},
      setActiveDocument: () => {},
      updateDocumentFields: () => {},
      clearActiveDocument: () => {},
      setActiveCase: () => {},
      setActiveBulletin: () => {},
    };
  }
  return context;
}
