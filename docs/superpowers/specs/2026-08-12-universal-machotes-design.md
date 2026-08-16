# Motor Universal de Machotes

## Objetivo

Convertir Machotes en un flujo único de producción documental: solicitud libre, fuentes verificadas, análisis trazable, estructura dinámica, generación modular, edición protegida, validación, persistencia y exportación.

## Límites

- La implementación se mantiene en Next.js, TypeScript y Prisma; no añade servicios Python ni publica en Render.
- El expediente 800/2024 es una prueba de estrés, no una regla de negocio.
- DOCX y PDF son renderizados del `UniversalLegalDocument`; el documento estructurado es la fuente maestra.

## Arquitectura

1. `DocumentSource` representa una fuente cargada: texto completo, páginas, calidad, validación y procedencia.
2. Un pipeline de servidor clasifica, compone contexto relevante, analiza hechos con referencias, genera estructura, genera secciones y valida.
3. Cada bloque generado conserva capa, nivel de confianza y referencias `documento → página → fragmento`.
4. El cliente únicamente coordina el flujo y edita el documento; no ejecuta análisis jurídico ni inventa progreso.
5. `LegalDraft.structuredDoc` conserva el documento, fuentes, estado y revisiones. `LegalTemplate` conserva una estructura reusable y versionada.

## Reglas de seguridad jurídica

- Una fuente sin `sourceValidated` bloquea el análisis y la generación salvo una confirmación explícita `allowUnvalidatedSource` que deja advertencia persistente.
- La entrada completa se indexa y recupera por relevancia; ninguna ruta usa `slice()` como sustituto de recuperación.
- Los campos sin fuente se escriben como `[DATO_PENDIENTE: ...]`; fundamentos no comprobados como `[NO_VERIFICADO: ...]`.
- Una sección o bloque editado manualmente no se reemplaza al regenerar; la respuesta devuelve una advertencia y conserva el texto.
- No existe una etapa completa sin resultado material asociado.

## Flujo

`indicación → clasificación → carga/extracción/OCR → validación → AutoContext/RAG → análisis → estructura → generación por sección → editor → validación → guardar → DOCX/PDF`.

## Verificación

Las pruebas cubren fuentes largas, validación, selección contextual, trazabilidad, manual edits, persistencia y los cuatro tipos universales. La prueba funcional usa los dos PDFs aportados cuando el entorno local permite carga autenticada.
