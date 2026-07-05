# Workflow: quality gate

Detecta scripts reales antes de ejecutar. No uses `--fix`, no actualices snapshots y no instales paquetes sin permiso.

| Gate | Pregunta | Evidencia |
| --- | --- | --- |
| Formato/lint | ¿Viola reglas estáticas? | Comando, exit code, conteo |
| Tipos | ¿Los contratos compilan? | Primer error y total |
| Unit/integration | ¿Se conserva comportamiento? | Pasadas/fallidas/omitidas |
| Build | ¿Existe artefacto productivo? | Fase exacta del fallo |
| Migraciones | ¿Esquema válido y aplicable? | validate/status en entorno seguro |
| Seguridad | ¿Hay secretos/vulnerabilidades conocidas? | Método y alcance |
| E2E | ¿Funciona el camino crítico? | Navegador/dispositivo y resultado |

**Regla de salida:** no declarar verde si se excluyó una fase requerida; explicar por qué no se ejecutó.

