# Workflow: reparación por fases

## 1. Reproducir

Captura comando, entrada, salida y entorno. Si no se reproduce, no adivines una solución.

## 2. Localizar causa

Traza desde el síntoma hasta la primera invariancia rota. Registra efectos secundarios aparte.

## 3. Proteger

Escribe una prueba de regresión o caracterización que falle por el motivo correcto.

## 4. Reparar mínimo

Cambia la menor superficie posible. No mezcles limpieza/refactor no relacionados.

## 5. Verificar en capas

Prueba focal → suite del módulo → tipos/lint → build → E2E si aplica.

## 6. Revisar y documentar

Inspecciona diff, riesgos, rollback y cambios de comportamiento. Si un gate falla, entrega el fallo como pendiente explícito.

