# Baseline de seguridad

## Modelo de confianza

Clasifica datos y actores: navegador, usuario autenticado, admin, worker, base de datos, proveedor externo y contenido recuperado. Ningún campo del cliente prueba identidad, rol u organización.

## Controles mínimos

- Sesiones en cookies `HttpOnly`, `Secure`, `SameSite` cuando aplique.
- Autorización server-side por recurso y tenant.
- Deny-by-default para admin, debug, cron, backfill e ingesta.
- Validación por esquema, límites de tamaño y allowlists.
- Consultas parametrizadas y salida HTML segura.
- Rate limit distribuido para operaciones costosas.
- Errores genéricos al cliente; detalle redactado en logs.
- Secretos en gestor de secretos, con rotación y alcance mínimo.
- CSP y headers de seguridad adaptados al frontend.
- Dependencias fijadas con lockfile y revisión de advisories.

## IA y RAG

- Tratar documentos recuperados como datos, nunca instrucciones privilegiadas.
- Separar prompt del sistema, evidencia y entrada del usuario.
- No permitir que un modelo autorice operaciones.
- Citar evidencia y expresar ausencia/incertidumbre.
- Aplicar límites de costo, timeout, tamaño y concurrencia.

## Respuesta a un secreto expuesto

1. Revocar/rotar.
2. Bloquear la superficie de exposición.
3. Revisar logs e historial.
4. Añadir prueba de regresión.
5. Documentar alcance sin volver a imprimir el secreto.

