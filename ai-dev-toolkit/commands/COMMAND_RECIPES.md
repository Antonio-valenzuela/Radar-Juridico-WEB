# Recetas de comandos conversacionales

No son slash commands. Copia la receta en Codex y reemplaza los campos entre `<...>`.

## Auditar

> Usa `codex/CODEX_PROJECT_AUDIT.md`. Audita `<alcance>`, no modifiques archivos y guarda el reporte en `<ruta>`.

## Reparar

> Usa `codex/CODEX_REPAIR_FLOW.md`. Corrige únicamente `<hallazgo>`; primero reproduce, después crea una prueba y entrega un diff pequeño.

## Revisar diff

> Revisa `git diff` priorizando seguridad, pérdida de datos, regresiones y pruebas faltantes. No edites. Reporta archivo/línea y severidad.

## Quality gate

> Detecta scripts del proyecto y ejecuta lint, tipos, tests y build sin instalar ni arreglar automáticamente. Resume comandos, exit codes y primer error accionable.

## Preparar producción

> Usa `codex/CODEX_DEPLOYMENT_REVIEW.md`. Evalúa `<entorno>` y entrega decisión ship/block, rollback y comandos de verificación.

