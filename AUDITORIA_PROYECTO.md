# Auditoría técnica de Jurídico Radar

**Fecha:** 20 de junio de 2026  
**Alcance:** revisión estática, estructural y de verificaciones locales; no se modificó código funcional.  
**Estado recomendado:** **bloqueado para producción (32/100)** hasta corregir autenticación, rutas administrativas expuestas y el build.

## Resumen ejecutivo

Jurídico Radar tiene una base técnica valiosa: separación razonable por dominios, PostgreSQL con `pgvector`, migraciones versionadas, colas BullMQ, proveedores de IA con fallback local, pruebas automatizadas y CI. Sin embargo, hoy no debe exponerse a Internet.

Los bloqueadores principales son de seguridad, no de estilo:

1. `GET /api/debug/token` devuelve el valor esperado de `ADMIN_TOKEN`; en producción expondría el secreto administrativo activo.
2. Varias rutas administrativas o costosas no aplican autorización: limpieza de datos, backfills, reclasificación, ingesta, programación de jobs, ejecución manual y notificaciones de prueba.
3. La multitenencia no autentica usuarios. Un cliente puede declarar cualquier email y `orgSlug`; `resolveTenant()` crea usuario, organización y membresía con rol `owner` por defecto.
4. El proyecto no compila: TypeScript no encuentra `totalExternalResults` en `app/rag/page.tsx:411`.
5. Lint y pruebas también fallan, por lo que CI no puede estar verde con el estado revisado.

## Evidencia y método

- CodeGraph: 191 archivos indexados, 1,260 símbolos y 2,370 relaciones.
- Inspección de `package.json`, Prisma, CI, Docker, configuración Next, rutas críticas y documentación.
- `npm run typecheck`: falló con 1 error.
- `npx eslint . --ignore-pattern ".tmp/**"`: falló con 8 errores y 157 advertencias.
- `npm test`: falló una prueba, `/api/legal/radar no devuelve análisis IA fingido cuando no hay documentos`.
- `npm run build`: compiló el bundle, pero falló durante TypeScript por el mismo símbolo ausente.
- No se leyó ni modificó `.env`; solo se revisó `.env.example`.

## Stack detectado

| Área | Tecnología |
| --- | --- |
| Aplicación web/API | Next.js 16.1.4, App Router, React 19.2.3, TypeScript 5 |
| Persistencia | PostgreSQL 16, Prisma 6.19.2, extensión `pgvector` |
| Procesamiento asíncrono | BullMQ 5.67.1, Redis 7, workers TypeScript |
| IA | Router propio; Gemini, Groq, OpenRouter y fallback local |
| Ingesta | `fetch`, Cheerio, fuentes DOF/SIDOF/SCJN/SJF/Diputados |
| Documentos | `pdf-parse`, chunking, embeddings y RAG |
| Visualización | Recharts 3.8.1, CSS propio/Tailwind PostCSS disponible |
| Pruebas | Node Test Runner con archivos `.mjs` |
| Entrega | Docker Compose y GitHub Actions |

## Estructura

- `app/`: UI y aproximadamente 50 handlers API.
- `lib/`: dominio, ingesta, IA, búsqueda, RAG, notificaciones, seguridad y observabilidad.
- `worker/`: consumidores BullMQ para ingesta, alertas, digest y embeddings.
- `prisma/`: esquema, seed y 13 migraciones versionadas.
- `tests/`: pruebas unitarias y algunas verificaciones estructurales/integración simulada.
- `scripts/`: backfill manual.
- `src/lib/src/app/api/items/`: árbol duplicado/anómalo que parece residuo de una copia.
- `.github/workflows/ci.yml`: lint, tipos, pruebas y build con PostgreSQL/Redis.
- `docker-compose.yml`: entorno de desarrollo con frontend, backend, worker, PostgreSQL y Redis.

## Scripts disponibles

`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`, `postinstall`, `worker`, `backfill`, `docker:up`, `docker:down`, `docker:logs` y `docker:reset`.

`docker:reset` elimina el volumen de base de datos. Está correctamente explícito como reset, pero debe considerarse destructivo y nunca automatizarse en producción.

## Variables de entorno documentadas

Grupos requeridos o condicionales en `.env.example`:

- Runtime: `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_DIST_DIR`.
- Datos: `DATABASE_URL`, `REDIS_URL`.
- Seguridad: `ADMIN_TOKEN`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`.
- Ingesta: `INGEST_DEFAULT_DAYS`, `INGEST_MAX_LIMIT`, `SIDOF_BASE_URL`, `SJF_START_ID`.
- Notificaciones: `NOTIFY_TEST_EMAIL`, `RESEND_API_KEY`, `FROM_EMAIL`, `WEBHOOK_URL`, Telegram y SMTP.
- IA/búsqueda: `LLM_PROVIDER`, claves/modelos Gemini, OpenRouter y Groq, `TAVILY_API_KEY`, flags de contexto/visión y timeouts.

Hay deriva de configuración: JWT y refresh secrets están documentados, pero no se encontró un flujo real de sesión/JWT. El README pide Node 20+, mientras CI y Docker fijan Node 22.

## Persistencia y modelo de datos

El esquema cubre items legales, versiones y diffs de normas, documentos/chunks/embeddings, organizaciones, roles, watchlists, reglas, notificaciones, jobs, DLQ, auditoría y digest semanal. Hay índices útiles en fechas, fuentes, estados y claves tenant.

Fortalezas:

- Migraciones incrementales y `migration_lock.toml`.
- Relaciones con políticas `Cascade`/`SetNull` razonables.
- Unicidad para deduplicación e idempotencia parcial.
- Registro de jobs fallidos y auditoría ya modelados.

Riesgos:

- La existencia de `AuditLog` no implica uso consistente; falta evidencia de escritura transversal.
- No hay estrategia documentada de backup, restore, retención ni rollback de migraciones.
- Estados y roles son `String`, lo que permite valores inválidos y deriva semántica.
- `Embedding` fija `vector(1536)`; debe validarse contra todos los modelos configurables.
- La lógica multitenant se implementa en aplicación, sin una barrera adicional de base de datos.

## Hallazgos críticos

### C-01 — Exposición directa del secreto administrativo

**Evidencia:** `app/api/debug/token/route.ts` responde `{ expected: getExpectedAdminToken() }` sin guardia de entorno ni autenticación. En producción, `getExpectedAdminToken()` retorna `ADMIN_TOKEN`.

**Impacto:** compromiso total de las rutas protegidas por ese token.

**Recomendación:** eliminar la ruta o hacer que nunca devuelva secretos; rotar el token si la ruta estuvo desplegada; añadir prueba que exija 404 en producción.

### C-02 — Operaciones administrativas públicas

**Evidencia:** carecen de `requireAdmin` al menos:

- `POST /api/admin/cleanup` (borra registros).
- `GET /api/admin/backfill-summaries` y `GET /api/admin/reclassify` (mutan datos mediante GET).
- `POST /api/schedule` y `POST /api/run-now` (crean jobs).
- `GET /api/ingest/all` y `GET /api/ingest/source` (escriben y consumen recursos).
- `POST /api/notify/test` (envía comunicaciones a un email suministrado).

`/api/admin/refresh` compara el header manualmente, en lugar de la política común.

**Impacto:** borrado/manipulación de datos, abuso de IA y terceros, spam, saturación de colas y costos operativos.

**Recomendación:** política deny-by-default para `/api/admin`, jobs, ingesta y notificaciones; usar POST para mutaciones; permisos por rol; límites e idempotencia.

### C-03 — Suplantación de identidad y ruptura de aislamiento tenant

**Evidencia:** `resolveTenant()` confía en `email` y `orgSlug` del body, crea recursos faltantes y asigna rol `owner`. `/api/watchlist` usa directamente ese contexto para listar y mutar preferencias.

**Impacto:** cualquier cliente puede suplantar usuarios, unirse o crear organizaciones y modificar datos asociados.

**Recomendación:** introducir autenticación de sesión real; derivar `userId` del principal autenticado; aceptar `orgId` solo entre membresías verificadas; impedir autocreación de `owner` en rutas ordinarias.

## Hallazgos altos

### A-01 — Build, tipos, lint y tests no están verdes

- TypeScript/build: `app/rag/page.tsx:411` referencia `totalExternalResults` inexistente.
- ESLint propio: 8 errores `react/no-unescaped-entities` y 157 advertencias, con concentración de `any` y código no usado.
- Tests: falla la expectativa de no fabricar análisis IA sin documentos en `/api/legal/radar`.

**Impacto:** CI bloqueada y riesgo funcional en una respuesta legal sensible.

### A-02 — Rate limiting incompleto y no distribuido

`checkRateLimit` usa un `Map` en memoria y solo tiene cuatro consumidores. Se reinicia por proceso, no coordina réplicas y permite evasión horizontal.

**Recomendación:** Redis, clave por usuario+IP+operación, límites específicos para IA, búsqueda, ingesta y notificaciones.

### A-03 — Errores internos expuestos al cliente

Múltiples handlers serializan `error.message`, incluidos health, scheduler, búsquedas, backfills y proveedores externos.

**Impacto:** filtración de topología, detalles de proveedor y datos operativos.

### A-04 — Docker Compose es de desarrollo, no de producción

Los servicios montan el repositorio completo, ejecutan `npm install` al arrancar, usan `next dev`, exponen puertos de datos y contienen credenciales/default token previsibles. Frontend y backend arrancan el mismo monolito Next en puertos distintos.

**Recomendación:** Dockerfile multistage, `npm ci`, usuario no root, artefacto inmutable, secretos externos, red privada y un solo servicio web salvo separación real de responsabilidades.

### A-05 — Endpoints costosos sin límites robustos

Parámetros como `days` y `limit` no siempre se acotan; ingesta y procesamiento se ejecutan dentro de requests con `maxDuration` alto. Esto facilita agotamiento de CPU, memoria, DB y cuotas de terceros.

## Hallazgos medios

- **M-01:** `src/lib/src/app/api/items/` duplica cliente Prisma y route; parece código residual y confunde resolución/mantenimiento.
- **M-02:** coexisten `lib/ingest/` y `lib/ingestors/` con fuentes solapadas; se requiere mapa de responsabilidad y eliminación gradual de duplicados.
- **M-03:** `app/api/legal/radar/route.ts` supera ampliamente una responsabilidad; mezcla búsqueda, expansión, diffs, fuentes externas y respuesta.
- **M-04:** `hybridSearch` usa `contains` y ranking heurístico, aunque el README afirma BM25; la documentación sobrepromete la implementación.
- **M-05:** filtros semánticos se aplican después de recuperar los primeros chunks; puede devolver menos resultados relevantes y sesgar ranking.
- **M-06:** ingesta por fuentes/items y generación de embeddings tienen tramos secuenciales; seguros para cuotas, pero limitantes sin batching/concurrencia acotada.
- **M-07:** el conteo diario de notificaciones usa zona horaria local del proceso, mientras el dominio opera en CDMX.
- **M-08:** observabilidad propia existe, pero abundan `console.error` y mensajes heterogéneos; faltan correlación, redacción y métricas de SLO.
- **M-09:** no se encontraron headers de seguridad (CSP, frame ancestors, nosniff, referrer policy) en `next.config.ts`.
- **M-10:** CI levanta PostgreSQL y Redis, pero no aplica `prisma migrate deploy`; las pruebas etiquetadas como integración parecen cubrir en buena parte contratos/estructura.
- **M-11:** `.tmp/ecc-source` fue alcanzado por el lint global; cualquier herramienta temporal bajo el repo puede contaminar verificaciones si no se excluye explícitamente.

## Hallazgos menores y deuda técnica

- Uso extendido de `any`, imports/variables sin uso y estilos inline repetidos.
- Algunos endpoints mutan estado con GET, rompiendo semántica HTTP y facilitando ejecución accidental/caché.
- Validación fragmentada y manual; no hay esquema uniforme por ruta.
- Límites y estados usan constantes dispersas.
- README, Docker y CI no coinciden totalmente en versión Node y comandos de base de datos.
- Falta una matriz visible de rutas: pública, autenticada, admin, interna/cron.

## Código muerto, duplicado o innecesario

| Candidato | Motivo | Acción segura |
| --- | --- | --- |
| `src/lib/src/app/api/items/` | Árbol anómalo y duplicación de Prisma/route | Confirmar imports; retirar en PR separado |
| `lib/legal-radar.ts` | Lint marca imports sin uso | Verificar callers y simplificar |
| Imports/estado no usados en `app/rag/page.tsx` | Señal de refactor incompleto asociado al build roto | Reparar junto al contrato de resultados externos |
| `.next`, `.next-backend`, `tsconfig.tsbuildinfo` | Artefactos locales | Mantener ignorados; nunca empaquetar |
| `.tmp/ecc-source` | Fuente temporal externa | No versionar; eliminar manualmente al terminar de consultar si se desea |

No se recomienda borrar nada hasta confirmar callers, imports y necesidades de recuperación.

## Rendimiento y escalabilidad

Lo positivo:

- Jobs con reintentos exponenciales, límites de retención y DLQ modelada.
- Índices compuestos útiles y deduplicación por URL/hash/fuente.
- Búsqueda vectorial parametrizada mediante tagged template de Prisma.
- Límites parciales en notificaciones y resultados.

Prioridades:

1. Sacar ingestas/backfills de requests y devolver `202 + jobId`.
2. Añadir concurrencia acotada y batch transactions para chunks/embeddings.
3. Mover rate limiting y locks/idempotency a Redis.
4. Paginar todas las colecciones y establecer máximos server-side.
5. Medir latencia, tamaño de cola, fallos por fuente, costo IA y tiempo de DB.
6. Implementar búsqueda textual real de PostgreSQL si se mantiene la promesa de BM25/full-text.

## Riesgos de despliegue y publicación

### Web/servidor

**Bloqueado:** seguridad crítica, build fallido, CI fallida, Compose no productivo, ausencia de rollback/backup documentado y operaciones internas públicas.

### Play Store/App Store

No aplica directamente: no se detectó proyecto móvil nativo, Flutter o React Native. Si se empaqueta como PWA/WebView, deberán revisarse privacidad, permisos, eliminación de cuenta, política de datos y autenticación; hoy la falta de identidad real lo impediría.

## Qué está bien

- Dominio legal expresado con modelos claros de norma, versión, diff, documento y evidencia.
- Arquitectura preparada para procesamiento asíncrono y proveedores IA intercambiables.
- Fallback local que evita exigir claves para desarrollo/pruebas.
- Migraciones versionadas y un esquema con buenos índices iniciales.
- Tests para validación, proveedores, búsqueda, RAG, auth parcial y flujos principales.
- CI incluye lint, tipos, pruebas y build.
- Uso de fuentes oficiales y sanitización de dominios en búsqueda federada.

## Plan de remediación recomendado

### Fase 0 — Contención inmediata

1. Retirar `/api/debug/token` y rotar `ADMIN_TOKEN` si existió despliegue accesible.
2. Bloquear externamente `/api/admin`, `/api/debug`, `/api/ingest`, `/api/schedule`, `/api/run-now` y `/api/notify/test`.
3. No desplegar el Compose actual en un host público.

### Fase 1 — Identidad y autorización

1. Implementar sesiones seguras y un principal server-side.
2. Crear middleware/política central de rutas y roles.
3. Rehacer `resolveTenant` para comprobar membresía, no crear ownership implícito.
4. Añadir pruebas negativas por cada ruta sensible.

### Fase 2 — Recuperar el quality gate

1. Reparar el contrato de `externalResults/totalExternalResults`.
2. Corregir la prueba de no-alucinación legal antes de cambiar expectativas.
3. Resolver los 8 errores lint y reducir `any` por dominios.
4. Asegurar lint, tipos, pruebas y build verdes en CI.

### Fase 3 — Producción operable

1. Imagen productiva inmutable y migraciones controladas.
2. Backups, restore probado, rollback y runbooks.
3. Rate limits Redis, jobs idempotentes y observabilidad con redacción.
4. E2E de búsqueda, alerta, ingesta y consulta RAG.

### Fase 4 — Escala y limpieza

1. Consolidar rutas/fuentes duplicadas.
2. Dividir el radar legal en servicios de dominio.
3. Optimizar búsquedas y embeddings con métricas reales.

## Comandos de verificación posteriores a una reparación

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
npx prisma migrate status
```

Los dos últimos requieren una configuración de base de datos apropiada; `migrate status` no debe apuntar accidentalmente a producción desde una estación local.

