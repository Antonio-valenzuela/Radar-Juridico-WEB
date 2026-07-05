# AI Development Toolkit

Caja de herramientas documental para auditar, reparar y evolucionar proyectos con Codex sin mezclar automatización externa con el código de la aplicación.

## Origen

El toolkit es contenido original creado para este proyecto. Toma como referencia conceptual patrones de ECC / Everything Claude Code —investigación antes de implementar, roles especializados, verificación por capas, seguridad, control de contexto y workflows— inspeccionado en el commit `34faa39` del 18 de junio de 2026. ECC está publicado bajo licencia MIT; no se copiaron sus scripts, hooks, configuraciones ni catálogos.

## Qué se adaptó

- Roles pequeños: exploración, revisión, seguridad, datos y rendimiento.
- Separación entre análisis, plan, cambio y verificación.
- Gates de calidad y evidencia antes de afirmar resultados.
- Investigación local/primaria antes de crear dependencias o código.
- Gestión deliberada del contexto y carga bajo demanda.
- Revisiones especializadas para web, backend, datos, móvil y despliegue.

## Qué contiene

- `codex/`: diez prompts/checklists solicitados para Codex.
- `agents/`, `skills/`, `commands/`: perfiles y recetas portables, no ejecutables.
- `hooks/`: puntos de control documentales; no son scripts.
- `rules/`, `security/`, `checklists/`: políticas seguras.
- `workflows/`: flujos de auditoría, reparación, testing y producción.
- `templates/`: formatos de reportes y planes.
- `docs/`: compatibilidad, procedencia y mantenimiento.

Consulta [TOOLKIT_INDEX.md](TOOLKIT_INDEX.md) para el inventario y [USAGE_GUIDE.md](USAGE_GUIDE.md) para ejemplos.

## Uso en este proyecto

1. Selecciona el prompt especializado en `codex/`.
2. Adjunta o menciona `codex/CODEX_RULES.md`.
3. Pide primero un análisis respaldado por rutas, símbolos y comandos.
4. Aprueba un plan antes de autorizar cambios funcionales.
5. Ejecuta el quality gate apropiado y guarda resultados.

Para Jurídico Radar, usa además [`../docs/AI_WORKFLOW.md`](../docs/AI_WORKFLOW.md).

## Copiar a otro proyecto

Copia la carpeta completa como `ai-dev-toolkit/`. No necesita paquetes, binarios ni configuración global. Revisa las rutas y comandos de cada prompt para adaptarlos al stack objetivo.

## Qué no hacer

- No ejecutar documentos como si fueran scripts.
- No convertir recomendaciones en cambios automáticos sin revisar el proyecto.
- No copiar tokens, `.env`, configuraciones MCP o permisos entre repositorios.
- No activar todos los roles/prompts al mismo tiempo; carga solo lo necesario.
- No asumir que un checklist equivale a una auditoría de cumplimiento formal.
- No sincronizar ciegamente versiones futuras de ECC.

## Licencia y atribución

Este toolkit no redistribuye porciones sustanciales de ECC. La referencia conceptual y la licencia observada se documentan en [docs/ECC_COMPATIBILITY_REPORT.md](docs/ECC_COMPATIBILITY_REPORT.md).

