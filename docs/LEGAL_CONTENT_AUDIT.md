# Auditoría de Contenido Jurídico — Jurídico Radar

**Fecha:** 26 de julio de 2026
**Commit base:** e477f57 (producción en Render)
**Objetivo:** Identificar datos estáticos, funciones simuladas, botones sin funcionalidad completa e información sin fuente oficial.

---

## 1. Resumen Ejecutivo

Jurídico Radar funciona actualmente como **prototipo visual** con datos estáticos hardcodeados en TypeScript. Los módulos de legal-hub presentan funcionalidad aparente que no está respaldada por datos reales, persistencia en base de datos ni integración con fuentes oficiales.

| Métrica | Estado actual |
|---|---|
| Machotes/plantillas | 6 esqueletos con placeholders `[Desarrollar...]` |
| Leyes catalogadas | 9 hardcodeadas en `CURRENT_LEGAL_LAWS` |
| Jurisprudencia almacenada | 0 (solo redirige a `/search`) |
| Expedientes en PostgreSQL | 0 (solo `localStorage`) |
| Alertas de actuaciones | 0 reales (cálculo client-side simulado) |
| Reglas de monitoreo | 0 activas en dashboard |
| Documentos indexados en home | 21 (de ingesta real) |

---

## 2. Datos Estáticos

### 2.1 `CURRENT_LEGAL_LAWS` — `lib/legalOperations.ts:78-214`

Arreglo de 9 leyes hardcodeadas sin conexión a base de datos:

| ID | Ley | Problema |
|---|---|---|
| `codigo-civil-federal` | Código Civil Federal | Fecha de reforma = texto genérico, sin URL del DOF |
| `codigo-civil-jalisco` | Código Civil de Jalisco | URL apunta a listado general, no al texto |
| `codigo-comercio` | Código de Comercio | Fecha "DOF 14/11/2025" sin enlace al DOF |
| `cnpcf` | CNPCF | Fecha "DOF 15/01/2026" sin enlace al DOF |
| `ley-amparo` | Ley de Amparo | Sin fecha concreta de reforma |
| `cnpp` | CNPP | Sin fecha concreta de reforma |
| `lgtoc` | LGTOC | Sin fecha concreta de reforma |
| `lgsm` | LGSM | Sin fecha concreta de reforma |
| `leyes-jalisco` | Leyes estatales Jalisco | URL genérica, no identifica ley específica |

**Impacto:** El catálogo de leyes no se actualiza automáticamente. Las fechas de reforma son texto estático que puede quedar desactualizado.

### 2.2 `GUIDED_LEGAL_TEMPLATES` — `lib/legalOperations.ts:394-492`

6 plantillas con cuerpos simples (3-8 líneas cada uno):

| Template | Problema principal |
|---|---|
| `amparo-indirecto-guiado` | `[Desarrollar conceptos de violación...]` — placeholder sin contenido |
| `demanda-ordinaria-civil` | `[Relacionar documentos, testigos...]` — placeholder sin estructura |
| `demanda-alimentos` | Sin sección de pruebas, fundamentos, ni petitorios estructurados |
| `demanda-ejecutiva-mercantil` | `[Describir y anexar título...]` — placeholder |
| `recurso-revocacion-guiado` | `[Ofrecer pruebas...]` — placeholder |
| `promocion-general` | Demasiado breve, sin estructura procesal |

**Impacto:** Los machotes no son utilizables profesionalmente. Dejan al abogado con más trabajo que si redactara desde cero.

### 2.3 `LEGAL_HUB_TABS` y `LEGAL_SOURCE_SHORTCUTS` — `lib/legalHub.ts`

Tabs y shortcuts estáticos que enlazan a `/search?query=...` sin verificar que el contenido exista en la base de datos.

### 2.4 `JURISPRUDENCE_SEARCH_FIELDS` — `lib/legalOperations.ts:216-225`

Campos de búsqueda para jurisprudencia que solo construyen un query string para redirigir a `/search`.

### 2.5 `CASE_SOURCE_OPTIONS` — `lib/legalOperations.ts:237-262`

3 fuentes de expedientes (SISE, CJF Listas, Boletín Jalisco) con URLs oficiales correctas pero sin integración automatizada.

---

## 3. Funciones Simuladas

### 3.1 Almacenamiento de expedientes — `app/legal-hub/expedientes/page.tsx`

- **Almacenamiento:** `localStorage` con key `juridico_tracked_cases`
- **CRUD:** Totalmente client-side con `useState` + `localStorage`
- **Alertas:** `getCaseAlertState()` calcula alertas usando date math del lado del cliente
- **Actuaciones:** Registro manual sin conexión a fuente oficial

**Impacto:** Los datos se pierden al limpiar el navegador. No son accesibles desde otros dispositivos. No hay respaldo.

### 3.2 Descarga Word — `app/legal-hub/machotes/page.tsx`

```typescript
// Función actual: genera HTML envuelto en <pre> con extensión .doc
const downloadWord = () => {
  const html = `<html><head><meta charset="utf-8"></head><body><pre>${draft}</pre></body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  // Descarga como .doc pero es HTML
};
```

**Impacto:** El archivo `.doc` no es un documento Word real. No tiene formato, márgenes, tipografía ni estructura profesional.

### 3.3 Exportación PDF — `app/legal-hub/machotes/page.tsx`

```typescript
const printPdf = () => window.print();
```

**Impacto:** Imprime toda la página incluyendo navegación, sidebar y elementos UI. No genera un documento PDF limpio.

### 3.4 Búsqueda de jurisprudencia — `app/legal-hub/jurisprudencia/page.tsx`

- Construye query string con `buildJurisprudenceQuery()`
- Redirige a `/search?source=SJF&query=...&auto=1`
- No muestra resultados dentro de la pantalla de jurisprudencia
- El botón "Abrir SJF oficial" abre `sjf2.scjn.gob.mx` sin pasar parámetros

**Impacto:** El usuario sale de la aplicación para buscar jurisprudencia. No hay almacenamiento local de criterios.

### 3.5 Copia de plantillas — `app/legal-hub/page.tsx`

Las plantillas del tab "Machotes" solo copian texto plano al portapapeles. No generan documentos estructurados.

---

## 4. Botones sin Funcionalidad Completa

| Ubicación | Botón | Comportamiento actual | Problema |
|---|---|---|---|
| `legal-hub/page.tsx` | Mobile menu toggle | CSS checkbox | Sin menú slide-out funcional |
| `legal-hub/page.tsx` | "Buscar" en tarjetas | Redirige a `/search?...` | No busca en la pantalla actual |
| `jurisprudencia/page.tsx` | "Buscar criterios" | Redirige a `/search` | No muestra resultados in-page |
| `jurisprudencia/page.tsx` | "Abrir SJF oficial" | `window.open(sjf2.scjn.gob.mx)` | No pasa parámetros de búsqueda |
| `leyes-vigentes/page.tsx` | "Buscar artículo/concepto" | Redirige a `/search` | No busca en catálogo local |
| `machotes/page.tsx` | "Descargar Word" | HTML en blob → `.doc` | No es DOCX real |
| `machotes/page.tsx` | "Imprimir / guardar PDF" | `window.print()` | Imprime toda la página |
| `expedientes/page.tsx` | "Abrir fuente con parámetros" | `window.open(url)` | Requiere login manual del usuario |

---

## 5. Información sin Fuente Oficial

### 5.1 Fechas de reforma sin URL del DOF

- Código de Comercio: "DOF 14/11/2025" — sin enlace
- CNPCF: "DOF 15/01/2026" — sin enlace
- Cantidades comerciales: "acuerdo DOF 18/02/2026" — sin enlace

### 5.2 Plantillas sin referencia a código procesal

Los 6 machotes mencionan procedimientos legales pero no referencian artículos específicos de la ley aplicable.

### 5.3 Términos jurisprudenciales sin enlace

Jurisprudencia página menciona "contradicción de tesis", "precedentes obligatorios", "Undécima Época" sin enlaces a las disposiciones que definen estos conceptos.

### 5.4 Boletines estatales

Solo Jalisco tiene URL configurada. Otros estados referenciados genéricamente.

---

## 6. Módulos Funcionales (No requieren reemplazo)

| Módulo | Estado | Nota |
|---|---|---|
| Sistema de ingesta (DOF, SIDOF, SCJN, SJF) | ✅ Funcional | Workers con BullMQ procesan fuentes reales |
| Búsqueda híbrida (texto + semántica) | ✅ Funcional | pgvector + thesaurus + federated search |
| RAG / Consultor IA | ✅ Funcional | Usa embeddings reales y LLM |
| Sistema de monitoreo de documentos | ✅ Funcional | Detecta cambios en normas indexadas |
| Dashboard administrativo | ✅ Funcional | WebSocket con métricas reales |
| Fuentes oficiales (OfficialSource) | ✅ Funcional | CRUD con health checks |
| Enrichment IA | ✅ Funcional | Clasificación y enriquecimiento por LLM |
| Exportación CSV | ✅ Funcional | Items con filtros |
| Health checks | ✅ Funcional | DB, Redis, queues |

---

## 7. Diagnóstico por Archivo

### `app/legal-hub/page.tsx` (172 líneas)
- **Datos estáticos:** Tabs, shortcuts, templates de `lib/legalHub.ts`
- **Sin BD:** Todo client-side
- **Acción:** Conectar a API para conteos dinámicos

### `app/legal-hub/expedientes/page.tsx` (371 líneas)
- **Almacenamiento:** localStorage exclusivo
- **Funciones simuladas:** CRUD, alertas, actuaciones
- **Acción:** Migrar a PostgreSQL con API REST

### `app/legal-hub/jurisprudencia/page.tsx` (114 líneas)
- **Solo redirige:** Construye query y envía a `/search`
- **Sin resultados:** No muestra datos in-page
- **Acción:** Crear modelo Jurisprudencia, mostrar resultados in-app

### `app/legal-hub/leyes-vigentes/page.tsx` (114 líneas)
- **Datos estáticos:** `CURRENT_LEGAL_LAWS` (9 items)
- **Sin BD:** Filtrado client-side sobre arreglo
- **Acción:** Crear modelo LegalNorm, consultar desde BD

### `app/legal-hub/machotes/page.tsx` (197 líneas)
- **6 esqueletos:** Plantillas con `[Desarrollar...]`
- **Word falso:** HTML → .doc
- **PDF falso:** window.print()
- **Acción:** 15 plantillas profesionales, DOCX real, PDF real

### `app/page.tsx` (dashboard principal)
- **Contadores:** 0 reglas, 0 alertas
- **Acción:** Agregar conteos de normas, jurisprudencia, expedientes

---

## 8. Conclusión

La aplicación tiene una **infraestructura backend robusta** (ingesta, búsqueda, RAG, monitoreo) pero el **módulo de legal-hub** es fundamentalmente un prototipo visual. Las 9 deficiencias principales son:

1. Machotes inutilizables profesionalmente
2. Solo 6 machotes de 15+ necesarios
3. Leyes en arreglo estático sin actualización
4. Sin fechas de reforma verificables con URL
5. Jurisprudencia sin almacenamiento propio
6. Expedientes en localStorage
7. Sin monitoreo real de actuaciones
8. Dashboard con contadores vacíos
9. Exportación Word/PDF simulada

**Todas estas deficiencias serán abordadas en las fases 2-9 de implementación.**
