# Plan de endurecimiento del Boletín Judicial

## Decisiones de esquema

- `Matter` es el expediente jurídico real: contiene número, órgano, partes, actuaciones, plazos y alertas, y es el recurso usado por `/api/cases/[id]`.
- `CaseFile` es un archivo adjunto de `Matter`; vincular la vigilancia a ese modelo rompería la semántica y obligaría a elegir un documento arbitrario. Se conservan por tanto las relaciones de boletín con `Matter` y se documenta la discrepancia con la especificación nominal.
- La migración existente se ampliará sólo de forma aditiva. No se borran ni renombran tablas o columnas.

## Diseño de fuente Jalisco

- Los catálogos y rutas sólo se aceptan cuando fueron observados en la aplicación oficial.
- La página oficial carga reCAPTCHA antes de ejecutar la búsqueda. La automatización en vivo permanece desactivada por defecto y debe devolver `AUTH_REQUIRED`/`MANUAL_REVIEW`; no se interpreta como ausencia de publicación.
- Los parsers se prueban con fixtures sanitizados. La importación manual de PDF, texto o URL HTTPS pública es el respaldo operativo.

## Orden de implementación

1. Separar estado técnico de consulta y estado de publicación; añadir contrato común, validación Zod y evidencia sanitizada.
2. Hacer transaccional e idempotente el guardado de publicación, actuación, alerta, notificación y auditoría.
3. Añadir procesamiento agrupado por proveedor/materia/partido/juzgado/fecha y conectar la cola `bulletins` al proceso `ingestWorker` con scheduler único y apagado ordenado.
4. Completar APIs paginadas (`check`, `PATCH watch`, publicaciones y detalle) y enriquecer la pestaña del expediente.
5. Implementar importación manual con vista previa, límites, extracción PDF moderna y protección SSRF.
6. Actualizar variables, Docker Compose y documentación; validar con fixtures, Prisma, TypeScript, lint, build y auditoría.

## Restricciones

- Sin commit, push, merge, PR, despliegue ni cambios en Render.
- `BULLETIN_MONITOR_ENABLED=false` por defecto hasta una validación jurídica/técnica explícita del acceso automatizado.
- Ninguna falla de red, CAPTCHA, autenticación o parser se convierte en “sin publicación”.
