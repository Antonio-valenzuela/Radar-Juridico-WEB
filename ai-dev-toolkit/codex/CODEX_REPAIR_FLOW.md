# Prompt: reparación por fases

```text
Repara únicamente <PROBLEMA> siguiendo CODEX_RULES.md.

Fase 1 — Diagnóstico: reproduce con el comando mínimo, traza el flujo y demuestra causa raíz. No edites todavía.
Fase 2 — Protección: escribe una prueba que falle por la causa correcta o una prueba de caracterización.
Fase 3 — Plan: lista archivos, cambio mínimo, riesgos y rollback. No mezcles refactors.
Fase 4 — Implementación: aplica el menor diff que haga pasar la prueba.
Fase 5 — Verificación: prueba focal, suite relacionada, lint/tipos/build y E2E si aplica.
Fase 6 — Entrega: resume causa, cambio, pruebas, archivos, riesgos y pendientes.

Detente y pide permiso si aparece una migración destructiva, cambio de arquitectura, dependencia nueva, secreto o acción externa.
```

