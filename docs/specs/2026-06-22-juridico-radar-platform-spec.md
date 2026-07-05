# Jurídico Radar — Especificación de estabilización y evolución integral

**Estado:** Propuesta aprobada conceptualmente  
**Fecha:** 2026-06-22  
**Alcance:** Reparación de búsqueda e ingesta, seguida por evolución a plataforma profesional de inteligencia jurídica multiusuario.

## 1. Objetivo

Convertir Jurídico Radar en una plataforma confiable para detectar, analizar, explicar y organizar cambios jurídicos. La implementación debe conservar la arquitectura existente basada en Next.js, Prisma/PostgreSQL, Redis y BullMQ, evitar pérdida de datos y entregar valor utilizable al final de cada fase.

## 2. Principios

- No reescribir el sistema completo ni duplicar su arquitectura actual.
- Separar operaciones rápidas de procesos costosos o dependientes de servicios externos.
- Devolver resultados parciales útiles en vez de transformar un timeout en “sin resultados”.
- Mantener trazabilidad desde cada conclusión hasta su fuente oficial.
- Aislar datos por organización y aplicar permisos en el servidor.
- Ejecutar migraciones incrementales; no usar resets destructivos sobre datos existentes.
- Incorporar pruebas antes o junto con cada reparación.

## 3. Arquitectura objetivo

El sistema se organizará por dominios sobre la aplicación existente:

- **Search:** búsqueda local, federada e híbrida; contratos de resultados y timeouts.
- **Ingestion:** descarga segura, parsing, normalización, clasificación y cuarentena.
- **Reports:** generación asíncrona de análisis y resúmenes jurídicos.
- **Matters:** organizaciones, clientes, asuntos, expedientes y documentos asociados.
- **Monitoring:** watchlists, relevancia, alertas y entregas.
- **Documents:** versiones, comparación normativa, evidencias y exportaciones.
- **Identity:** membresías, roles y autorización multi-organización.
- **Audit/Observability:** eventos de auditoría, métricas, salud y tiempos por etapa.

## 4. Búsqueda y manejo de timeouts

### 4.1 Configuración

Se centralizarán los siguientes valores:

- `SEARCH_TIMEOUT_MS=30000`
- `LEGAL_REPORT_TIMEOUT_MS=60000`
- `AI_ANALYSIS_TIMEOUT_MS=60000`
- `RAG_TIMEOUT_MS=45000`
- `SOURCE_FETCH_TIMEOUT_MS=30000`
- `EXTERNAL_SOURCE_TIMEOUT_MS=30000`

El valor `0` desactiva el timeout funcional únicamente fuera de producción. En producción se aplicará un límite seguro aunque la configuración sea inválida.

### 4.2 Contrato de respuesta

Las búsquedas devolverán un contrato estable con:

- `ok`
- `results`
- `partial`
- `timedOut`
- `warnings`
- `sources`, con estado `completed`, `timed_out` o `failed`
- `timings`, con duración total y por etapa
- paginación y facetas cuando correspondan

Una fuente lenta no descartará los resultados de otras fuentes. La UI distinguirá explícitamente:

- cero coincidencias reales;
- resultados parciales;
- timeout sin resultados;
- error técnico.

## 5. Reportes jurídicos asíncronos

La búsqueda rápida no esperará la generación mediante IA.

### API propuesta

- `POST /api/legal-reports`: valida la solicitud, crea un registro y encola el trabajo.
- `GET /api/legal-reports/[id]`: consulta estado, progreso, advertencias y resultado.
- `POST /api/legal-reports/[id]/retry`: reintenta un trabajo elegible sin duplicarlo.

Estados: `queued`, `searching`, `analyzing`, `completed`, `failed`, `cancelled`.

Los trabajos serán idempotentes, tendrán reintentos limitados y conservarán las evidencias utilizadas. Cada afirmación material del reporte deberá enlazar a uno o más documentos fuente.

## 6. Ingesta y limpieza del DOF

Flujo requerido:

1. Validar URL y descargar con protección SSRF, límite de tamaño y timeout.
2. Detectar codificación y decodificar entidades HTML.
3. Extraer el contenido jurídico principal con selectores estructurales y fallback controlado.
4. Eliminar navegación, login, scripts, estilos, avisos repetitivos y chrome del sitio.
5. Normalizar Unicode, espacios y saltos sin destruir estructura jurídica.
6. Extraer título, fecha, autoridad, tipo documental, identificadores y cuerpo.
7. Calcular calidad y clasificar el resultado.
8. Persistir contenido válido o enviar contenido dudoso a cuarentena.

Un documento se considerará ruido cuando no alcance mínimos de texto jurídico, proporción de contenido útil o metadatos verificables. La cuarentena conservará URL, contenido original, causa y fecha para revisión; no aparecerá en búsquedas normales.

## 7. Modelo de datos

Se introducirán, mediante migraciones incrementales, conceptos equivalentes a:

- `Organization`, `User`, `Membership`, `Role`
- `Client`, `Matter`, `MatterDocument`
- `DocumentVersion`, `DocumentChange`, `Evidence`
- `Watchlist`, `AlertRule`, `AlertEvent`, `AlertDelivery`
- `LegalReport`, `ReportEvidence`, `ProcessingJob`
- `IngestionQuarantine`, `AuditEvent`

Los nombres definitivos respetarán convenciones y relaciones ya presentes en `schema.prisma`. Todas las entidades de negocio deberán incluir organización, timestamps y claves/índices apropiados. Se definirán reglas de borrado conservadoras para preservar trazabilidad.

## 8. Capacidades profesionales

### 8.1 Comparador normativo

- Detectar versiones del mismo instrumento.
- Comparar por artículo o sección, no solo por líneas.
- Identificar adiciones, eliminaciones y modificaciones.
- Mostrar texto anterior, nuevo, fuente y fecha de publicación.

### 8.2 Relevancia explicable

- Puntuar coincidencia con materia, autoridad, jurisdicción, cliente, términos vigilados y temporalidad.
- Traducir la puntuación a semáforo alto/medio/bajo.
- Mostrar razones de la clasificación y permitir corrección humana.

### 8.3 Alertas

- Configurar reglas por asunto, materia, autoridad, fuente y relevancia.
- Deduplicar eventos y evitar notificaciones repetidas.
- Registrar el estado de cada entrega.
- Iniciar con notificaciones dentro de la aplicación; canales externos requerirán configuración explícita.

### 8.4 Clientes, asuntos y expedientes

- Organizar hallazgos, documentos, notas, alertas y reportes por cliente/asunto.
- Permitir asociación manual y sugerida, nunca asociación automática irreversible.
- Mantener historial de cambios y accesos sensibles.

### 8.5 Resúmenes y PDF

- Resumir impacto, obligaciones, fechas críticas, riesgos y acciones sugeridas.
- Diferenciar texto de fuente, inferencia del sistema y recomendación generada.
- Exportar PDF con portada, índice, paginación, evidencias, fecha y responsable de generación.

### 8.6 Dashboard ejecutivo

- Cambios recientes y asuntos potencialmente afectados.
- Alertas críticas y cobertura por fuente.
- Trabajos fallidos o en cuarentena.
- Actividad y métricas agregadas sin exponer información no autorizada.

## 9. Seguridad

- Autorización RBAC en rutas, servicios y consultas, no solo en componentes visuales.
- Roles iniciales: administrador, abogado, analista y lector.
- Aislamiento estricto por organización.
- Preservar y extender validaciones SSRF para toda URL externa.
- Retirar tokens administrativos del almacenamiento del navegador.
- Rate limiting, validación de entrada y límites de tamaño.
- Redacción de secretos y contenido confidencial en logs.
- Auditoría de búsquedas sensibles, exportaciones, cambios de permisos y acceso a expedientes.

## 10. Observabilidad

Cada solicitud y trabajo tendrá `requestId` o `jobId`. Se medirán al menos:

- búsqueda local;
- consulta por fuente externa;
- descarga y parsing;
- clasificación;
- análisis IA;
- persistencia;
- duración total.

El endpoint de salud verificará aplicación, PostgreSQL, Redis y colas sin revelar secretos. Los fallos deberán ser accionables y conservar la causa original.

## 11. Pruebas y aceptación

### Pruebas mínimas

- Búsqueda que tarda más de cinco segundos sin falso “sin resultados”.
- Lectura y validación de timeouts desde entorno, incluido `0` en desarrollo.
- Resultados parciales cuando una fuente expira.
- Estados visuales separados para vacío, parcial, timeout y error.
- Parsing DOF sin navegación, login, scripts ni estilos.
- Clasificación y cuarentena de páginas sin contenido jurídico real.
- Jobs idempotentes, reintentos y consulta de progreso.
- Diff normativo, relevancia explicable y deduplicación de alertas.
- Aislamiento entre organizaciones y matriz de permisos.
- Flujo E2E búsqueda → reporte → expediente → PDF.

Cada fase exige pruebas nuevas, regresión de la suite existente, TypeScript, ESLint y build exitosos. No se considerará completada una fase sin evidencia reciente de verificación.

## 12. Fases de entrega

0. Establecer baseline reproducible y pruebas de protección.
1. Timeouts configurables, resultados parciales y mensajes correctos.
2. Separar búsqueda rápida de reportes IA mediante BullMQ.
3. Limpiar DOF, validar calidad y habilitar cuarentena.
4. Implementar versiones documentales, comparador y evidencias.
5. Añadir relevancia explicable, watchlists y alertas.
6. Incorporar organizaciones, clientes, asuntos y expedientes.
7. Generar resúmenes ejecutivos y PDF profesional.
8. Completar RBAC, auditoría y dashboard ejecutivo.
9. Endurecer seguridad, observabilidad, rendimiento y pruebas integrales.

## 13. Fuera de alcance inicial

- Interpretar la salida de IA como asesoría jurídica autónoma.
- Enviar correo, WhatsApp o mensajes externos sin configuración y autorización específicas.
- Borrar o resetear la base de datos existente.
- Automatizar decisiones irreversibles sobre clientes o asuntos.
- Reemplazar fuentes oficiales por contenido generado.

## 14. Definición global de terminado

La plataforma se considera lista cuando las fases acordadas funcionan de extremo a extremo, los permisos se aplican en servidor, cada conclusión importante conserva evidencia, los fallos externos producen degradación controlada, las migraciones son reproducibles y todas las verificaciones requeridas pasan sobre el código final.
