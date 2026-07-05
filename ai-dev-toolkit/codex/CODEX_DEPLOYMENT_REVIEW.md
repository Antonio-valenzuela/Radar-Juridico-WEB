# Prompt y checklist: despliegue

```text
Evalúa si <ARTEFACTO/BRANCH> puede desplegarse en <ENTORNO>. No publiques, migres ni cambies infraestructura. Inspecciona build, CI/CD, imagen, variables, datos, workers y operación.

Entrega una decisión SHIP, SHIP CON CAVEATS o BLOCK. Lista bloqueadores, evidencia comprobada, evidencia faltante, rollback y comandos exactos de verificación.
```

- [ ] Runtime y lockfile fijados; build reproducible
- [ ] CI verde en lint, tipos, tests, build y seguridad
- [ ] Artefacto mínimo, inmutable y no root
- [ ] Variables validadas; secretos gestionados fuera del repo
- [ ] Migración, backup, restore y compatibilidad de workers
- [ ] Health/readiness y dependencias comprobadas
- [ ] Logs, métricas, trazas, alertas y ownership
- [ ] Rate limits, capacidad y costos
- [ ] DNS/TLS/CORS/CSP/cookies correctos
- [ ] Rollout, feature flags y rollback ensayado
- [ ] Runbook e incident response

