# Estado de implementación de contenido jurídico

Fecha de auditoría inicial: 2026-07-26
Rama: `codex/legal-content-production-20260726`
Base de producción revisada: `e477f57`

Este documento conserva la auditoría inicial y registra el cierre técnico realizado en la misma rama. La evidencia corresponde a ejecución local con Node 22, PostgreSQL y Redis locales; no se realizó deploy.

| Fase | Requisito | Estado final | Implementación | Evidencia local |
|---|---|---|---|---|
| 1 | Recuperar estado actual sin perder trabajo previo | Completo | Se continuó sobre `codex/legal-content-production-20260726` y base `e477f57`; no se usó reset ni clean. | Inventario Git y auditoría inicial preservados |
| 2 | Instalación reproducible y ESLint | Validado | Lockfile reconciliado con Node 22; parche versionado de `minimatch@3.1.5` compatible con `brace-expansion@5`. | `npm ci` correcto; ESLint: 0 errores, 302 advertencias históricas |
| 3 | Quince machotes profesionales | Validado | 15 definiciones completas, campos aplicables, validación de obligatorios, marcadores `PENDIENTE` identificables y vista tipo hoja. | `tests/templates/*` y catálogo productivo |
| 4 | Asistencia de IA jurídicamente segura | Validado | Sólo cinco secciones permitidas; fuentes recuperadas en servidor, coincidencia exacta de ID/URL/tipo, dominio oficial y contexto acotado. | Pruebas de citas inventadas, fuentes no oficiales, JSON incompleto y contexto repetible |
| 5 | Exportación DOCX, PDF/impresión, TXT y portapapeles | Validado | DOCX real, HTML de impresión escapado, TXT y clipboard; errores visibles y validación previa. | Pruebas de DOCX y escape de PDF; build de la interfaz |
| 6 | Normas, versiones, artículos, reformas y verificación | Validado | Se reutilizan `Norma`, `NormaVersion` y `NormaDiff`; snapshots por hash real, artículos extraídos del contenido y verificaciones persistidas. | 7 pruebas de versionado; API y UI compiladas |
| 7 | Jurisprudencia verificada | Validado | API/consulta local con filtros, importador SJF sin datos ficticios y estado `browser_required` ante bloqueo/sesión. | 6 pruebas; estado vacío exacto en UI |
| 8 | Expedientes aislados por organización | Validado | Se reutilizan `Matter` y `CaseFile`; CRUD y recursos hijos acotados al tenant derivado del servidor. `localStorage` queda sólo para borrador nuevo. | 6 pruebas negativas de identidad, scope y validación |
| 9 | Monitoreo automático de fuentes | Validado | Cola BullMQ diaria, cinco intentos con backoff, verificaciones/hash/versiones y alertas sólo tras cambio comprobado. | 4 pruebas de detección, deduplicación y reintento |
| 10 | Dashboard con métricas reales | Validado | Conteos Prisma de normas, criterios, expedientes, alertas, fuentes con error y última ejecución de `norm-monitoring`. | Typecheck y build de producción |
| 11 | Prisma y migración incremental | Validado | Migración 20 incremental sobre modelos existentes, sin tablas núcleo duplicadas ni eliminación de historial. | `format`, `validate`, `generate` y `migrate deploy` correctos |
| 12 | Pruebas automáticas sustantivas | Validado | Tests conectados a módulos productivos; pruebas legacy portables y margen estable para Prisma/tsx en Windows. | Legacy 286/286; Vitest 78/78 |
| 13 | Validación, auditoría de secretos y commit local | Validado | Build, tipos, lint, Prisma, pruebas, diff y escaneo de secretos están verdes; el cierre se registra en un commit local, sin push ni deploy. | `next build` correcto; `git diff --check` sin errores; sin secretos de alta confianza |

## Decisiones de continuidad

- `Matter` y `CaseFile` serán la base de expedientes y archivos; se extenderán únicamente con los conceptos jurídicos que no tengan equivalente.
- `Norma`, `NormaVersion` y `NormaDiff` serán la base de la biblioteca normativa; no se conservarán tablas núcleo duplicadas.
- Ningún importador almacenará artículos, fechas, reformas, registros digitales o textos simulados.
- Una fuente que requiera navegador, sesión o CAPTCHA se marcará como tal y no se intentará eludir la protección.
- Los endpoints de expedientes derivarán la organización y el usuario del contexto autorizado del servidor, nunca de IDs enviados por el cliente.
