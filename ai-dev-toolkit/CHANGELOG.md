# Changelog

## 2026-06-20 — Creación inicial

### Agregado

- Caja portable con 34 documentos bajo agents, skills, commands, hooks, rules, prompts, checklists, security, workflows, templates, docs y Codex.
- Diez prompts/checklists específicos para Codex solicitados.
- Workflows para investigación, reparación, quality gate, refactor, rendimiento, web, datos, móvil y despliegue.
- Documentación de uso, índice y reporte de compatibilidad ECC.

### Adaptado conceptualmente desde ECC

- Roles enfocados y exploración de solo lectura.
- Research-first y preferencia por evidencia local/primaria.
- Verification loops y producción como decisión basada en evidencia.
- Seguridad sin depender de hooks; sandbox y aprobación como controles.
- Contexto bajo demanda en lugar de cargar catálogos completos.

Todo fue reescrito en español para Codex; no se copiaron scripts ni configuraciones.

### Descartado

- Instaladores, paquetes npm, dashboard, runtime ECC2 y control plane.
- Hooks ejecutables y persistencia automática de memoria.
- Configuraciones MCP, credenciales, servicios y permisos predefinidos.
- Slash commands específicos de Claude/OpenCode y shims legacy.
- Automatización multiagente, tmux/PM2 y publicación externa.
- Skills de negocio, media, mercados y stacks no pertinentes.

### Proyecto principal

- Creado `AUDITORIA_PROYECTO.md`.
- Creado `docs/AI_WORKFLOW.md`.
- Creados documentos de diseño/plan bajo `docs/superpowers/`.
- Inicializado `.codegraph/` con aprobación.
- Clonado ECC únicamente en `.tmp/ecc-source`.
- No se modificó código funcional, `.env` ni el README principal.
