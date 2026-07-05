# Reporte de compatibilidad ECC → Codex

## Fuente revisada

- Repositorio: `https://github.com/affaan-m/ECC.git`
- Commit: `34faa39bd3cd496a0aece0245f2b7e38b7923abc`
- Fecha del commit: 18 de junio de 2026
- Licencia observada: MIT, copyright Affaan Mustafa (2026)
- Método: clon superficial en `.tmp/ecc-source` e inspección estática. No se ejecutó ni instaló contenido.

ECC ya declara soporte para Codex, además de Claude Code, Cursor, OpenCode y otros harnesses. Su tamaño —3,251 archivos en el checkout revisado— confirma que copiarlo completo sería desproporcionado para este proyecto.

## Compatible conceptualmente con Codex

| Patrón ECC | Adaptación en este toolkit |
| --- | --- |
| `AGENTS.md` como contrato | `codex/CODEX_RULES.md` y prompts explícitos |
| Roles explorer/reviewer/researcher | `agents/AGENT_ROLES.md` sin configuración obligatoria |
| Security review | Baseline y prompt orientados a trust boundaries |
| Verification loop | `workflows/QUALITY_GATE.md` con evidencia y exit codes |
| Production audit | Decisión SHIP/BLOCK y evidencia faltante |
| Search/research first | `workflows/RESEARCH_FIRST.md` sin instalar por defecto |
| Context budget | Carga selectiva de archivos, no catálogo global |
| Code review severities | Hallazgos crítica/alta/media/baja con prueba de cierre |

## Principalmente específico de Claude Code

- Hooks `PreToolUse`, `PostToolUse`, `Stop`, compactación y memoria automática.
- Slash commands y shims históricos.
- Settings/marketplace/plugin manifests de Claude.
- Variables y consejos de modelos/contexto propios de Claude.
- Flujos que asumen herramientas o eventos de hook no presentes de forma equivalente en Codex.

ECC señala esta misma limitación: Codex no ofrece paridad de hooks y compensa mediante instrucciones, sandbox y aprobaciones. Por eso este toolkit convierte hooks en checkpoints manuales.

## Adaptado

- Agentes → perfiles de responsabilidad portables.
- Skills → documentos pequeños por capacidad.
- Commands → recetas conversacionales sin slash commands.
- Hooks → gates manuales no ejecutables.
- Rules → contrato de seguridad para Codex.
- Memoria/contexto → documentación bajo demanda; sin persistencia silenciosa.
- Security/verification → checklists basados en evidencia local.

## Descartado y motivo

| Categoría | Motivo |
| --- | --- |
| `install.sh`, `install.ps1`, scripts y package lifecycle | Ejecución externa y cambios fuera de alcance |
| `.codex/config.toml` y MCP configs | Podrían sobrescribir preferencias, activar red o requerir credenciales |
| Hooks y plugins ejecutables | Incompatibilidad/paridad parcial y riesgo supply-chain |
| ECC2/control plane/dashboard/state store | Complejidad operativa sin necesidad para prompts portables |
| Memoria/continuous learning automática | Privacidad, contaminación de contexto y estado oculto |
| Multiagent/tmux/PM2 | No necesario; coordinación depende del entorno y autorización |
| Skills de media, negocio, mercado y stacks ajenos | Irrelevantes para el objetivo de auditoría general |
| Catálogos completos de 200+ skills | Bloat de contexto y mantenimiento |
| Integraciones pagadas o externas | Costo, privacidad y credenciales |

## Riesgos de copiar configuraciones externas

- Scripts de instalación pueden escribir fuera del repo o cambiar configuración global.
- Hooks pueden ejecutar comandos en cada edición/prompt sin visibilidad suficiente.
- MCPs amplían superficie de red, herramientas y exposición de contexto.
- Reglas genéricas pueden contradecir el stack o políticas locales.
- Configuraciones pueden contener rutas personales, permisos excesivos o referencias obsoletas.
- Cargar catálogos completos reduce contexto útil y puede degradar decisiones.

## Mantenimiento recomendado

1. Revisar ECC manualmente por release, no sincronizar automáticamente.
2. Comparar ideas, no archivos; conservar el toolkit como fuente propia.
3. Actualizar solo un workflow cuando exista una necesidad comprobada.
4. Registrar commit ECC, fecha, licencia y decisión en `CHANGELOG.md`.
5. Revalidar instrucciones contra la versión actual de Codex y el stack objetivo.
6. Mantener MCPs, secrets y permisos fuera del toolkit portable.

## Archivos que deben revisarse manualmente antes de reutilizar

- `codex/CODEX_RULES.md`: políticas del proyecto destino.
- `codex/CODEX_DEPLOYMENT_REVIEW.md`: plataforma y runtime.
- `workflows/DATABASE_AUDIT.md`: motor/ORM y comandos.
- `workflows/MOBILE_AUDIT.md`: plataforma y requisitos de tienda vigentes.
- `security/SECURITY_BASELINE.md`: modelo de identidad y regulación aplicable.
- Cualquier ejemplo de comando antes de apuntarlo a un entorno con datos reales.

## Evitar dependencia excesiva

El toolkit no requiere ECC instalado. Las ideas adoptadas son principios generales y los documentos funcionan por sí solos. Si ECC desaparece o cambia de formato, no afecta su uso; únicamente se perdería una fuente de inspiración para futuras revisiones.

