# Critical Security Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las rutas sensibles, impedir autocreación tenant/owner y recuperar build, lint y tests con cambios mínimos.

**Architecture:** `requireAdmin` seguirá siendo la política central temporal y fail-closed de las superficies internas. Hasta contar con sesiones de usuario, watchlists y notificaciones tenant serán admin-only; `resolveTenant` solo resolverá usuarios, organizaciones y membresías existentes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Node Test Runner, Prisma.

---

### Task 1: Pruebas RED de límites sensibles

**Files:**
- Create: `tests/admin-boundaries.test.mjs`

- [ ] **Step 1: Crear pruebas de autorización y verbos**

La prueba importará handlers con `tsx`, invocará cada uno sin `x-admin-token` y exigirá `401`; `/api/debug/token` deberá responder `404`. También verificará que backfills e ingestas mutantes exporten `POST`, no `GET`.

```javascript
const protectedRoutes = [
  ["./app/api/admin/cleanup/route", "POST"],
  ["./app/api/admin/backfill-summaries/route", "POST"],
  ["./app/api/admin/reclassify/route", "POST"],
  ["./app/api/ingest/all/route", "POST"],
  ["./app/api/ingest/status/route", "GET"],
  ["./app/api/schedule/route", "POST"],
  ["./app/api/schedule-status/route", "GET"],
  ["./app/api/run-now/route", "POST"],
  ["./app/api/notify/run/route", "POST"],
  ["./app/api/notify/test/route", "POST"],
  ["./app/api/watchlist/route", "POST"]
];
```

- [ ] **Step 2: Ejecutar RED**

Run: `node --test tests/admin-boundaries.test.mjs`

Expected: FAIL porque varias rutas ejecutan lógica o no exportan POST.

### Task 2: Política central y rutas

**Files:**
- Modify: `app/api/admin/*/route.ts`
- Modify: `app/api/debug/*/route.ts`
- Modify: `app/api/ingest/**/route.ts`
- Modify: `app/api/schedule/route.ts`
- Modify: `app/api/schedule-status/route.ts`
- Modify: `app/api/run-now/route.ts`
- Modify: `app/api/notify/run/route.ts`
- Modify: `app/api/notify/test/route.ts`
- Modify: `app/components/RefreshButton.tsx`

- [ ] **Step 1: Desactivar el endpoint de token**

```typescript
export async function GET() {
  return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
}
```

- [ ] **Step 2: Aplicar `requireAdmin` antes de cualquier efecto**

```typescript
const auth = requireAdmin(req);
if (!auth.ok) return auth.response;
```

Todos los handlers protegidos recibirán `req: Request` o `NextRequest` y ejecutarán esta política antes de leer parámetros, conectar a colas o escribir datos.

- [ ] **Step 3: Cambiar mutaciones GET a POST**

Cambiar `GET` por `POST` en backfill, reclassify y rutas de ingesta que escriben; conservar GET únicamente en status/debug-source/schedule-status por ser lecturas protegidas.

- [ ] **Step 4: Mantener RefreshButton operativo**

Solicitar el token en memoria y enviarlo en `x-admin-token`; no persistirlo ni imprimirlo.

- [ ] **Step 5: Ejecutar GREEN de límites**

Run: `node --test tests/admin-boundaries.test.mjs`

Expected: PASS.

### Task 3: Tenant temporal seguro

**Files:**
- Modify: `lib/tenant.ts`
- Modify: `app/api/watchlist/route.ts`
- Modify: `app/watchlists/page.tsx`
- Test: `tests/admin-boundaries.test.mjs`

- [ ] **Step 1: Añadir RED de no-autocreación**

Comprobar que `resolveTenant` no contiene `upsert`, `createIfMissing` ni creación de rol `owner`, y que watchlist rechaza requests sin admin.

- [ ] **Step 2: Resolver solo entidades existentes**

Usar `findUnique` para user/org/membership y devolver errores `Usuario no encontrado`, `Organizacion no encontrada` o `Usuario sin acceso`.

- [ ] **Step 3: Proteger watchlist y UI temporal**

Aplicar `requireAdmin` al inicio y enviar el token desde estado en memoria. Documentar que es un puente admin-only hasta implementar sesión real.

- [ ] **Step 4: Ejecutar GREEN tenant**

Run: `node --test tests/admin-boundaries.test.mjs tests/auth.test.mjs`

Expected: PASS.

### Task 4: Build y contrato RAG

**Files:**
- Modify: `app/rag/page.tsx`

- [ ] **Step 1: Usar el contrato real de grupos externos**

Tipar `externalResults` como `ExternalResultGroup[]` y calcular:

```typescript
const totalExternalResults = externalResults.reduce(
  (total, group) => total + group.results.length,
  0
);
```

- [ ] **Step 2: Corregir solo errores lint locales del archivo**

Escapar comillas JSX como `&quot;` sin alterar textos o comportamiento.

- [ ] **Step 3: Verificar tipos y build**

Run: `npm run typecheck` y `npm run build`

Expected: exit 0.

### Task 5: Contrato legal vacío y quality gate

**Files:**
- Modify: `app/api/legal/radar/route.ts`
- Test: `tests/legal-radar.test.mjs`

- [ ] **Step 1: Confirmar RED existente**

Run: `node --test tests/legal-radar.test.mjs`

Expected: FAIL solo en el contrato de respuesta vacía.

- [ ] **Step 2: Materializar payload sin IA**

Definir un objeto vacío explícito `{ aiReport: null, aiAnalysis: null }` y usarlo cuando `radarStatus === "empty"`; conservar resultados con IA para estados success/partial.

- [ ] **Step 3: Ejecutar gate completo**

Run: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Expected: exit 0 en los cuatro comandos.

- [ ] **Step 4: Actualizar documentación**

Crear reporte final con archivos, rutas, pruebas, resultados y riesgos de sesión/rotación pendientes.

