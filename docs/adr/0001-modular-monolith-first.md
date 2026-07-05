# ADR 0001: Monolito modular primero

## Status

Accepted

## Context

Juridico Radar es desarrollado por una persona y necesita demostrar valor end-to-end: ingesta, clasificacion, busqueda, alertas, dashboard e IA aplicada. Separar todo en microservicios desde el inicio elevaria el costo operativo sin mejorar el aprendizaje principal.

## Decision

Usar un monolito modular con Next.js App Router, Prisma/PostgreSQL y workers BullMQ. Los dominios viven separados por modulo (`ingest`, `sources`, `normas`, `consultant`, `notifications`, `metrics`, `search`) y se desacoplan con colas cuando la operacion es lenta o riesgosa.

## Consequences

El MVP avanza rapido, comparte tipos y reduce DevOps. El riesgo es acoplamiento interno; se mitiga con modulos pequenos, contratos claros, pruebas de dominio y colas por responsabilidad. Los servicios se extraeran solo cuando volumen, ownership o requisitos enterprise lo justifiquen.
