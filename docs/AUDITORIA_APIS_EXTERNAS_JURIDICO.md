# Auditoría Técnica, Funcional, Legal y de Seguridad de APIs Externas
**Proyecto:** Jurídico Radar  
**Ubicación:** `C:\Users\yahir\juridico-radar`  
**Fecha de revisión:** 2 de agosto de 2026  
**Autor:** Antigravity AI — Pair Programmer Audit Task  

---

## A. Resumen Ejecutivo

Se ha realizado una auditoría exhaustiva del código fuente, arquitectura, esquemas de base de datos, flujos de ingesta y requisitos de seguridad y privacidad del proyecto **Jurídico Radar**. A partir de esta evaluación, se analizó la viabilidad y conveniencia de integrar cuatro servicios o APIs externas: **OCR.Space**, **iLoveAPI / iLovePDF API**, **APIs del INEGI (Banco de Indicadores y DENUE)** y **datos.gob.mx (Catálogo y API CKAN)**.

### Conclusión por Servicio

1. **OCR.Space — Decisión: SUSTITUIR POR SOLUCIÓN LOCAL (Tesseract OCR / OCRmyPDF en Worker Local)**
   * **Razonamiento:** Enviar acuerdos judiciales, escritos procesales o expedientes de clientes a un servicio SaaS externo gratuito o comercial de terceros viola el **secreto profesional** (Art. 36 Ley de Profesiones, Arts. 210/211 Código Penal Federal) y la **Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (LGPDPPSO) / LFPDPPP**. Técnicamente existe una necesidad real (documentos PDF escaneados fallan actualmente en `documentIngestProcessor.ts` al obtener `< 10` caracteres), pero la solución óptima y segura es desplegar un motor OCR local/autoalojado (Tesseract v5 + Poppler / OCRmyPDF) dentro de la infraestructura o worker de BullMQ.
   * **Clasificación de Riesgo:** **ALTO / CRÍTICO** para documentos de clientes si se usa un SaaS externo.

2. **iLoveAPI / iLovePDF API — Decisión: SUSTITUIR POR SOLUCIÓN LOCAL (`pdf-lib` + `docx` + `playwright`)**
   * **Razonamiento:** Las operaciones de manipulación de PDF (unir expedientes, dividir páginas, aplicar marcas de agua, numeración de folios, extraer páginas y convertir imágenes/documentos) son necesarias para el módulo de Expediente Digital y Machotes. Sin embargo, realizarlas mediante llamadas API a servidores externos de iLovePDF transmite expedientes completos fuera del servidor del despacho, generando riesgos de privacidad, latencia de red (subida/descarga de archivos pesados) y costos de suscripción recurrentes. Todas estas funciones pueden implementarse al 100% de forma local, gratuita y con latencia cero en Node.js usando la librería **`pdf-lib`**, complementada con la librería **`docx`** (ya instalada) y **Playwright** (ya disponible en devDependencies).
   * **Clasificación de Riesgo:** **ALTO** en privacidad; **INNECESARIO** en costo y dependencia.

3. **INEGI: DENUE — Decisión: INTEGRAR ÚNICAMENTE COMO PRUEBA DE CONCEPTO (Fase Posterior)**
   * **Razonamiento:** El Directorio Nacional de Establecimientos Económicos (DENUE) permite enriquecer los módulos de **Clientes** (`Client`) y **Partes en Juicio** (`CaseParty`), ofreciendo autocompletado de nombre comercial, actividad económica SCIAN, ubicación geográfica (latitud/longitud) y teléfono público. Sin embargo, DENUE **no acredita personalidad jurídica, validez fiscal, representación legal ni domicilio procesal**. Se recomienda como una función opcional de consulta informativa en formularios de clientes y partes, protegida con caché en Redis y avisos legales explícitos.
   * **Clasificación de Riesgo:** **BAJO** (solo consulta datos públicos corporativos sin enviar documentos ni datos sensibles de clientes).

4. **INEGI: Banco de Indicadores — Decisión: INTEGRAR DESPUÉS (Módulo Opcional)**
   * **Razonamiento:** Ofrece indicadores macroeconómicos y demográficos (ej. INPC para actualización de cuantías o intereses moratorios). No tiene relación directa con la vigilancia diaria de boletines ni expedientes judiciales, por lo que integrarlo ahora agregaría complejidad y ruido a la interfaz principal. Se posterga para un futuro módulo financiero-jurídico.
   * **Clasificación de Riesgo:** **BAJO**.

5. **datos.gob.mx (Catálogo y API CKAN) — Decisión: NO INTEGRAR API EN TIEMPO REAL (Mantener Catálogo Curado)**
   * **Razonamiento:** Basado en evidencia directa de la API CKAN (`package_search?q=justicia`), el portal datos.gob.mx contiene 32 datasets estáticos (CSV/XLSX) de carácter estadístico o administrativo (ej. planes de justicia del INPI, presupuesto de centros de mujer, datos penitenciarios). **Ninguno ofrece seguimiento procesal en tiempo real, listas de acuerdos, boletines judiciales, jurisprudencia ni cambios legislativos**. No puede sustituir a las fuentes oficiales de vigilancia (DOF, SCJN, SJF, SISE, Boletines Estatales). Integrar búsquedas dinámicas de CKAN aportaría valor nulo al core de vigilancia legal; es preferible mantener un listado estático y curado de enlaces útiles para investigación.
   * **Clasificación de Riesgo:** **NULO / IRRELEVANTE**.

---

## B. Estado Actual del Proyecto

### Arquitectura Técnica
* **Framework Web & API:** Next.js 16.2.12 (App Router en `app/`), React 19.2.3, TypeScript 5.
* **Base de Datos & ORM:** PostgreSQL 16 con extensión `pgvector`, Prisma ORM 6.19.2.
* **Procesamiento Asíncrono:** Redis 7 (`ioredis` 5.9.2), BullMQ 5.67.1 para colas de workers (`worker/ingestWorker.ts`, `worker/documentIngestProcessor.ts`, `worker/bulletinWorker.ts`, `worker/alertWorker.ts`, `worker/legalReportWorker.ts`).
* **Inteligencia Artificial:** Router propio (`lib/ai/provider.ts`) con soporte multiproveedor (Gemini, OpenRouter, Groq) y fallback local.
* **Procesamiento de Documentos Existente:**
  * Extracción de texto PDF: `lib/pdf/pdfExtractor.ts` utiliza `pdf-parse` (v2.4.5).
  * Renderizado de Plantillas: `lib/templates/exportPdf.ts` genera HTML imprimible (`window.print()`); `lib/templates/exportDocx.ts` utiliza `docx` (v9.7.1).
  * Control de versiones e indexación: `lib/documents/versionControl.ts` e `lib/documents/indexDocument.ts` generan chunks y embeddings en `pgvector`.
* **Módulos de Negocio Implementados:**
  * Ingesta de fuentes oficiales normativas (DOF, SIDOF, SCJN, SJF, Diputados, Jalisco).
  * Monitoreo de boletines judiciales (`CaseBulletinWatch`, `JudicialBulletinEntry`, `MatterBulletinEntry`).
  * Gestión de Expedientes y Asuntos (`Matter`, `CaseFile`, `MatterDocument`, `CaseActuation`, `CaseDeadline`, `CaseParty`).
  * Clientes y Organizaciones (`Client`, `Organization`, `User`, `OrgUserRole`).
  * Búsqueda RAG y Asistente IA (`app/api/rag/`, `app/api/ai/`).
  * Centro Jurídico y Machotes (`LegalDraft`, `lib/templates/`).

### Necesidades No Resueltas en el Código Actual
1. **Falta de OCR en Ingesta:** En `worker/documentIngestProcessor.ts` (líneas 120-122), si un PDF es escaneado (sin capa de texto), `pdf-parse` retorna texto vacío y la ingesta lanza la excepción `"El texto extraído es demasiado corto o vacío"`, enviando el job a Dead Letter Queue.
2. **Falta de Manipulación Digital de PDFs:** No existen utilidades para unir anexos a una demanda (`CaseFile`), numerar folios, estampar marcas de agua ni dividir expedientes pesados.
3. **Validación Informativa de Empresas/Clientes:** La creación de clientes (`Client`) y partes en juicio (`CaseParty`) requiere captura manual sin autocompletado de datos públicos comerciales (SCIAN, coordenadas, teléfono).

---

## C. Matriz Comparativa de Integraciones

| Servicio | Caso de Uso | Beneficio Principal | Costo Estimado | Complejidad de Integración | Riesgo de Privacidad | Dependencia Externa | Decisión Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OCR.Space API** | Extraer texto de acuerdos/boletines escaneados | Sin necesidad de instalar binarios OCR locales | Gratuito 500 req/día; de pago desde $29 USD/mes | Baja (HTTP POST multipart) | **CRÍTICO / ALTO** (archivos suben a la nube) | Alta (Cloud SaaS) | **SUSTITUIR POR LOCAL** (Tesseract / Poppler) |
| **Tesseract OCR (Local)** | OCR en worker de ingesta | 100% privado, sin costo por página, ilimitado | $0 USD (Open Source) | Media (Docker container sidecar / worker) | **NULO** (procesamiento local) | Nula | **RECOMENDADO PARA OCR** |
| **iLoveAPI / iLovePDF** | Unir, dividir, compilar expedientes y marcas de agua | APIs REST listas para procesar PDF | Gratuito 250 req/mes; de pago desde $20 USD/mes | Baja (API Client REST) | **ALTO** (envío de expedientes completos a la nube) | Alta (Cloud SaaS) | **NO INTEGRAR / SUSTITUIR** |
| **`pdf-lib` (Local)** | Manipulación completa de PDFs | Manipulación local, latencia 0ms, sin límites | $0 USD (Open Source) | Baja (Librería TS/JS en Node.js) | **NULO** (100% en servidor propio) | Nula | **RECOMENDADO PARA PDF** |
| **INEGI: DENUE** | Autocompletar datos de empresas/partes | Validación de giro comercial y mapa de ubicación | $0 USD (API Pública previa token) | Baja (REST GET JSON) | **BAJO** (solo se consultan datos públicos) | Media (Servicio Gubernamental) | **INTEGRAR COMO PoC (Fase 6)** |
| **INEGI: Indicadores** | Contexto macroeconómico e inflación | Cálculo automatizado de actualización de cuantías | $0 USD (API Pública previa token) | Baja (REST GET JSON) | **NULO** | Media (Servicio Gubernamental) | **INTEGRAR DESPUÉS** |
| **datos.gob.mx (CKAN)** | Búsqueda de datasets de justicia | Consulta de catálogos estadísticos gubernamentales | $0 USD (API Pública CKAN) | Baja (REST GET JSON) | **NULO** | Media (Plataforma Gubernamental) | **NO INTEGRAR API** (Usar enlaces curados) |

---

## D. Evidencia del Repositorio

A continuación se listan las rutas exactas del proyecto que respaldan este análisis:

### 1. Ingesta y Extracción de Documentos PDF
* [pdfExtractor.ts](file:///C:/Users/yahir/juridico-radar/lib/pdf/pdfExtractor.ts#L1-L50): Evalúa `averageCharsPerPage < 80` y marca `needsOcr: true`, pero no ejecuta OCR.
* [documentIngestProcessor.ts](file:///C:/Users/yahir/juridico-radar/worker/documentIngestProcessor.ts#L95-L124): Utiliza `pdf-parse`. Falla con excepción si el texto es `< 10` caracteres.
* [manualImport.ts](file:///C:/Users/yahir/juridico-radar/lib/bulletins/manualImport.ts#L256): Importación manual de boletines usando `pdf-parse`.
* [JUDICIAL_BULLETINS.md](file:///C:/Users/yahir/juridico-radar/docs/JUDICIAL_BULLETINS.md#L66): Documenta explícitamente: *"PDF usa PDFParse de pdf-parse 2.4.5 y valida la firma %PDF-. No se usa OCR."*

### 2. Generación y Exportación de Documentos Legal / Templates
* [exportPdf.ts](file:///C:/Users/yahir/juridico-radar/lib/templates/exportPdf.ts#L18-L113): Genera documento HTML con script `window.print()`. No genera Buffer PDF nativo.
* [exportDocx.ts](file:///C:/Users/yahir/juridico-radar/lib/templates/exportDocx.ts#L1-L100): Genera documentos `.docx` con librería `docx`.
* [templateRenderer.ts](file:///C:/Users/yahir/juridico-radar/lib/templates/templateRenderer.ts#L1-L150): Motor de renderizado de plantillas de machotes.
* [package.json](file:///C:/Users/yahir/juridico-radar/package.json#L38-L70): Muestra dependencias activas (`docx`, `pdf-parse`, `playwright`, `cheerio`).

### 3. Modelo de Datos Prisma (Clientes, Expedientes, Boletines, Documentos)
* [schema.prisma: Client](file:///C:/Users/yahir/juridico-radar/prisma/schema.prisma#L752-L770): Modelo de clientes (`Organization`, `name`, `rfc`, `email`, `phone`, `notes`).
* [schema.prisma: Matter](file:///C:/Users/yahir/juridico-radar/prisma/schema.prisma#L771-L808): Modelo de Asunto / Expediente judicial (`title`, `caseNumber`, `court`, `jurisdiction`).
* [schema.prisma: CaseFile](file:///C:/Users/yahir/juridico-radar/prisma/schema.prisma#L810-L823): Archivos digitales del expediente (`matterId`, `fileType`, `url`, `content`).
* [schema.prisma: CaseParty](file:///C:/Users/yahir/juridico-radar/prisma/schema.prisma#L934-L945): Partes procesales (`actor`, `demandado`, `tercero`, `rfc`, `notes`).
* [schema.prisma: JudicialBulletinEntry](file:///C:/Users/yahir/juridico-radar/prisma/schema.prisma#L1051-L1095): Entrada de boletín judicial monitoreada.
* [schema.prisma: LegalDraft](file:///C:/Users/yahir/juridico-radar/prisma/schema.prisma#L1201-L1221): Machote o borrador legal generado.

### 4. Seguridad, Infraestructura y Entorno
* [urlValidation.ts](file:///C:/Users/yahir/juridico-radar/lib/security/urlValidation.ts#L1-L100): Validación SSRF de URLs descargadas por la ingesta.
* [validateRuntimeEnv.ts](file:///C:/Users/yahir/juridico-radar/scripts/validateRuntimeEnv.ts#L1-L80): Validación de variables de entorno requeridas en runtime.
* [Dockerfile](file:///C:/Users/yahir/juridico-radar/Dockerfile#L1-L60): Configuración de construcción de imagen Docker en Node 22 Alpine/Debian.

---

## E. Evaluación Detallada: API 1 — OCR.Space

### 1. Documentos Candidatos a Procesar
* Acuerdos judiciales antiguos y escaneados de juzgados locales.
* Boletines judiciales en formato imagen/PDF rasterizado.
* Promociones, demandas y anexos escaneados por clientes.
* Documentos históricos presentados en pruebas documentales.

### 2. Riesgo para el Secreto Profesional y Confidencialidad
* **Vulneración Normativa:** El artículo 36 de la Ley Reglamentaria del Artículo 5o. Constitucional (Ley de Profesiones) y los artículos 210 y 211 del Código Penal Federal imponen la obligación estricta del secreto profesional. Transmitir expedientes, nombres de partes, estrategias litigiosas y contratos a servidores de OCR.Space (ubicados en EE.UU./Europa) sin un contrato DPA empresarial con cláusulas de confidencialidad verificables constituye un alto riesgo de fuga de datos.
* **Términos de OCR.Space:** En su plan gratuito, los archivos procesados se almacenan temporalmente en sus servidores para extracción y logs. OCR.Space no ofrece acuerdos DPA firmados para el nivel gratuito.

### 3. Comparativa: OCR.Space (Cloud) vs Tesseract / OCRmyPDF (Local)

```
[ PDF Escaneado ] ──► Validar Capa Texto ──► (¿Tiene texto?) ──YES──► Extracción Directa (pdf-parse)
                                 │
                                NO
                                 ▼
                     ┌───────────────────────┐
                     │ OCR Engine Selector   │
                     └───────────┬───────────┘
                                 │
               ┌─────────────────┴─────────────────┐
               ▼                                   ▼
    ❌ OCR.Space (Cloud)               ✅ Tesseract 5 / OCRmyPDF (Local)
    - Transmite datos a la nube         - 100% de datos dentro de Render/Docker
    - Límite 500 req/día                - Ilimitado (sin costo de API)
    - Riesgo de secreto profesional     - Cero riesgo de confidencialidad
    - Dependencia de red (3-10s)        - Latencia contenida en worker asíncrono
```

### 4. Infraestructura Requerida para Solución Local
Para integrar Tesseract en Jurídico Radar sin salir del servidor:
1. **Paquetes en Dockerfile:**
   ```dockerfile
   RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-spa poppler-utils
   ```
2. **Cola asíncrona dedicada en BullMQ:** El procesamiento OCR consume uso de CPU y memoria (~200MB a 400MB por documento). Debe procesarse exclusivamente dentro de `worker/documentIngestProcessor.ts` con una concurrencia limitada (`concurrency: 1` o `2` según la memoria RAM disponible en Render).
3. **Métrica de Calidad del OCR:**
   * Calcular el promedio de caracteres por página (`averageCharsPerPage >= 80`).
   * Evaluar el nivel de confianza de Tesseract (`confidence score > 75%`).

---

## F. Evaluación Detallada: API 2 — iLoveAPI / iLovePDF

### 1. Operaciones Solicitadas vs Solución Técnica

| Operación Requerida | ¿Necesaria en Radar? | iLoveAPI (Cloud SaaS) | Solución Local Preferida | Implementación Local |
| :--- | :--- | :--- | :--- | :--- |
| **Unir PDF (Merge)** | SÍ (Demanda + Anexos) | `POST /v1/process` | **`pdf-lib`** (`PDFDocument.create()`) | `pdfDoc.copyPages()` |
| **Dividir PDF (Split)** | SÍ (Extraer acuerdos) | `POST /v1/process` | **`pdf-lib`** | `pdfDoc.addPage()` por rangos |
| **Marca de Agua** | SÍ ("Copia de Trabajo") | `POST /v1/process` | **`pdf-lib`** | `page.drawText()` / `drawPage()` |
| **Numeración de Folios** | SÍ (Folio judicial) | `POST /v1/process` | **`pdf-lib`** | `page.drawText('Folio N')` |
| **Imágenes a PDF** | SÍ (Pruebas fotográficas) | `POST /v1/process` | **`pdf-lib`** | `pdfDoc.embedJpg()` / `embedPng()` |
| **Office (.docx) a PDF** | SÍ (Exportar machotes) | `POST /v1/process` | **Playwright / LibreOffice** | `page.pdf()` de Playwright (ya instalado) |

### 2. Riesgo y Costos de Dependencia Externa
* **Fuga de Expedientes Digitales:** Al compilar un expediente final, se enviarían decenas de páginas con datos procesales a iLovePDF.
* **Riesgo de Exposición de Claves:** Si la clave `ILOVEDEV_SECRET_KEY` se filtrara o se usara por error en el cliente Next.js, terceros podrían consumir la cuota de la cuenta.
* **Costo de Dependencia:** En producción con alto volumen, el esquema de iLoveAPI cobra por crédito/archivo procesado. La solución local con `pdf-lib` tiene costo **$0 USD**.

---

## G. Evaluación Detallada: API 3 — INEGI (Indicadores y DENUE)

### 1. Banco de Indicadores
* **Caso de Uso Relevante:** Consulta de variaciones del Índice Nacional de Precios al Consumidor (INPC) para actualizar cuantías judiciales o indemnizaciones laborales/civiles.
* **Decisión:** Postergar integración hasta que exista una pantalla específica de *Cálculos Judiciales*.

### 2. Directorio Nacional de Establecimientos Económicos (DENUE)
* **Caso de Uso Relevante:** Al dar de alta una empresa cliente (`Client`) o una contraparte demandada (`CaseParty`), se consulta el DENUE por nombre comercial o RFC para autocompletar:
  * Razón social / Nombre comercial.
  * Actividad económica principal (SCIAN).
  * Estrato de personal ocupado (tamaño de la empresa).
  * Domicilio público registrado y coordenadas para mapa interactivo.

### 3. Marco de Advertencia Legal Obligatorio (Disclaimer UI)
Debido a que el DENUE es un registro estadístico y no registral/procesal, la interfaz de Jurídico Radar **debe mostrar el siguiente aviso legal obligatorio** al consultar datos del DENUE:

> ⚠️ **Aviso Legal e Informativo (INEGI DENUE):**  
> La información mostrada proviene del Directorio Nacional de Establecimientos Económicos del INEGI. Este registro es de carácter puramente estadístico e informativo. **No acredita personalidad jurídica, propiedad, representación legal, validez registral, situación fiscal (RFC), ni constituye domicilio procesal legal para notificaciones judiciales.**  
> *Fuente: INEGI DENUE API. Fecha de consulta: [DD/MM/AAAA]*

---

## H. Evaluación Detallada: API 4 — datos.gob.mx (CKAN API)

### 1. Análisis Técnico y de Evidencia
Se ejecutaron consultas reales a la API CKAN de datos.gob.mx (`https://www.datos.gob.mx/api/3/action/package_search?q=justicia`).
* **Resultados Obtenidos:** 32 conjuntos de datos encontrados.
* **Ejemplos de Datasets Retornados:**
  1. *Planes de Justicia y Desarrollo Regional* (INPI) — Archivo CSV actualizado en 2026.
  2. *Presupuesto aprobado por Centro de Justicia para las Mujeres (CJM)* (Secretaría de las Mujeres) — Archivo CSV.
  3. *Población penitenciaria vulnerable y de origen extranjero* (Prevención y Reinserción Social) — Archivos CSV mensuales/anuales.

### 2. Matriz de Evaluación frente al Núcleo de Jurídico Radar

```
¿Reemplaza el DOF o SIDOF? ──────────► NO (Son reportes estadísticos CSV estáticos)
¿Reemplaza el SJF o SCJN? ──────────► NO (No contiene jurisprudencia ni tesis)
¿Reemplaza el SISE o Boletines? ────► NO (No contiene seguimiento de expedientes)
¿Actualización en tiempo real? ─────► NO (Actualización anual o irregular)
```

* **Conclusión basada en Evidencia:** datos.gob.mx no debe integrarse como un pipeline automatizado de ingesta en tiempo real. En su lugar, el proyecto puede mantener un catálogo estático de enlaces a datos abiertos para investigación jurídica.

---

## I. Bitácora de Pruebas de APIs y Endpoints

* **Fecha de Ejecución:** 2 de agosto de 2026.
* **Entorno de Pruebas:** Local / Sandbox de Antigravity AI (sin alteración de BD de producción ni credenciales sensibles).

| Servicio / Endpoint | Parámetros / Payload | Respuesta HTTP | Tiempo Resp. | Resultado Obtenido | Observaciones y Límites |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **datos.gob.mx (CKAN)**<br>`/api/3/action/package_search` | `q=justicia` | `200 OK` | ~712 ms | `success: true`, 32 datasets retornados. Datasets estáticos CSV (INPI, CEAV, PRS). | Sin datos de seguimiento procesal en vivo. Solo metadatos CKAN. |
| **INEGI DENUE Doc**<br>`/servicios/api_denue.html` | GET Página Oficial | `200 OK` | ~450 ms | Documentación oficial confirmada. Requiere Token de consulta. | Token gratuito con tasa de refresco estándar. |
| **OCR.Space API Doc**<br>`/ocrapi` | GET Especificación | `200 OK` | ~380 ms | Confirmados límites de plan gratuito: 500 req/día, máximo 5MB. | Los datos se procesan en la nube. No apto para datos confidenciales. |
| **iLoveAPI Docs**<br>`/docs/api-reference` | GET Especificación | `200 OK` | ~410 ms | Confirmada arquitectura REST. Exige credenciales secretas. | Requiere subir archivos completos a iLovePDF. |

---

## J. Diseño Técnico Recomendado

Para las capacidades viables identificadas, se define el siguiente diseño de arquitectura dentro de la estructura actual del repositorio:

```
                                  JURÍDICO RADAR ARCHITECTURE
                                  
     ┌──────────────────────────────────────────────────────────────────────────────────┐
     │                                 FRONTEND (Next.js)                               │
     └─────────────────────────┬──────────────────────────────┬─────────────────────────┘
                               │                              │
                               ▼                              ▼
                 ┌───────────────────────────┐  ┌───────────────────────────┐
                 │  /api/documents/process   │  │    /api/clients/lookup    │
                 └─────────────┬─────────────┘  └─────────────┬─────────────┘
                               │                              │
                               ▼                              ▼
                 ┌───────────────────────────┐  ┌───────────────────────────┐
                 │    PDF & OCR Service      │  │     DENUE Adapter Service │
                 │ (`pdf-lib` + Tesseract)   │  │    (Con caché Redis)     │
                 └─────────────┬─────────────┘  └─────────────┬─────────────┘
                               │                              │
                               ▼                              ▼
                 ┌───────────────────────────┐  ┌───────────────────────────┐
                 │ BullMQ Processing Queue   │  │   INEGI DENUE Public API  │
                 │   (Worker Local Node 22)  │  │   (HTTPS + User-Agent)    │
                 └───────────────────────────┘  └───────────────────────────┘
```

### 1. Motor Local de PDF y OCR (Sin APIs Externas)
* **Librerías:** `pdf-lib` (procesamiento nativo de PDF) + `tesseract-ocr` (binario en worker local).
* **Ubicación en Código:**
  * Componente de manipulación PDF: [lib/pdf/pdfManipulator.ts](file:///C:/Users/yahir/juridico-radar/lib/pdf/pdfManipulator.ts) *(Nuevo archivo propuesto)*.
  * Adaptador OCR Local: [lib/pdf/tesseractLocal.ts](file:///C:/Users/yahir/juridico-radar/lib/pdf/tesseractLocal.ts) *(Nuevo archivo propuesto)*.
* **Integración en Worker:** Modificar [worker/documentIngestProcessor.ts](file:///C:/Users/yahir/juridico-radar/worker/documentIngestProcessor.ts#L97) para que cuando `text.length < 10` después de `pdf-parse`, invoque el pipeline local de Tesseract antes de enviar a Dead Letter Queue.

### 2. Adaptador INEGI DENUE (PoC Opcional para Clientes/Partes)
* **Ubicación en Código:** [lib/sources/denueAdapter.ts](file:///C:/Users/yahir/juridico-radar/lib/sources/denueAdapter.ts) *(Nuevo archivo propuesto)*.
* **Estrategia de Caché:** Guardar respuestas de búsqueda en Redis (`denue:search:{hash}`) con TTL de 30 días para evitar llamadas innecesarias a la API del INEGI.
* **Variables de Entorno Requeridas en `.env`:**
  ```env
  INEGI_DENUE_TOKEN=tu_token_oficial_inegi
  ENABLE_DENUE_LOOKUP=false
  ```
* **Feature Flag Guard:** Controlado mediante `ENABLE_DENUE_LOOKUP`. Si es `false`, los endpoints internos retornan respuesta vacía sin realizar llamadas remotas.

---

## K. Plan de Implementación por Fases

```
[ Fase 1: Investigación & Auditoría ] (COMPLETADO)
                │
                ▼
[ Fase 2: Implementación de Manipulación Local PDF (pdf-lib) ]
  - Instalar pdf-lib
  - Crear utilidades de unión/división/marcas de agua para Expedientes
                │
                ▼
[ Fase 3: Integración de Motor OCR Local (Tesseract 5 en Docker) ]
  - Añadir tesseract-ocr y poppler-utils al Dockerfile
  - Integrar fallback OCR en worker/documentIngestProcessor.ts
                │
                ▼
[ Fase 4: PoC Aislada de INEGI DENUE (Feature Flagged) ]
  - Registrar token oficial en INEGI
  - Crear denueAdapter.ts con caché en Redis y Disclaimer Modal en Frontend
                │
                ▼
[ Fase 5: Pruebas, Verificación y Activación Progresiva ]
  - Pruebas unitarias de manipulación PDF y fallback OCR
  - Verificación de no-fuga de datos y rendimiento de memoria
```

---

## L. Veredicto Final y Respuestas Directas

1. **¿Cuál de las cuatro opciones aporta más valor real al producto?**  
   Ninguna de las APIs cloud externas analizadas (OCR.Space o iLoveAPI) supera el valor de implementar la funcionalidad equivalente de forma **local**. En cuanto a fuentes de datos, **INEGI DENUE** es la única API que aporta un valor práctico complementario para autocompletar y verificar datos informativos de empresas clientes y partes procesales.

2. **¿Cuál presenta el mayor riesgo de seguridad y privacidad?**  
   **OCR.Space** e **iLoveAPI**. Ambas exigen transmitir archivos PDF completos (demandas, contratos, acuerdos) a servidores de terceros en la nube, lo que rompe la confidencialidad procesal y el secreto profesional.

3. **¿Cuáles deben reemplazarse por soluciones locales?**  
   * **OCR.Space** debe reemplazarse por **Tesseract OCR v5 + Poppler** en la infraestructura del worker.
   * **iLoveAPI** debe reemplazarse por **`pdf-lib` + `docx` + Playwright** en Node.js.

4. **¿INEGI o datos.gob.mx ayudan al objetivo principal de vigilancia jurídica?**  
   **No directamente.** El núcleo de Jurídico Radar es la vigilancia de acuerdos, boletines judiciales, jurisprudencia y cambios normativos. Ni INEGI ni datos.gob.mx proporcionan alertas procesales o boletines de juzgados. INEGI DENUE solo ayuda como herramienta secundaria de enriquecimiento de clientes.

5. **¿Alguna de las APIs permite vigilar boletines o expedientes directamente?**  
   **Ninguna.** Los boletines y expedientes judiciales se deben seguir vigilando mediante los conectores y scrapers oficiales ya construidos en `lib/ingest/` y `lib/bulletins/`.

6. **¿Cuál puede implementarse sin comprometer documentos de clientes?**  
   **INEGI DENUE**, ya que solo recibe cadenas de texto públicas (nombre comercial o categoría de empresa) y devuelve datos de directorio público, sin enviar jamás archivos ni documentos de clientes.

7. **¿Cuáles deben descartarse definitivamente?**  
   Se descartan **iLoveAPI** y **OCR.Space (Cloud)** para el entorno de producción. También se descarta la ingesta automatizada en tiempo real de la API de **datos.gob.mx**.

8. **¿Cuál es el orden correcto de implementación recomendado?**  
   1. **`pdf-lib` (Local):** Incorporación inmediata para manipulación de expedientes.  
   2. **Tesseract OCR (Local):** Configuración en Docker y worker de ingesta.  
   3. **INEGI DENUE (PoC):** Integración condicional con feature flag para autocompletado de partes y clientes.  

9. **¿El beneficio justifica el mantenimiento y la dependencia externa?**  
   Para OCR.Space e iLoveAPI, **no justifica en absoluto** la dependencia ni el riesgo. Para INEGI DENUE, **sí se justifica** como una consulta HTTP ligera y opcional protegida por caché Redis.
