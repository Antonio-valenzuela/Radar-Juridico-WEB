# Diagnóstico de ingesta SIDOF/DOF/SCJN — Fase 0

Fecha de ejecución: 2026-07-31 (zona `America/Mexico_City`). El nombre del archivo usa la ventana de trabajo de agosto de 2026.

## Alcance y resguardo

Se revisaron migraciones, configuración de runtime, disponibilidad local de PostgreSQL/Redis, el flujo de `runIngest` y respuestas HTTP de SIDOF, DOF y SCJN. No se modificó lógica de negocio, esquema ni logging. Los valores de conexión se muestran siempre redactados; no se copiaron contraseñas ni tokens.

El repositorio de trabajo real es `C:\Users\yahir\juridico-radar` (el directorio `Desktop\juridico-radar` no contiene el checkout Git).

## Bloqueo de infraestructura local

Resultado reproducible en esta máquina:

| Componente | Evidencia | Resultado |
| --- | --- | --- |
| Docker Desktop | `docker ps --format ...` | Falló: no se pudo conectar al named pipe `dockerDesktopLinuxEngine`; el daemon no está disponible. |
| PostgreSQL local | `netstat -ano -p tcp \| Select-String ':5432'` y `Test-NetConnection 127.0.0.1 -Port 5432` | Sin listener; `TcpTestSucceeded=False`. |
| Redis local | `netstat -ano -p tcp \| Select-String ':6379'` | Sin listener. |
| Servicios Windows | `Get-Service ...` filtrando PostgreSQL/Redis | No se encontró servicio instalado/activo. |
| Prisma | `npx prisma migrate status` | Lee `localhost:5432`, pero termina en `Error: Schema engine error:`; al no haber listener no se puede consultar el estado de migraciones. |

No se ejecutó `docker compose up` ni una migración: ambos requieren que el usuario decida iniciar infraestructura y, en el caso de migraciones, escribir en la base de datos.

## Variables de entorno (redactadas)

En el proceso actual `DATABASE_URL` y `REDIS_URL` están ausentes. Los archivos locales contienen:

```text
.env
DATABASE_URL=postgresql://<redacted>@localhost:5432/juridico
REDIS_URL=redis://<redacted>@localhost:6379

.env.example
DATABASE_URL=postgresql://<redacted>@localhost:5432/juridico_local
REDIS_PASSWORD=<set>
REDIS_URL=redis://<redacted>@localhost:6379/0

.env.production
DATABASE_URL=postgresql://<redacted>@<remote-host>/<database>
REDIS_URL=rediss://<redacted>@<remote-host>:6379
```

`prisma.config.ts` carga `dotenv/config` y usa `DATABASE_URL`; el proceso de Prisma confirmó el destino local `juridico` en `localhost:5432`. No se comprobó conectividad al destino de producción ni se debe hacerlo con credenciales expuestas en una terminal.

## Migraciones y tablas requeridas

El esquema declara las tablas que el pipeline usa:

- `IngestRun` y `IngestCheckpoint` (`prisma/schema.prisma:283-302`), creadas inicialmente por `20260506000000_multi_source_ingest`.
- `OfficialSource` y `OfficialSourceFetchLog` (`prisma/schema.prisma:605-655`), creadas por `20260621043320_add_official_sources`; `20260621060000_official_source_health` agrega `adapter`, `healthUrl` y `requiresBrowser`.
- `20260728143000_add_jalisco_official_source` registra/actualiza `PERIODICO_OFICIAL_JALISCO`.

La migración más reciente del checkout es `20260728143000_add_jalisco_official_source`. Debido a que PostgreSQL no está disponible, queda **sin verificar** si todas las migraciones están aplicadas en una base real.

## Flujo `runIngest` y manejo de errores

Hallazgos estáticos (sin cambios):

1. `runIngest` (`lib/ingest/runIngest.ts:438-456`) recorre fuentes secuencialmente y delega en `runSourceIngest`.
2. Antes del `try` interno, `runSourceIngest` ejecuta `officialSource.findFirst` y `ingestRun.create` (`:164-176`). Si PostgreSQL está caído, el error ocurre antes del `catch`; no se genera un `IngestSourceRunResult` por fuente.
3. El `catch` (`:411-435`) intenta persistir el fallo con `ingestRun.update` y `officialSourceFetchLog.create/update` mediante `saveFetchLog`. Si la caída de DB es la causa original o también afecta esas escrituras, el manejo secundario puede fallar y ocultar el error inicial.
4. Una vez dentro del `try`, las fuentes se resuelven por `resolveIngestPolicy`: adaptador nativo (`SIDOF`, `DIPUTADOS`, `SCJN_SJF`, `SCJN_LEG`, `PERIODICO_OFICIAL_JALISCO`), `dof-web`, RSS, URL manual o `search_only`.
5. La lista predeterminada de prioridad 1 proviene de `lib/sources/index.ts`; `SENADO_GACETA` es prioridad 2. `DOF_WEB` no es un módulo nativo: depende de un registro `OfficialSource` cuyo policy sea `dof-web`.
6. El worker (`worker/ingestWorker.ts`) conecta BullMQ a `REDIS_URL` (por defecto `redis://localhost:6379`) y ejecuta una ingesta de prioridad 1 durante bootstrap. Con Redis/Postgres ausentes, la readiness debe quedar no disponible y el bootstrap solo registra una advertencia.

## Pruebas HTTP de fuentes oficiales

Se realizaron GET sin credenciales, con `curl.exe -L --max-time 20 -o NUL -w ...`. Fecha de consulta: `31-07-2026`.

| Endpoint | HTTP | Tiempo | Tamaño | Observación |
| --- | ---: | ---: | ---: | --- |
| `https://sidof.segob.gob.mx/apiStatus` | `000` | `20.002 s` | `0` | Timeout de curl (`exit 28`), sin bytes. |
| `https://sidof.segob.gob.mx/notas/31-07-2026` | `200` | `1.600 s` | `58755` | `content-type: text/html; charset=UTF-8`; el adaptador nativo espera JSON mediante `fetchJson`, por lo que requiere validación cuando haya DB. |
| `https://www.dof.gob.mx/index.php?fecha=31/07/2026` | `200` | `0.439 s` | `58817` | HTML accesible; compatible con el punto de entrada `dof-web` para una prueba controlada. |
| `https://sjf2.scjn.gob.mx/servicios/detalle/tesis?registro=2033000` | `403` | `0.414 s` | `48` | API rechaza la consulta desde este entorno; no equivale por sí solo a una caída total de SCJN. |
| `https://legislacion.scjn.gob.mx/buscador/paginas/buscar.aspx` | `200` | `0.770 s` | `181312` | HTML accesible; el parser de legislación aún debe probarse con persistencia disponible. |

Comandos reproducibles (no imprimen cuerpos ni secretos):

```powershell
$D = (Get-Date).ToString('dd-MM-yyyy')
$DOF = (Get-Date).ToString('dd/MM/yyyy')
curl.exe -sS -L --max-time 20 -o NUL -w 'status=%{http_code} time=%{time_total}s bytes=%{size_download}\n' "https://sidof.segob.gob.mx/apiStatus"
curl.exe -sS -L --max-time 20 -o NUL -w 'status=%{http_code} time=%{time_total}s bytes=%{size_download}\n' "https://sidof.segob.gob.mx/notas/$D"
curl.exe -sS -L --max-time 20 -o NUL -w 'status=%{http_code} time=%{time_total}s bytes=%{size_download}\n' "https://www.dof.gob.mx/index.php?fecha=$DOF"
curl.exe -sS -L --max-time 20 -o NUL -w 'status=%{http_code} time=%{time_total}s bytes=%{size_download}\n' 'https://sjf2.scjn.gob.mx/servicios/detalle/tesis?registro=2033000'
curl.exe -sS -L --max-time 20 -o NUL -w 'status=%{http_code} time=%{time_total}s bytes=%{size_download}\n' 'https://legislacion.scjn.gob.mx/buscador/paginas/buscar.aspx'
```

## Próximo paso para cerrar Fase 0

1. Iniciar Docker Desktop o proporcionar PostgreSQL/Redis equivalentes **sin pegar credenciales en el chat**.
2. Con el entorno levantado, ejecutar `npx prisma migrate status` y, si corresponde, `npx prisma migrate deploy` con autorización explícita.
3. Ejecutar `npm run env:check`, comprobar `/api/health`/readiness del worker y lanzar una prueba limitada: `POST /api/ingest/all?days=1&sources=SIDOF` con autenticación administrativa fuera del documento.
4. Repetir para `DOF_WEB` y `SCJN_SJF`, registrando `IngestRun`, `OfficialSourceFetchLog`, errores y checkpoints. La respuesta HTML de SIDOF y el `403` de SJF deben quedar confirmados con la aplicación conectada a DB antes de atribuirles una causa definitiva.

**Conclusión:** Fase 0 queda bloqueada localmente por la ausencia de Docker, PostgreSQL y Redis. Las fuentes DOF y legislación SCJN responden; SIDOF health agota timeout, SIDOF notas devuelve HTML y el endpoint SJF devuelve 403. No hay evidencia suficiente para afirmar que una ingesta completa haya corrido en este entorno.
