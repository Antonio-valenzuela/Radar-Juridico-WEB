# Checklist maestro

## Producto y arquitectura

- [ ] Propósito, usuarios y caminos críticos identificados
- [ ] Puntos de entrada y dependencias externas mapeados
- [ ] Límites de módulo claros; duplicación registrada
- [ ] Decisiones y deuda documentadas

## Seguridad

- [ ] Identidad y autorización server-side
- [ ] Secretos fuera del repositorio y logs
- [ ] Validación, rate limit y errores seguros
- [ ] Rutas internas/admin no públicas
- [ ] Dependencias y supply chain revisadas

## Datos

- [ ] Constraints, índices y relaciones coherentes
- [ ] Migraciones forward y recuperación probadas
- [ ] Idempotencia y concurrencia consideradas
- [ ] Backup, restore, retención y tenancy definidos

## Calidad

- [ ] Lint, tipos, tests y build verdes
- [ ] Pruebas negativas y de regresión
- [ ] E2E de caminos críticos
- [ ] Sin código debug o fixtures públicos

## Operaciones

- [ ] Variables validadas al inicio
- [ ] Health/readiness significativos
- [ ] Logs redactados y correlacionados
- [ ] Deploy, rollback e incidentes documentados

