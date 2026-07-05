# Guía de uso

## Patrón general

1. Elige un archivo en `codex/`.
2. Define alcance y artefacto de salida.
3. Adjunta `codex/CODEX_RULES.md` cuando haya escritura o riesgo.
4. Pide análisis primero; aprueba el plan; después autoriza implementación.
5. Cierra con `workflows/QUALITY_GATE.md`.

## Auditar un proyecto

```text
Lee ai-dev-toolkit/codex/CODEX_PROJECT_AUDIT.md y CODEX_RULES.md.
Audita todo el repositorio en modo solo lectura y guarda el reporte en AUDITORIA.md.
```

## Reparar bugs

```text
Usa CODEX_REPAIR_FLOW.md para reparar el fallo de <comando/caso>.
No cambies expectativas ni refactorices fuera de alcance. Muéstrame causa y plan antes del diff.
```

## Revisar seguridad

```text
Usa CODEX_SECURITY_REVIEW.md sobre auth, rutas API y workers.
Incluye una matriz de permisos y pruebas negativas por cada hallazgo alto.
```

## Revisar base de datos

```text
Usa CODEX_DATABASE_REVIEW.md con prisma/schema.prisma y migraciones.
No conectes a producción. Prioriza integridad, tenancy, índices, backup y recovery.
```

## Mejorar rendimiento

```text
Sigue workflows/PERFORMANCE_AUDIT.md para <flujo crítico>.
Primero crea baseline p50/p95 y perfil de DB/colas. No edites hasta proponer un experimento medible.
```

## Preparar producción

```text
Usa CODEX_DEPLOYMENT_REVIEW.md para <staging/producción>.
Entrega SHIP/BLOCK y un runbook de deploy/rollback; no despliegues.
```

## Apps web

Combina `CODEX_FRONTEND_REVIEW.md`, `CODEX_BACKEND_REVIEW.md` y `workflows/WEB_FULLSTACK_AUDIT.md`. Añade navegador solo para verificar UI/UX o flujos E2E autorizados.

## Apps móviles

Usa `CODEX_MOBILE_REVIEW.md` y especifica plataforma, flavors, target SDK/iOS y método de distribución. Nunca compartas signing keys o profiles dentro del prompt.

## Backend

Empieza con una matriz de endpoints y efectos. Para jobs/webhooks, exige idempotencia, retry policy, DLQ y pruebas de duplicados/out-of-order.

## Bases de datos

Revisa esquema y migraciones estáticamente antes de conectar. Usa una base desechable para ensayar migraciones y restore. Nunca uses `db push`, reset o seed contra producción.

## Copiar a otro proyecto

1. Copia `ai-dev-toolkit/` completa.
2. Revisa `codex/CODEX_RULES.md` y adapta comandos al package manager/stack.
3. No copies `.tmp/ecc-source`, `.env`, MCP configs o permisos.
4. Registra personalizaciones en `CHANGELOG.md` local.

