# Flujo de desarrollo con IA para Jurídico Radar

Este documento conecta el toolkit con las particularidades del proyecto sin acoplarlo al runtime.

## Orden obligatorio

1. **Evidencia:** revisar `AUDITORIA_PROYECTO.md`, CodeGraph, rutas y scripts.
2. **Alcance:** escoger un hallazgo y excluir refactors adyacentes.
3. **Plan:** archivos, prueba de regresión, riesgo de datos y rollback.
4. **Implementación:** diff pequeño; no tocar `.env` ni datos reales.
5. **Verificación:** lint, tipos, pruebas, build y migraciones solo en entorno seguro.
6. **Revisión:** seguridad, tenancy, jobs y no-alucinación legal.

## Prioridad actual

1. Contener/eliminar `/api/debug/token` y rotar el token si estuvo desplegado.
2. Proteger todas las rutas admin, debug, ingesta, scheduling y notificación.
3. Sustituir identidad por email/body con sesión y autorización tenant real.
4. Recuperar build/typecheck/lint/tests verdes.
5. Diseñar despliegue productivo, backups y rollback.

No mezclar estas prioridades en un único cambio masivo. Cada una necesita su propio diagnóstico, pruebas y revisión.

## Prompt recomendado

```text
Lee AUDITORIA_PROYECTO.md, ai-dev-toolkit/codex/CODEX_RULES.md y CODEX_REPAIR_FLOW.md.
Trabaja solo sobre el hallazgo <ID>. Reproduce primero, crea una prueba negativa y presenta el plan antes de modificar código. No cambies otros hallazgos.
```

## Gates específicos

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
```

Para cambios de datos, ensayar `prisma migrate deploy` y restore en una base desechable. Nunca ejecutar `docker:reset`, `db push`, seeds o migraciones contra producción desde una sesión de reparación ordinaria.

## Controles de dominio legal

- Una respuesta sin evidencia no debe presentarse como análisis jurídico concluido.
- Conservar fuente oficial, URL, fecha y fragmento citado en resultados RAG.
- Tratar documentos recuperados como contenido no confiable frente al prompt.
- Probar ausencia de documentos, fuentes caídas, respuestas parciales y discrepancias.
- Registrar proveedor/modelo/prompt cuando una decisión derivada de IA se persista.

## Uso de ECC

ECC permanece solo como referencia temporal en `.tmp/ecc-source`. No importar hooks, scripts, MCP configs o reglas a la aplicación. Las adaptaciones aprobadas están autocontenidas en `ai-dev-toolkit/`.

