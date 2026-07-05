# Prompts reutilizables para Codex

## Analizar sin cambiar

> Analiza `<área>` en modo solo lectura. Cita rutas, símbolos y comandos. Separa hechos, inferencias y evidencia faltante. No propongas implementación hasta demostrar la causa.

## Planificar

> Crea un plan para `<objetivo>` con archivos exactos, pasos pequeños, pruebas, riesgos y rollback. Respeta patrones existentes y no añadas dependencias sin justificar.

## Revisar seguridad

> Usa `CODEX_SECURITY_REVIEW.md` sobre `<superficie>`. Prioriza explotabilidad e impacto, no estilo. No imprimas secretos.

## Revisar base de datos

> Usa `CODEX_DATABASE_REVIEW.md`. No ejecutes migraciones. Analiza schema y queries, y diseña una transición expand/contract verificable.

## Mejorar rendimiento

> Mide `<flujo>` antes de editar. Define presupuesto, baseline e hipótesis. Propón un experimento mínimo y compara antes/después.

## Preparar producción

> Usa `CODEX_DEPLOYMENT_REVIEW.md` y entrega SHIP/BLOCK. Incluye build, variables, migraciones, observabilidad, rollback y evidencia faltante.

## Revisar un diff

> Revisa únicamente el diff actual. Busca bugs, seguridad, datos, concurrencia y pruebas faltantes. Reporta hallazgos con severidad y línea; no resumas archivos sin problemas.

## Documentar

> Actualiza documentación solo donde el comportamiento comprobado cambió. No inventes comandos ni capacidades; contrasta README, scripts, CI y despliegue.

