# Workflow: auditoría de rendimiento

## Baseline

Define flujo, volumen, p50/p95/p99, CPU, memoria, I/O, consultas, colas y costo externo.

## Inspección

- Consultas N+1, scans, índices y payloads.
- Trabajo síncrono dentro de requests.
- Concurrencia sin límite, serialización innecesaria y retries.
- Caches sin invalidación o claves tenant.
- Render, bundle, imágenes y waterfalls del frontend.

## Experimento

Formula una hipótesis medible, cambia una variable y repite con la misma carga. Incluye degradación, cold start y error paths.

## Salida

| Métrica | Antes | Después | Presupuesto | Resultado |
| --- | --- | --- | --- | --- |

No aceptar una optimización que degrade corrección, seguridad u observabilidad.

