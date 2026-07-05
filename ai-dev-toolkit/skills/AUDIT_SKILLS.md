# Capacidades cargables

Activa solo la capacidad necesaria para reducir ruido de contexto.

| Capacidad | Entrada | Salida |
| --- | --- | --- |
| Inventario estructural | Repo y objetivo | Stack, módulos, entradas, dependencias |
| Trazado de flujo | Evento origen y resultado | Cadena de llamadas y límites de confianza |
| Auditoría de producción | Release/branch | Ship/block, riesgos y evidencia faltante |
| Revisión de seguridad | Superficie sensible | Threats, severidad y mitigaciones |
| Revisión de datos | Esquema/migraciones | Integridad, índices, rollback y restore |
| Verificación | Scripts disponibles | Matriz lint/tipos/tests/build |
| Investigación | Decisión inestable | Fuentes primarias y recomendación fechada |
| Presupuesto de contexto | Agents/skills/MCP/rules | Elementos always/on-demand/descartar |

Regla común: no declarar éxito sin ejecutar la verificación pertinente y registrar su salida.

