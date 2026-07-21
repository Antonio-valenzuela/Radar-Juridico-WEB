# Operación y despliegue portátil

Esta guía separa desarrollo, migración y ejecución. Ningún contenedor de larga duración instala dependencias, compila la aplicación o aplica migraciones al arrancar.

> Límite de seguridad: no use estas instrucciones contra el servicio activo `radar-juridico.onrender.com` hasta haber validado una instancia nueva. Los ejemplos de Render crean servicios nuevos; no cambian ni redespliegan el existente.

## Versiones y archivos

- Node.js: `22.x` (`.nvmrc`, `package.json`, Docker y CI).
- Desarrollo: `docker-compose.yml`.
- Producción portátil: `docker-compose.prod.yml`.
- Imágenes: targets `web-runtime`, `worker-runtime` y `migrate` del `Dockerfile`.
- Variables: copie `.env.example`; nunca confirme el archivo resultante ni un secret real.

## Desarrollo local en Windows

Requisitos: Node.js 22, npm 10 o posterior y Docker Desktop con Compose v2.

```powershell
Set-Location C:\Users\yahir\juridico-radar
nvm use 22
npm ci
Copy-Item .env.example .env
```

Para usar solamente PostgreSQL y Redis del Compose de desarrollo, cambie estas líneas en `.env` (son credenciales exclusivamente locales):

```dotenv
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3100
DATABASE_URL=postgresql://app:apppass@localhost:5432/juridico?schema=public
REDIS_URL=redis://localhost:6379
```

Luego ejecute:

```powershell
docker compose up -d postgres redis
npm run db:migrate
npm run dev
```

La web queda en `http://localhost:3100`. En terminales separadas puede iniciar procesos opcionales:

```powershell
npm run worker
npm run worker:legal-reports
npm run dashboard
```

El dashboard WebSocket queda en `ws://localhost:3002`. El archivo `docker-compose.yml` sigue siendo el entorno de desarrollo con bind mounts y hot reload; no debe usarse en producción.

Para apagar sin borrar datos:

```powershell
docker compose down
```

No use `docker compose down -v` salvo que quiera eliminar deliberadamente la base local.

## Prueba local de la configuración de producción

Cree `.env.production` desde el ejemplo. Genere credenciales alfanuméricas distintas; así no requieren escapado dentro de las URL:

```powershell
Copy-Item .env.example .env.production
openssl rand -hex 24
openssl rand -hex 24
openssl rand -hex 32
```

Asigne los tres resultados a `POSTGRES_PASSWORD`, `REDIS_PASSWORD` y `ADMIN_TOKEN`. Use un usuario y base no predeterminados, y configure al menos:

```dotenv
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3002
POSTGRES_USER=radar_prod_local
POSTGRES_PASSWORD=<postgres-hex>
POSTGRES_DB=radar_prod_local
DATABASE_URL=postgresql://radar_prod_local:<postgres-hex>@postgres:5432/radar_prod_local?schema=public
REDIS_PASSWORD=<redis-hex>
REDIS_URL=redis://:<redis-hex>@redis:6379/0
ADMIN_TOKEN=<admin-hex>
LLM_PROVIDER=local
```

No reutilice esos valores en un VPS ni en Render. Valide, construya y migre la base de prueba de forma explícita:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

`up -d` no ejecuta migraciones. El servicio `migrate` sólo existe bajo el perfil explícito `migrate`.

Compruebe estado, logs y healthchecks:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl.exe -fsS http://127.0.0.1:3000/api/health/live
curl.exe -fsS http://127.0.0.1:3000/api/health/ready
curl.exe -fsS http://127.0.0.1:3002/health/ready
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail 200 web worker worker-legal-reports dashboard-ws postgres redis
```

Todos los servicios de larga duración deben aparecer `healthy`. PostgreSQL y Redis no publican puertos en esta configuración. Para comprobarlos desde su red privada:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping'
```

Apague esta prueba sin borrar volúmenes:

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

## Backup, migración y restauración

Antes de cada migración productiva, cree un backup y verifique que el archivo no esté vacío:

```bash
mkdir -p backups
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/radar-$(date +%Y%m%d-%H%M%S).dump"
test -s backups/radar-*.dump
```

Después ejecute una sola vez:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile migrate run --rm migrate
```

`pg_restore` es un procedimiento de recuperación destructivo si se combina con `--clean`. No lo ejecute durante un rollback normal ni sin autorización y una ventana de mantenimiento. En recuperación controlada:

```bash
cat backups/radar-YYYYMMDD-HHMMSS.dump | \
  docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner'
```

## Despliegue nuevo en Render

Render puede desplegar una imagen preconstruida o construir el `Dockerfile`, pero no permite elegir un target multi-stage distinto por servicio. Para conservar las imágenes separadas, publique los tres targets en un registro privado. Consulte [Docker on Render](https://render.com/docs/docker), [deploys](https://render.com/docs/deploys) y la [Blueprint specification](https://render.com/docs/blueprint-spec).

### 1. Construir y publicar imágenes inmutables

En un equipo confiable, sustituya `OWNER`, las URLs de preview y el tag:

```bash
TAG="$(git rev-parse --short HEAD)"
docker build --target web-runtime \
  --build-arg NEXT_PUBLIC_APP_URL=https://radar-juridico-preview.onrender.com \
  --build-arg NEXT_PUBLIC_WEBSOCKET_URL=wss://radar-juridico-ws-preview.onrender.com \
  -t ghcr.io/OWNER/juridico-radar-web:"$TAG" .
docker build --target worker-runtime -t ghcr.io/OWNER/juridico-radar-worker:"$TAG" .
docker build --target migrate -t ghcr.io/OWNER/juridico-radar-migrate:"$TAG" .
docker login ghcr.io
docker push ghcr.io/OWNER/juridico-radar-web:"$TAG"
docker push ghcr.io/OWNER/juridico-radar-worker:"$TAG"
docker push ghcr.io/OWNER/juridico-radar-migrate:"$TAG"
```

No use `latest`; el SHA permite rollback. No pase secrets como `--build-arg`.

### 2. Crear infraestructura de preview aislada

En Render cree recursos nuevos, sin seleccionar ni renombrar el servicio activo:

1. PostgreSQL nuevo con `pgvector` disponible y base vacía de preview.
2. Render Key Value/Redis nuevo con autenticación y URL interna.
3. Web Service nuevo desde `ghcr.io/OWNER/juridico-radar-web:<TAG>`.
4. Background Workers nuevos desde la imagen `worker`.
5. Web Service nuevo para WebSocket desde la imagen `worker`.

En la web configure `/api/health/ready` como Health Check Path. Mantenga auto-deploy desactivado durante la validación; después puede usar la política `checksPass`. Use el puerto que Render aporta mediante `PORT`; `server.js` lo respeta.

Configure como secrets, nunca en el repositorio: `DATABASE_URL` interna, `REDIS_URL` interna con contraseña, `ADMIN_TOKEN` aleatorio y las claves de proveedores que realmente use. Configure también `NODE_ENV=production`, `NEXT_PUBLIC_APP_URL`, flags públicos en `false` y el resto de `.env.example` según corresponda. Las variables `NEXT_PUBLIC_*` deben coincidir con las usadas al construir la imagen web.

### 3. Migrar la base nueva antes de arrancar tráfico

Haga primero un backup si la base ya contiene datos. Desde una máquina confiable, capture la URL externa de PostgreSQL como variable protegida y ejecute la imagen de migración una sola vez:

```bash
read -s -p "Render DATABASE_URL externa: " DATABASE_URL; export DATABASE_URL; echo
docker run --rm --env DATABASE_URL \
  ghcr.io/OWNER/juridico-radar-migrate:"$TAG"
unset DATABASE_URL
```

No coloque la URL en el historial del shell. Render también admite pre-deploy commands para servicios compatibles, pero una imagen de migración separada evita ejecutar migraciones al arrancar la web; vea [Prisma on Render](https://render.com/docs/deploy-prisma-orm).

### 4. Comandos de los servicios

- Web: use el `CMD` de la imagen (`node server.js`).
- Worker de ingesta: `node node_modules/tsx/dist/cli.mjs worker/ingestWorker.ts`.
- Worker de reportes: `node node_modules/tsx/dist/cli.mjs worker/legalReportWorker.ts`.
- WebSocket: `/bin/sh -c 'WEBSOCKET_PORT="$PORT" node node_modules/tsx/dist/cli.mjs worker/dashboardWorker.ts'`; health path `/health/ready`.

No cree un segundo servicio `api`: las rutas API forman parte de la aplicación Next.js. El servicio `api` del Compose sirve para topologías VPS que quieran aislar una réplica interna.

### 5. Validar preview y promover

Compruebe `/api/health/live`, `/api/health/ready`, `/health/ready` del WebSocket y los logs de cada worker. Ejecute smoke tests sin datos productivos. Sólo después cree servicios productivos nuevos o cambie tráfico de manera explícita. Este procedimiento no autoriza a modificar `radar-juridico.onrender.com`.

## Despliegue en VPS con Docker Compose

Requisitos recomendados: Ubuntu LTS, Docker Engine + Compose v2, un usuario sin privilegios con acceso a Docker, DNS y acceso SSH con llave. Desactive login SSH por contraseña y proteja el firewall.

### 1. Preparar el host

```bash
sudo install -d -o deploy -g deploy /opt/juridico-radar
sudo install -d -o deploy -g deploy /opt/juridico-radar/backups
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3002/tcp
sudo ufw enable
```

No abra `5432`, `6379`, `9101` ni `9102`. PostgreSQL y Redis permanecen sólo en la red privada de Docker. Para administración use SSH y `docker compose exec`, no publique esos puertos.

### 2. Instalar la versión y secrets

Clone o copie el commit validado en `/opt/juridico-radar`. Cree `/opt/juridico-radar/.env.production` con permisos `0600`:

```bash
cd /opt/juridico-radar
cp .env.example .env.production
chmod 600 .env.production
```

Use `openssl rand -hex 24` para contraseñas y `openssl rand -hex 32` para `ADMIN_TOKEN`. En las URL internas use hosts `postgres` y `redis`. Configure:

```dotenv
NEXT_PUBLIC_APP_URL=https://radar.example.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://radar.example.com:3002
DATABASE_URL=postgresql://<usuario>:<password>@postgres:5432/<base>?schema=public
REDIS_URL=redis://:<password>@redis:6379/0
APP_PORT=3000
WEBSOCKET_PORT=3002
IMAGE_TAG=<git-sha>
```

### 3. Backup, build, migración y arranque

```bash
cd /opt/juridico-radar
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml build
# Si ya existe una base, ejecute primero el pg_dump documentado arriba.
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile migrate run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Instale Caddy y copie `docs/Caddyfile.example` a `/etc/caddy/Caddyfile`, sustituyendo el dominio. Caddy gestiona HTTPS. Valide y recargue:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://radar.example.com/api/health/ready
curl -fsS https://radar.example.com:3002/health/ready
```

### 4. Logs y operación

```bash
cd /opt/juridico-radar
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail 200 web
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail 200 worker worker-legal-reports dashboard-ws
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## Upgrade y rollback

Para upgrade, haga backup, obtenga el commit/tag exacto, construya las imágenes, ejecute `migrate` una vez y luego `up -d`. No use `down -v`.

Para rollback de código:

```bash
git checkout <sha-anterior-validado>
export IMAGE_TAG=<sha-anterior-validado>
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

No revierta migraciones automáticamente. Confirme que el código anterior sea compatible con el esquema actual. Sólo use `pg_restore` si el análisis determina que es necesario, con autorización expresa, backup verificado y ventana de mantenimiento.

## Lista de aceptación

- `docker compose ... config --quiet` finaliza con código 0.
- Web, API opcional, workers, WebSocket, PostgreSQL y Redis están `healthy`.
- `/api/health/ready` y `/health/ready` responden 200.
- Las migraciones se ejecutaron explícitamente una vez.
- PostgreSQL y Redis no tienen puertos publicados.
- Los logs no contienen secrets ni URLs con credenciales.
- Existe un backup verificable y un tag inmutable para rollback.
- El despliegue de preview pasó smoke tests antes de cualquier cambio de tráfico.
