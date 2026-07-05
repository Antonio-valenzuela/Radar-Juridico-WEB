# ADR 0002: PostgreSQL + pgvector antes de OpenSearch

## Status

Accepted

## Context

El producto necesita busqueda textual, filtros juridicos, historial documental y busqueda semantica. Para el MVP y la version avanzada temprana, el corpus puede vivir cerca del modelo transaccional.

## Decision

Usar PostgreSQL como fuente de verdad, Full-Text Search para busqueda lexical y pgvector para embeddings. OpenSearch/Elasticsearch queda como indice especializado futuro.

## Consequences

La arquitectura es mas simple, auditable y barata. La desventaja es que facetas avanzadas, analyzers juridicos complejos y altisima concurrencia pueden exigir OpenSearch. La migracion se activa cuando p95 de busqueda, volumen de chunks o relevancia avanzada lo justifiquen.
