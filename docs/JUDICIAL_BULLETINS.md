# Monitoreo de Boletines Judiciales

## Arquitectura

En este repositorio, `Matter` es el expediente raíz y `CaseFile` es un archivo adjunto. El módulo se vincula a `Matter` para conservar el aislamiento por organización y no asociar una vigilancia a un documento arbitrario.

```text
Matter (expediente)
  ├─ CaseBulletinWatch
  ├─ BulletinCheckRun
  ├─ MatterBulletinEntry ─ JudicialBulletinEntry (evidencia canónica)
  │                       └ CaseActuation
  └─ CaseAlert / Notification / AuditLog
```

`JudicialBulletinEntry` deduplica la evidencia canónica. `MatterBulletinEntry` permite que la misma publicación se relacione con más de un expediente u organización sin compartir revisión, notas o actuación. La creación de asociación, actuación, alerta, notificación y auditoría se ejecuta en una transacción Prisma y cada efecto usa una clave idempotente estable.

## Estados

Los estados técnicos y jurídicos se guardan por separado:

- Consulta: `SUCCESS`, `SOURCE_UNAVAILABLE`, `SOURCE_CHANGED`, `TIMEOUT`, `RATE_LIMITED`, `AUTH_REQUIRED`, `MANUAL_REVIEW`, `PROVIDER_ERROR`, `INVALID_QUERY`, `UNSUPPORTED`.
- Publicación: `NEW_PUBLICATIONS`, `HAS_PREVIOUS_PUBLICATIONS`, `NO_PUBLICATION_FOUND_AS_OF`, `CASE_NOT_CONFIGURED`, `INVALID_CASE_CONFIGURATION`, `UNKNOWN`.

Una falla técnica siempre produce `UNKNOWN`; nunca produce `NO_PUBLICATION_FOUND_AS_OF`.

## API

- `GET /api/legal/cases/[id]/bulletin`
- `POST /api/legal/cases/[id]/bulletin/check`
- `POST|PATCH|DELETE /api/legal/cases/[id]/bulletin/watch`
- `GET /api/legal/cases/[id]/bulletin/history`
- `GET /api/legal/cases/[id]/bulletin/publications`
- `GET /api/legal/cases/[id]/bulletin/publications/[publicationId]`
- `POST /api/legal/cases/[id]/bulletin/entry`
- `POST /api/legal/bulletins/import`
- `POST /api/admin/bulletins/run`
- `GET /api/admin/bulletins/status`

Las operaciones se protegen con el esquema provisional `ADMIN_TOKEN`/`x-admin-token`. No se implementó login individual.

## Worker y procesamiento por lotes

La cola `bulletins` se consume dentro de `worker/ingestWorker.ts`, que ya es el comando del worker en Docker. Los watches se agrupan por proveedor, fuente, materia, partido, juzgado y fecha; una respuesta se indexa por número de expediente y se reutiliza para todo el grupo.

El scheduler BullMQ usa un identificador estable. Al deshabilitar el monitor se retira la programación repetible. Los errores se propagan a BullMQ para activar reintentos y backoff.

El valor seguro por defecto es:

```env
BULLETIN_MONITOR_ENABLED=false
```

No debe habilitarse para Jalisco hasta contar con una autorización/validación explícita del acceso automatizado al contenido protegido por reCAPTCHA.

## Importación manual

`POST /api/legal/bulletins/import` acepta:

- JSON con texto pegado.
- JSON con una URL HTTPS pública.
- `multipart/form-data` con PDF o texto plano.

Primero se usa `mode=preview`; no se escribe nada. Después de revisar coincidencias se envía `mode=confirm`. La confirmación reutiliza el mismo servicio transaccional que una fuente oficial y registra origen `MANUAL_TEXT`, `MANUAL_URL` o `MANUAL_PDF`.

La descarga por URL aplica validación SSRF, DNS/redirect seguro, timeout, MIME y tamaño. PDF usa `PDFParse` de `pdf-parse` 2.4.5 y valida la firma `%PDF-`. No se usa OCR.

## Evidencia

Cada corrida conserva URL, parámetros no sensibles, fecha, HTTP, content-type, hash, adaptador/versión, duración, estados, advertencias y un snapshot reducido. Se redactan tokens, cookies, autorización, CSRF, contraseñas, certificados, FIREL y firmas.

## Advertencia jurídica

El monitor es una ayuda operativa. Los resultados, fechas y plazos requieren validación profesional contra la fuente oficial. `NOT_FOUND_AS_OF` sólo describe el corte consultado y no certifica que nunca haya existido una publicación.
