# Prompt: auditoría integral de proyecto

```text
Actúa como arquitecto y auditor técnico senior. Audita este repositorio sin modificar archivos funcionales.

Reglas: sigue ai-dev-toolkit/codex/CODEX_RULES.md; no leas secretos; usa evidencia estructural para símbolos/flujos y lectura directa para configuración; no instales nada.

Analiza:
- stack, estructura, dependencias, scripts y variables documentadas;
- puntos de entrada, arquitectura, datos, jobs y servicios externos;
- autenticación/autorización, validación, secretos, errores y rate limits;
- rendimiento, concurrencia, idempotencia y escalabilidad;
- duplicación, código muerto, configuración y documentación divergente;
- CI/CD, build, migraciones, observabilidad, backup y rollback;
- riesgos web, backend, móvil y tiendas cuando apliquen.

Ejecuta solo verificaciones no destructivas disponibles. Entrega primero una decisión production-readiness y después hallazgos crítica/alta/media/baja. Cada hallazgo debe incluir evidencia, escenario, impacto, recomendación y prueba de cierre. Separa hechos de hipótesis y enumera evidencia no disponible.

Guarda el resultado en <RUTA_REPORTE>.
```

