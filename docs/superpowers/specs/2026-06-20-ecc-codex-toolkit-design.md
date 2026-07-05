# Diseño de auditoría y toolkit de desarrollo con IA

## Objetivo

Auditar técnicamente Jurídico Radar sin modificar su código funcional y crear una caja de herramientas portátil, original y orientada a Codex, tomando ECC / Everything Claude Code únicamente como referencia conceptual.

## Alcance

- Generar `AUDITORIA_PROYECTO.md` con hallazgos comprobables, severidad, evidencia y recomendaciones.
- Descargar ECC exclusivamente en `.tmp/ecc-source` para inspección estática.
- No ejecutar scripts, hooks, comandos ni instalaciones procedentes de ECC.
- Crear `ai-dev-toolkit/` como unidad autónoma con prompts, reglas, checklists, workflows, plantillas y documentación.
- Reescribir los recursos en español y en términos compatibles con Codex; evitar copias textuales salvo nombres técnicos inevitables.
- Mantener atribución conceptual y registrar qué ideas se adaptaron o descartaron.
- Crear `docs/AI_WORKFLOW.md` con el flujo específico de trabajo seguro para Jurídico Radar.

## Límites de seguridad

- No editar código bajo `app/`, `lib/`, `worker/`, `prisma/`, `src/` o `tests/`.
- No leer ni modificar `.env`; solo se pueden analizar nombres documentados en `.env.example` y referencias estáticas en código/configuración.
- No modificar `README.md`, porque ya contiene cambios del usuario.
- No instalar dependencias ni ejecutar código remoto.
- No borrar archivos ni limpiar el árbol de trabajo.

## Arquitectura del toolkit

`ai-dev-toolkit/` se organizará por responsabilidad: agentes, habilidades, comandos conceptuales, hooks documentales (no ejecutables), reglas, prompts, checklists, seguridad, workflows, plantillas, documentación y una capa específica de Codex. Cada archivo será autocontenido, portable y utilizable por copia manual.

Los hooks se expresarán como políticas y puntos de control, no como scripts ejecutables. Los comandos serán recetas conversacionales portables, no slash commands dependientes de Claude Code. Los agentes serán perfiles de responsabilidad que Codex puede adoptar, sin asumir infraestructura multiagente.

## Método de auditoría

1. Inventario de estructura, manifiestos, configuración, persistencia y despliegue.
2. Análisis estructural con CodeGraph de rutas, autorización, multitenencia, colas, ingestión, búsqueda y proveedores de IA.
3. Comprobaciones no destructivas: lint, tipos, pruebas y build cuando no requieran secretos ni servicios externos.
4. Clasificación de hallazgos por severidad y separación clara entre hechos, riesgos e hipótesis.

## Método de adaptación de ECC

1. Inventariar categorías y archivos sin ejecutar contenido.
2. Seleccionar ideas aplicables a auditoría, seguridad, testing, investigación, revisión y gestión de contexto.
3. Reescribirlas con convenciones de Codex y restricciones seguras.
4. Descartar automatizaciones invasivas, configuraciones personales, integraciones exclusivas de Claude y contenido redundante.
5. Registrar procedencia conceptual, licencia detectada y criterios de descarte.

## Verificación

- Confirmar que solo se hayan creado documentos, `.codegraph/`, `.tmp/ecc-source` y `ai-dev-toolkit/`.
- Validar enlaces relativos y presencia de todos los archivos solicitados.
- Buscar placeholders, secretos aparentes y referencias accidentales a rutas locales.
- Ejecutar las verificaciones del proyecto sin alterar datos persistentes.

