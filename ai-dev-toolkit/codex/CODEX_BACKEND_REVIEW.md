# Prompt y checklist: backend

```text
Audita el backend/API de <ALCANCE> sin modificarlo. Mapea request → auth → validación → servicio → datos/cola/proveedor → respuesta. Identifica límites de confianza y efectos secundarios.

Entrega matriz de endpoints, hallazgos por severidad y pruebas negativas faltantes. Señala mutaciones con GET, operaciones no idempotentes, errores filtrados y trabajo costoso dentro de requests.
```

- [ ] Matriz pública/autenticada/admin/interna
- [ ] Authn y authz por recurso/tenant
- [ ] Validación común y límites server-side
- [ ] Semántica HTTP, status codes y versionado
- [ ] Servicios separados de handlers y dependencias inyectables
- [ ] Transacciones e idempotency keys para efectos
- [ ] Timeouts, retries con jitter, circuit breaker y cancelación
- [ ] Rate limits y cuotas por usuario/organización
- [ ] Errores seguros, correlation IDs y logs estructurados
- [ ] Jobs asíncronos para tareas largas
- [ ] Contract/integration/E2E y health/readiness

