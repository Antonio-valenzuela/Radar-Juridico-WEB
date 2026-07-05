# ADR 0003: BullMQ antes de Kafka o NATS

## Status

Accepted

## Context

La ingesta, procesamiento de PDFs, embeddings, notificaciones y metricas son asincronos. Sin embargo, el proyecto no requiere inicialmente un event bus distribuido con multiples servicios independientes.

## Decision

Usar Redis + BullMQ con colas por dominio: `ingest`, `pdf-processing`, `embeddings`, `notifications` y `failed-jobs`. Cada job debe ser idempotente y observable.

## Consequences

BullMQ reduce complejidad y soporta reintentos, backoff, scheduling y workers horizontales. Kafka/NATS/SQS se consideran cuando haya varios servicios productores/consumidores, volumen alto o necesidades enterprise de retencion/event replay.
