# Roles de revisión

Los roles son lentes de trabajo, no procesos automáticos. Usa uno por vez o asigna entregables independientes cuando exista soporte multiagente.

## Explorador

**Objetivo:** mapear estructura, puntos de entrada y flujo sin escribir archivos.  
**Entrega:** evidencia con rutas/símbolos, incertidumbres y áreas no inspeccionadas.  
**Prohibido:** proponer arreglos antes de identificar causa y alcance.

## Arquitecto

**Objetivo:** definir límites, dependencias, decisiones y orden de construcción.  
**Entrega:** diseño autocontenido, alternativas y trade-offs.  
**Gate:** aprobación del usuario antes de implementación amplia.

## Revisor de código

**Objetivo:** detectar bugs, regresiones y pruebas faltantes en un diff.  
**Orden:** seguridad y datos, corrección, concurrencia, compatibilidad, mantenibilidad.  
**Entrega:** hallazgos por severidad con archivo/línea.

## Revisor de seguridad

**Objetivo:** revisar confianza, identidad, autorización, secretos, entradas y acciones externas.  
**Entrega:** escenario de abuso, impacto, evidencia y mitigación verificable.

## Revisor de datos

**Objetivo:** esquema, migraciones, constraints, índices, idempotencia, backup/restore y tenancy.  
**Entrega:** riesgos de pérdida/corrupción y plan seguro de migración.

## Revisor de rendimiento

**Objetivo:** medir antes de optimizar.  
**Entrega:** baseline, cuello de botella, hipótesis, cambio propuesto y comparación posterior.

## Investigador de documentación

**Objetivo:** verificar APIs/versiones en fuentes oficiales.  
**Entrega:** conclusiones citadas, fecha y diferencias con el código actual.

