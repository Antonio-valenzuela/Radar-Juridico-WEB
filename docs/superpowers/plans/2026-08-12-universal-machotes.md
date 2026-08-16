# Motor Universal de Machotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution in this session). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los flujos aislados de Machotes con un motor documental universal, trazable y persistente.

**Architecture:** El servidor es dueño del pipeline y del contexto documental completo. Las fuentes se conservan por página, se enriquecen con contexto de sección y se recuperan por relevancia antes de generar cada sección. El cliente consume endpoints explícitos y guarda el documento estructurado en `LegalDraft`.

**Tech Stack:** Next.js 16, TypeScript, Prisma/PostgreSQL, pgvector, Vitest, docx.

---

### Task 1: Modelo seguro de fuentes y contexto

**Files:**
- Modify: `lib/legal-engine/types.ts`
- Create: `lib/legal-engine/context.ts`
- Test: `tests/templates/legalEngine.test.ts`

- [ ] Escribir pruebas que exijan preservar páginas, bloquear fuentes no validadas y recuperar fragmentos de todo el documento.
- [ ] Ejecutar `npm run test:vitest -- tests/templates/legalEngine.test.ts` y comprobar fallo por API ausente.
- [ ] Implementar `DocumentSource`, `DocumentPage`, selección AutoContext y referencias de fuente.
- [ ] Ejecutar la prueba focalizada y comprobar éxito.

### Task 2: Pipeline real y generación modular

**Files:**
- Modify: `lib/legal-engine/pipeline.ts`, `lib/legal-engine/validator.ts`, `lib/legal-engine/structureBuilder.ts`
- Create: `lib/legal-engine/analyzer.ts`, `app/api/legal-documents/analyze/route.ts`, `app/api/legal-documents/regenerate-section/route.ts`
- Test: `tests/templates/legalEngine.test.ts`

- [ ] Escribir pruebas para que el pipeline no declare etapas completas sin contenido y para que un bloque manual no sea sustituido.
- [ ] Ejecutar la prueba focalizada y observar fallo.
- [ ] Implementar análisis basado en fuentes, construcción dinámica y generación de secciones con marcadores y citas.
- [ ] Ejecutar la prueba focalizada y comprobar éxito.

### Task 3: Persistencia y plantillas versionadas

**Files:**
- Modify: `app/api/legal-drafts/route.ts`, `app/api/legal-drafts/[id]/route.ts`, `app/api/templates/custom/[id]/route.ts`
- Create: `app/api/legal-documents/drafts/route.ts`, `app/api/legal-documents/drafts/[id]/route.ts`
- Test: `tests/templates/customTemplatesApi.test.ts`, `tests/templates/legalEngine.test.ts`

- [ ] Escribir pruebas de crear, reabrir, actualizar y versionar un borrador/plantilla estructurados.
- [ ] Ejecutar pruebas focalizadas y observar fallos.
- [ ] Reutilizar `LegalDraft` y `LegalTemplate` para conservar documento, fuentes, revisiones y nueva versión.
- [ ] Ejecutar pruebas focalizadas y comprobar éxito.

### Task 4: RAG y razonamiento multi-step

**Files:**
- Create: `lib/legal-engine/retrieval.ts`, `lib/legal-engine/multiStep.ts`, `app/api/legal-documents/query/route.ts`
- Test: `tests/templates/legalEngine.test.ts`

- [ ] Escribir pruebas para recuperación multi-página, límite de pasos y una traza de decisiones.
- [ ] Ejecutar la prueba focalizada y observar fallo.
- [ ] Implementar AutoContext, reranking determinista y modo multi-step opt-in con máximo de pasos.
- [ ] Ejecutar la prueba focalizada y comprobar éxito.

### Task 5: Unificar UI sin truncamiento

**Files:**
- Modify: `app/legal-hub/machotes/page.tsx`, `components/machotes/UniversalDocEditor.tsx`, `components/machotes/ValidationPanel.tsx`
- Test: `tests/ai/e2eMachoteAssistantFlow.test.ts`

- [ ] Escribir una prueba de flujo que descarte texto truncado y exija una fuente validada antes de generar.
- [ ] Ejecutar la prueba focalizada y observar fallo.
- [ ] Sustituir los handlers monolíticos por endpoints del motor; añadir guardado, reapertura, fuentes y exportaciones desde el documento estructurado.
- [ ] Ejecutar la prueba focalizada y comprobar éxito.

### Task 6: Verificación integral

**Files:**
- Test: `tests/templates/legalEngine.test.ts`, `tests/ai/e2eMachoteAssistantFlow.test.ts`

- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run test:vitest`.
- [ ] Ejecutar `docker compose build` y `docker compose up -d`.
- [ ] Probar localmente el flujo de sentencia 800/2024 y cuatro solicitudes universales, documentando evidencia y limitaciones de autenticación del navegador.
