# Prompt y checklist: seguridad

```text
Realiza una revisión de seguridad de <ALCANCE> sin modificar código. Construye primero un modelo de confianza y una matriz de rutas/acciones: pública, autenticada, admin e interna.

Busca identidad suplantable, autorización faltante por recurso/tenant, secretos, debug, validación, inyección, XSS/CSRF/CORS, SSRF, path traversal, uploads, errores, logging, rate limits, abuso de costos, supply chain y prompt injection/RAG.

Para cada hallazgo: severidad, evidencia exacta, precondición, escenario de abuso, impacto, mitigación y prueba negativa. No llames “vulnerabilidad” a una hipótesis sin indicar confianza.
```

Checklist:

- [ ] Principal derivado server-side; nunca desde email/rol del body
- [ ] Autorización por objeto y tenant
- [ ] Rutas debug/admin/cron protegidas o ausentes
- [ ] Secretos no retornados, logueados ni incluidos en cliente
- [ ] Entradas con esquema, tamaños y allowlists
- [ ] Rate limits distribuidos en superficies costosas
- [ ] Errores genéricos y logs redactados
- [ ] Headers, cookies y políticas de navegador seguras
- [ ] Dependencias fijadas y acciones CI con versión/hash
- [ ] IA sin autoridad y evidencia no confiable aislada

