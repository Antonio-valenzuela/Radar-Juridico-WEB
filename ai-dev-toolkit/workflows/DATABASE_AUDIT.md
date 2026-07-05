# Workflow: auditoría de base de datos

1. Inventariar motor, versión, extensiones, ORM y esquema efectivo.
2. Revisar PK/FK, nulabilidad, uniques, checks/enums y cascadas.
3. Mapear consultas calientes y confirmar índices con planes reales.
4. Detectar N+1, lecturas sin límite, locks y transacciones largas.
5. Revisar idempotencia de jobs/webhooks y carreras de upsert.
6. Validar cada migración: forward, datos existentes, lock, duración y recovery.
7. Probar backup y restore en entorno no productivo.
8. Verificar aislamiento tenant, privilegios mínimos, cifrado y auditoría.
9. Documentar retención, eliminación, PII y residencia de datos.

**No ejecutar** migraciones destructivas, `db push`, seeds o resets sin entorno y aprobación explícitos.

