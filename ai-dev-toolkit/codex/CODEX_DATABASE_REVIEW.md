# Prompt y checklist: base de datos

```text
Audita la base de datos de <PROYECTO> sin ejecutar migraciones ni tocar datos. Revisa esquema efectivo, migraciones, queries calientes, transacciones, jobs y modelo tenant.

Entrega riesgos de integridad/pérdida/rendimiento con evidencia; distingue problemas del esquema, del ORM y de operación. Para cada migración riesgosa, propone estrategia expand/contract, backup, validación y recovery.
```

- [ ] PK/FK, nullability, uniques, checks/enums y cascadas
- [ ] Índices alineados a filtros/orden/join y planes reales
- [ ] Paginación y ausencia de queries sin límite
- [ ] Transacciones, locks, carreras e idempotencia
- [ ] Migraciones reproducibles y compatibles hacia adelante
- [ ] Seed/backfill seguros y reanudables
- [ ] Backup y restore probado; RPO/RTO definidos
- [ ] Privilegios mínimos, cifrado y aislamiento tenant
- [ ] Retención, PII, auditoría y eliminación
- [ ] Pooling, timeouts y capacidad

