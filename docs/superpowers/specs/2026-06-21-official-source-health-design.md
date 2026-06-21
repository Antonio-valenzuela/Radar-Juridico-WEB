# Official Source Health and Ingestion Design

## Objective

Replace generic connectivity checks against `baseUrl` with adapter-aware health checks and manual-ingestion dispatch for SIDOF, DOF, Diputados, SCJN Legislación, SJF, and compatible generic HTML sources.

The change must preserve the admin token, existing source CRUD operations, registered custom sources, and SSRF protections.

## Root Causes

- The test endpoint returns `ok`, while the UI reads `accessible`, so valid responses can appear as “No accesible”.
- `testOfficialSourceConnection` probes every source generically and starts with `HEAD` against `baseUrl`.
- SIDOF is seeded with the obsolete `https://sidof.segob.gob.mx/dof/sidof` base.
- Redirect validation blocks same-host HTTP redirects without first normalizing them back to HTTPS.
- SCJN 403/WAF responses and JavaScript shell pages are treated as ordinary failures.
- Network exceptions discard `error.cause`, hiding TLS, DNS, timeout, and socket diagnostics.
- Manual ingestion selects an implementation mainly from `crawlMode`, even when a registered official source requires a dedicated adapter.

## Architecture

### Source health service

Create `lib/sources/sourceHealth.ts` as the single adapter-aware connectivity service. It will accept an `OfficialSourceHealthConfig` plus an injectable `fetch` implementation for deterministic tests. The input supports `adapter`, `baseUrl`, optional `healthUrl` or `healthPath`, `requiresBrowser`, expected status codes, default headers, timeout, and controlled redirect mode.

Supported adapters:

- `SIDOF`
- `DOF`
- `DIPUTADOS`
- `SCJN_LEG`
- `SJF`
- `GENERIC_HTML`

The resolver will infer an adapter from existing `adapter`, `type`, or `slug` values. Therefore existing database rows and custom sources remain compatible.

Each adapter profile defines its default health path, accepted status codes, browser requirement, crawl limitations, and body classifiers. A stored `healthUrl` overrides the profile; otherwise `healthPath` is resolved against `baseUrl`. Expected statuses may be a single code or an allowlist, such as `200`, `200–299`, or `403` for a provider-blocked SCJN profile.

### Persisted configuration

Extend `OfficialSource` with backward-compatible optional/defaulted fields:

- `adapter String @default("GENERIC_HTML")`
- `healthUrl String?`
- `requiresBrowser Boolean @default(false)`

Existing CRUD requests need not send these fields. Admin create/update endpoints will accept them when supplied and otherwise infer safe defaults from `type` and `slug`.

Canonical seed slugs become `SIDOF`, `DIPUTADOS`, `SCJN_LEG`, `SCJN_SJF`, and `DOF_WEB`. Resolution and database lookup remain case-insensitive, and the seed updates legacy lowercase rows in place instead of creating duplicates.

Endpoint paths, expected status rules, encodings, and redirect policy remain in adapter code rather than arbitrary database JSON. This prevents user-managed configuration from weakening SSRF controls.

## HTTP and SSRF Policy

Health checks use GET only with:

- 15-second AbortController timeout.
- Browser-compatible User-Agent.
- HTML/XML Accept header.
- `Accept-Language: es-MX,es;q=0.9,en;q=0.8`.
- Manual redirects, maximum three hops.
- URL and resolved-IP validation before every request.

HTTPS remains mandatory. If an allowlisted official domain redirects to HTTP on the same host, the service rewrites that hop to HTTPS and validates it again. It never follows arbitrary HTTP or cross-host insecure redirects.

The initial allowlist is limited to the official hosts required by the adapters: `diputados.gob.mx`, `www.diputados.gob.mx`, `sidof.segob.gob.mx`, `dof.gob.mx`, `www.dof.gob.mx`, `legislacion.scjn.gob.mx`, and `sjf2.scjn.gob.mx`.

The service will not mutate `NODE_TLS_REJECT_UNAUTHORIZED`. TLS failures are reported rather than globally bypassed.

## Health Result Contract

The API returns a stable object containing:

- `ok`: whether the check completed with an acceptable semantic outcome.
- `accessible`: whether the remote endpoint answered.
- `status`: one of `OK`, `REDIRECT_BLOCKED`, `BLOCKED_BY_PROVIDER`, `NOT_FOUND`, `FETCH_ERROR`, `BROWSER_REQUIRED`, or `WARNING_ACCESSIBLE_WITH_LIMITATIONS`.
- `message`, `durationMs`, `statusCode`, `finalUrl`, and `redirectsFollowed`.
- `error`, when applicable, with `name`, `message`, `causeCode`, `causeMessage`, and `causeHostname`.

Classification rules:

- HTTP 200–299: `OK`, unless body inspection indicates JavaScript is required.
- SJF body containing “You must enable JavaScript to view this page”: `BROWSER_REQUIRED`.
- SCJN adapter returning 403: `BLOCKED_BY_PROVIDER`, accessible but not scrapeable with plain fetch.
- Other expected-but-limited provider responses: `WARNING_ACCESSIBLE_WITH_LIMITATIONS`.
- HTTP 404: `NOT_FOUND`.
- Rejected redirect: `REDIRECT_BLOCKED`.
- Abort, DNS, TLS, socket, or other fetch exception: `FETCH_ERROR` with cause details.

The test route records `lastSuccessAt` for `OK` and warning/limitation states that prove the source is alive. True configuration/network failures update `lastFailureAt` and `lastErrorCategory`.

## Adapter Configuration

### SIDOF

- Base: `https://sidof.segob.gob.mx`
- Health: `https://sidof.segob.gob.mx/apiStatus`
- Crawl mode: `api`
- Ingestion endpoints: `/diarios/porFecha/{dd-mm-yyyy}`, `/notas/{dd-mm-yyyy}`, `/notas/nota/{codigo}`, `/documentos/pdf/{id}`.

SIDOF is the primary DOF source. The adapter must never scrape its homepage or the obsolete `/dof/sidof` route.

### Diputados

- Base: `https://www.diputados.gob.mx`
- Health/ingest index: `/LeyesBiblio/index.htm`
- Crawl mode: `html`
- Decode fallback order: UTF-8, Latin-1, Windows-1252.

The existing LeyesBiblio parser remains responsible for extracting PDF/HTML links. Controlled same-host HTTP redirects are rewritten to HTTPS.

### SCJN Legislación

- Base: `https://legislacion.scjn.gob.mx`
- Health: `/buscador/paginas/buscar.aspx`
- Adapter: `SCJN_LEG`
- `requiresBrowser: true`

A 403 response is classified as `BLOCKED_BY_PROVIDER`. Manual ingestion returns a controlled warning instead of treating the provider block as an ordinary fetch failure.

### SJF

- Base/health: `https://sjf2.scjn.gob.mx/`
- Adapter: `SJF`
- `requiresBrowser: true`

JavaScript shell pages are classified as `BROWSER_REQUIRED`. Manual plain-HTML ingestion is skipped with a controlled warning. No Playwright dependency is added in this change.

### DOF Web

- Base/health: `https://www.dof.gob.mx`
- Adapter: `DOF`
- Crawl mode: `html`

DOF Web is a fallback and is excluded from the primary scheduled source set whenever SIDOF is active.

## Manual Ingestion

`runSourceIngest` will dispatch registered official sources by resolved adapter before considering generic `crawlMode` behavior:

- SIDOF uses the SIDOF API module.
- Diputados uses the LeyesBiblio index parser.
- SJF with `requiresBrowser` returns a successful controlled warning with zero items and no simple HTML fetch.
- SCJN Legislación provider blocking returns a controlled warning rather than a network-error result.
- DOF uses the existing web ingestor only as fallback.
- Unknown/custom sources retain existing RSS, manual URL, search-only, or native-registry behavior.

Fetch logs continue to be written, with warning states distinguishable from hard failures.

## Admin UI

The page will consume the typed health contract instead of guessing from an `accessible` property that the backend did not previously provide.

Labels:

- `OK`: “Accesible”.
- `BLOCKED_BY_PROVIDER` / `BROWSER_REQUIRED`: “Bloqueado por proveedor externo, requiere navegador/Playwright”.
- `NOT_FOUND`: “Ruta configurada incorrecta”.
- `REDIRECT_BLOCKED`: “Redirección insegura bloqueada”.
- `FETCH_ERROR`: “Error de red/TLS/DNS: {causeCode}”.
- `WARNING_ACCESSIBLE_WITH_LIMITATIONS`: “Accesible con limitaciones”.

Warnings use an amber presentation; only hard failures use red. Diagnostic details show status code and final URL without exposing credentials or request headers.

## Tests

Add unit tests using an injected fetch implementation. No live government endpoint is required.

Required cases:

1. SIDOF resolves `/apiStatus` and never `/dof/sidof`.
2. Diputados resolves `/LeyesBiblio/index.htm`.
3. SJF JavaScript-required body returns `BROWSER_REQUIRED`.
4. SCJN 403 returns `BLOCKED_BY_PROVIDER`, not `FETCH_ERROR`.
5. A rejected fetch preserves name, message, `cause.code`, `cause.message`, and `cause.hostname`.
6. Same-host allowlisted HTTP redirect is rewritten to HTTPS.
7. Non-allowlisted or cross-host HTTP redirect returns `REDIRECT_BLOCKED`.
8. Existing admin-token and source CRUD tests remain green.
9. Manual-ingestion tests verify SIDOF/Diputados dispatch and controlled SCJN warnings.

## Non-Goals

- Installing or launching Playwright.
- Weakening HTTPS, DNS, private-IP, or redirect protections.
- Making live-network tests part of the normal suite.
- Replacing the existing CRUD or admin-token mechanism.
- Broad refactoring of unrelated ingestion or search code.
