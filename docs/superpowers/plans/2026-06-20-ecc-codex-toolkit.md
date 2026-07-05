# ECC Codex Toolkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar Jurídico Radar y construir un toolkit documental, portátil y original para Codex usando ECC solo como referencia conceptual.

**Architecture:** La aplicación se trata como fuente de solo lectura. ECC se aísla en `.tmp/ecc-source`; los resultados viven en `AUDITORIA_PROYECTO.md`, `docs/AI_WORKFLOW.md` y `ai-dev-toolkit/`, sin dependencias ni integración ejecutable.

**Tech Stack:** Markdown, Git, CodeGraph, Node.js/Next.js verification commands.

---

### Task 1: Capturar evidencia del proyecto

**Files:**
- Read: `package.json`, `prisma/schema.prisma`, `.github/workflows/ci.yml`, `docker-compose.yml`, `.env.example`
- Create: `AUDITORIA_PROYECTO.md`

- [x] **Step 1: Inventariar stack, estructura, scripts, variables y persistencia**

Usar CodeGraph para relaciones estructurales y lectura directa solo para manifiestos y configuración.

- [x] **Step 2: Inspeccionar superficies críticas**

Revisar autorización administrativa, multitenencia, validación, rate limiting, rutas de depuración, colas, ingestión, búsqueda y proveedores de IA.

- [x] **Step 3: Ejecutar verificación no destructiva**

Run: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

Expected: registrar éxitos y fallos reales; no corregirlos en esta fase.

- [x] **Step 4: Escribir la auditoría**

Documentar resumen ejecutivo, arquitectura, fortalezas, hallazgos críticos/medios/menores, riesgos de producción y plan de remediación.

### Task 2: Inspeccionar ECC de forma aislada

**Files:**
- Create: `.tmp/ecc-source/` mediante clon superficial
- Create: `ai-dev-toolkit/docs/ECC_COMPATIBILITY_REPORT.md`

- [x] **Step 1: Clonar sin instalar ni ejecutar**

Run: `git clone --depth 1 https://github.com/affaan-m/ECC.git .tmp/ecc-source`

Expected: repositorio disponible solo como referencia estática.

- [x] **Step 2: Inventariar recursos y licencia**

Clasificar agents, skills, commands, hooks, rules, MCP, workflows, seguridad, testing, investigación, memoria y documentación.

- [x] **Step 3: Definir selección y descartes**

Registrar para cada categoría: idea aplicable, adaptación Codex, motivo de descarte o riesgo.

### Task 3: Crear el núcleo portable

**Files:**
- Create: `ai-dev-toolkit/README.md`
- Create: `ai-dev-toolkit/TOOLKIT_INDEX.md`
- Create: `ai-dev-toolkit/USAGE_GUIDE.md`
- Create: `ai-dev-toolkit/CHANGELOG.md`
- Create: documentos bajo `agents/`, `skills/`, `commands/`, `hooks/`, `rules/`, `prompts/`, `checklists/`, `security/`, `workflows/`, `templates/`, `docs/`

- [x] **Step 1: Crear perfiles, reglas y controles seguros**

Los recursos deben ser Markdown original, autocontenido y sin instrucciones ejecutables peligrosas.

- [x] **Step 2: Crear workflows y plantillas**

Cubrir auditoría, investigación, reparación, refactor, testing, rendimiento, bases de datos, frontend, backend, móvil y despliegue.

- [x] **Step 3: Documentar navegación y uso**

El índice debe enumerar todos los archivos y la guía debe incluir ejemplos para los escenarios solicitados.

### Task 4: Crear la capa específica para Codex

**Files:**
- Create: `ai-dev-toolkit/codex/CODEX_PROJECT_AUDIT.md`
- Create: `ai-dev-toolkit/codex/CODEX_REPAIR_FLOW.md`
- Create: `ai-dev-toolkit/codex/CODEX_SECURITY_REVIEW.md`
- Create: `ai-dev-toolkit/codex/CODEX_DATABASE_REVIEW.md`
- Create: `ai-dev-toolkit/codex/CODEX_FRONTEND_REVIEW.md`
- Create: `ai-dev-toolkit/codex/CODEX_BACKEND_REVIEW.md`
- Create: `ai-dev-toolkit/codex/CODEX_MOBILE_REVIEW.md`
- Create: `ai-dev-toolkit/codex/CODEX_DEPLOYMENT_REVIEW.md`
- Create: `ai-dev-toolkit/codex/CODEX_REUSABLE_PROMPTS.md`
- Create: `ai-dev-toolkit/codex/CODEX_RULES.md`

- [x] **Step 1: Escribir prompts con contratos de entrada/salida**

Cada revisión debe separar evidencia, diagnóstico, propuesta, implementación y verificación.

- [x] **Step 2: Incorporar reglas de protección**

No borrar, no exponer secretos, no cambiar arquitectura sin justificar, respaldar configuraciones, preservar cambios del usuario y ejecutar pruebas.

### Task 5: Integración documental y verificación final

**Files:**
- Create: `docs/AI_WORKFLOW.md`
- Verify: todos los archivos creados

- [x] **Step 1: Documentar el flujo específico de Jurídico Radar**

Explicar cómo auditar y reparar por fases sin acoplar el toolkit a la aplicación.

- [x] **Step 2: Validar contenido y seguridad**

Comprobar archivos requeridos, enlaces relativos, placeholders, posibles secretos y ausencia de cambios funcionales.

- [x] **Step 3: Revisar Git diff y entregar reporte**

Run: `git status --short`

Expected: solo artefactos autorizados nuevos y cambios previos del usuario intactos.
