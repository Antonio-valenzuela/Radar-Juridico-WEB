# Workflow: auditoría de despliegue

## Artefacto

- Build reproducible con lockfile y runtime fijado.
- Imagen multistage, usuario no root y superficie mínima.
- Sin código fuente, caches, `.env` ni herramientas de desarrollo innecesarias.

## Configuración

- Variables enumeradas, validadas al inicio y separadas por entorno.
- Secretos inyectados desde plataforma/secret manager.
- Feature flags y proveedores con fallback explícito.

## Datos

- Migraciones como etapa controlada, backup previo y recovery probado.
- Compatibilidad expand/contract entre versiones.
- Jobs y workers compatibles con el nuevo esquema.

## Operación

- Readiness/liveness, observabilidad, alertas y ownership.
- Rollback de aplicación y plan para datos.
- Rollout canario/gradual cuando el riesgo lo exige.
- Runbook de incidente y criterios de abortar.

## Decisión

Entrega `SHIP`, `SHIP CON CAVEATS` o `BLOCK`, con evidencia, riesgos aceptados y siguiente acción concreta.

