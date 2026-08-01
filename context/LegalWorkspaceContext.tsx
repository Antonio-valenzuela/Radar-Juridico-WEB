"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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

  // Setter for context mode, updates state and can be used by components
  const setContextMode = (mode: ContextMode) => {
    setContextModeState(mode);
  };

  const setActiveDocument = (doc: LegalWorkspaceDocumentContext | null) => {
    setActiveDocumentState(doc);
    if (doc) setContextMode('current_document');
    if (doc) {
      // setContextModeState("current_document"); // removed redundant state update
      try {
        sessionStorage.setItem("juridico_active_draft", JSON.stringify(doc));
      } catch {}
    } else {
      try {
        sessionStorage.removeItem("juridico_active_draft");
      } catch {}
    }
  };

  const updateDocumentFields = (
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
  };

  const clearActiveDocument = () => {
    setActiveDocumentState(null);
    setContextMode('none');
    try {
      sessionStorage.removeItem("juridico_active_draft");
    } catch {}
  };

  const setActiveCase = (caseCtx: LegalWorkspaceCaseContext | null) => {
    setActiveCaseState(caseCtx);
    if (caseCtx) setContextMode('current_case');
  };

  const setActiveBulletin = (bulletinCtx: LegalWorkspaceBulletinContext | null) => {
    setActiveBulletinState(bulletinCtx);
    if (bulletinCtx) setContextMode('current_bulletin');
  };

  return (
    <LegalWorkspaceContext.Provider
      value={{
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
      }}
    >
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
