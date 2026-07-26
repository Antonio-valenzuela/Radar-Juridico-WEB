# Diseño de preparación para producción de Jurídico Radar

## Contexto y alcance

Jurídico Radar es un monolito modular en Next.js App Router con Prisma/PostgreSQL + pgvector, Redis/BullMQ, workers de ingesta y reportes legales, y un proceso WebSocket para el dashboard. Existe un despliegue activo en Render que no forma parte de esta intervención. Los cambios deben producir artefactos portátiles que funcionen tanto como servicios Docker en Render como en un único VPS con Docker Compose, sin modificar contenido jurídico ni lógica de negocio.

El `docker-compose.yml` actual seguirá siendo la experiencia de desarrollo. La producción tendrá archivos separados y no publicará PostgreSQL ni Redis.

## Decisiones técnicas

- Unificar Node.js 22 LTS en `.nvmrc`, `package.json`, Docker y GitHub Actions. Next.js 16.2.10 requiere Node >=20.9 y el blueprint existente ya recomienda Node 22.
- Actualizar `next` y `eslint-config-next` a 16.2.10, regenerando `package-lock.json` sin upgrades mayores no relacionados.
- Construir imágenes multi-stage reproducibles. Ningún servicio instalará dependencias, compilará la app ni aplicará migraciones al arrancar.
- Mantener una sola base de código Next.js. Las imágenes web y API serán dos instancias del mismo artefacto, con comandos y puertos distintos para conservar la topología actual.
- Ejecutar workers TypeScript con `tsx` como dependencia de runtime dentro de una imagen construida previamente; no se instalarán paquetes en el arranque.
- Ejecutar migraciones mediante un servicio one-shot explícito y separado. `docker compose up` no ejecutará migraciones destructivas ni implícitas.
- Mantener compatibilidad con Render mediante targets Docker reutilizables y comandos documentados. No se añadirá ninguna acción que modifique el servicio Render activo.

## Arquitectura de contenedores

El Dockerfile tendrá etapas `base`, `dependencies`, `builder`, `web-runtime`, `worker-runtime` y `migrate`:

- `builder` genera Prisma Client y el build standalone de Next.js.
- `web-runtime` copia únicamente el standalone, estáticos y archivos públicos necesarios, y ejecuta como usuario no root.
- `worker-runtime` contiene dependencias de producción, Prisma Client y el código necesario para los workers; ejecuta como usuario no root.
- `migrate` conserva la CLI de Prisma y ejecuta exclusivamente `prisma migrate deploy` cuando el operador lo solicita.

`docker-compose.prod.yml` definirá:

- `frontend`: Next.js público en el puerto interno 3000.
- `backend`: segunda instancia Next.js/API en el puerto interno 3001.
- `worker`: ingesta y colas BullMQ.
- `worker-legal-reports`: reportes jurídicos asíncronos.
- `dashboard-ws`: WebSocket y endpoint HTTP de salud en el puerto interno 3002.
- `postgres`: PostgreSQL 16 + pgvector, sin `ports` publicados.
- `redis`: Redis 7 autenticado, sin `ports` publicados.
- `migrate`: perfil manual y one-shot.

Solo el frontend se publicará opcionalmente en loopback del host para conectarlo a Caddy/Nginx. Backend, WebSocket, PostgreSQL y Redis permanecerán en redes internas explícitas. Los volúmenes nombrados conservarán datos de PostgreSQL y Redis.

## Configuración y secretos

Se centralizará la lectura de variables en un módulo de configuración que:

- valida formato y presencia de variables obligatorias;
- falla claramente en producción ante credenciales o URLs ausentes;
- mantiene defaults seguros para variables opcionales;
- no importa secretos desde componentes cliente;
- expone únicamente variables `NEXT_PUBLIC_*` al navegador.

`.env.example` documentará todas las variables detectadas en código, Prisma, Compose, scripts y workers mediante valores ficticios. `POSTGRES_PASSWORD`, `REDIS_PASSWORD` y `ADMIN_TOKEN` serán obligatorias en producción. `DATABASE_URL` y `REDIS_URL` incluirán autenticación, pero nunca valores reales versionados.

## Salud y ciclo de vida

- `/api/health/live` comprobará que el proceso Next.js responde.
- `/api/health/ready` comprobará PostgreSQL, Redis y colas sin consultar fuentes jurídicas externas.
- `/api/health` conservará su contrato actual para compatibilidad y se comportará como readiness detallado.
- Los workers expondrán un servidor HTTP mínimo de salud que verifica Prisma y Redis sin consumir ni producir trabajos.
- El servicio WebSocket utilizará un servidor HTTP explícito para upgrades y healthchecks.
- Los procesos manejarán `SIGTERM`/`SIGINT`, cerrarán workers, Redis, Prisma y servidores antes de salir.
- Compose usará `depends_on` con condiciones saludables, políticas de reinicio y `start_period` razonable.

Una fuente externa degradada no volverá no saludable a la aplicación. Su estado seguirá siendo observado mediante `checkSourceHealth`.

## TLS y SSRF

La función heredada `testOfficialSourceConnection` no tiene consumidores reales. Se retirará junto con cualquier asignación a `NODE_TLS_REJECT_UNAUTHORIZED`. El flujo activo seguirá usando `checkSourceHealth`, `fetchOfficialUrl` y `validateUrlSafety`, conservando validación de protocolos, DNS/IP privadas y redirecciones. Un certificado inválido producirá un estado degradado o error; nunca un bypass TLS global.

## CI y pruebas

GitHub Actions utilizará Node 22, `npm ci`, cache de npm, cancelación por rama y timeout. Proveerá PostgreSQL/pgvector y Redis autenticado como servicios aislados, aplicará `prisma migrate deploy` sobre una base efímera y ejecutará, en orden:

1. Prisma generate.
2. TypeScript.
3. ESLint sin `|| true`.
4. Suite completa.
5. Build de producción.
6. Auditoría de dependencias.
7. Validación de Compose de producción.

Se conservarán las advertencias ESLint como no bloqueantes mientras los errores sí bloquean. Solo se corregirán advertencias de hooks, asincronía, recursos, seguridad y tipado directamente relacionadas con esta intervención.

## Seguridad y suministro

- Ejecutar SCA con `npm audit` y SAST/secret scanning con herramientas disponibles.
- Escanear archivos versionados e historial sin imprimir valores completos.
- Ampliar `.dockerignore` y `.gitignore` para excluir `.env*`, pruebas, documentación, logs, artefactos e índice CodeGraph de las imágenes y commits.
- Inspeccionar el contenido efectivo de las imágenes.
- No usar `npm audit fix --force`, migraciones destructivas ni credenciales inventadas.

## Documentación operativa

`docs/DEPLOYMENT.md` documentará desarrollo, Render y VPS: requisitos, variables, build, migraciones, healthchecks, logs, backups/restores, actualización, rollback, workers, HTTPS, túneles SSH para administración y verificación de secretos. Incluirá un ejemplo de Caddy sin certificados falsos.

## Compatibilidad y preservación

- `docker-compose.yml` y la experiencia local se conservan.
- No se cambia el contenido del Centro Jurídico ni las rutas visibles.
- El cambio pendiente de `tests/ai-usage.test.mjs` se revisará y se conservará si evita colisiones con datos existentes sin debilitar la prueba.
- No se elimina información de PostgreSQL, no se resetean migraciones y no se toca Render.

## Criterios de verificación

La entrega se calificará mediante instalación reproducible, auditoría sin vulnerabilidad alta conocida, typecheck, lint, pruebas con infraestructura real, build Next.js, build de todos los targets Docker, arranque Compose de producción, healthchecks, pruebas HTTP/DB/Redis, verificación de puertos, escaneo de secretos y revisión del contenido de imágenes. Cualquier validación impedida por Docker Desktop u otro componente externo se reportará con el error exacto y el veredicto no excederá “LISTO CON ADVERTENCIAS”.
