# Informe de UX y usabilidad — Jurídico Radar

## Alcance
Este informe revisa la experiencia del usuario en el Centro Jurídico y, en particular, en la ruta de boletines judiciales y los flujos relacionados. La revisión se basa en la implementación actual en los componentes del proyecto y en la observación del despliegue público.

## Evidencia observada
- La ruta pública https://radar-juridico.onrender.com/legal-hub/boletines devolvió una pantalla de carga de Render con estado 503, lo que indica un problema de disponibilidad o arranque en producción.
- El hub legal está implementado principalmente en [app/legal-hub/page.tsx](app/legal-hub/page.tsx) y los submodulos asociados en [app/legal-hub/boletines/page.tsx](app/legal-hub/boletines/page.tsx), [app/legal-hub/leyes-vigentes/page.tsx](app/legal-hub/leyes-vigentes/page.tsx), [app/legal-hub/jurisprudencia/page.tsx](app/legal-hub/jurisprudencia/page.tsx), [app/legal-hub/expedientes/page.tsx](app/legal-hub/expedientes/page.tsx) y [app/legal-hub/cambios/page.tsx](app/legal-hub/cambios/page.tsx).
- El panel de seguimiento de boletines está muy cargado de acciones en [app/components/BulletinWatchPanel.tsx](app/components/BulletinWatchPanel.tsx) y el flujo de seguimiento en [app/legal-hub/boletines/page.tsx](app/legal-hub/boletines/page.tsx).

## Hallazgos principales

### 1) Problemas de disponibilidad y tiempo de carga
**Impacto:** muy alto
**Esfuerzo:** medio

- El despliegue publicado muestra un arranque lento y, en el momento de la revisión, una pantalla de espera/503. Eso convierte cualquier intento de uso en una experiencia de “mala señal” antes de empezar.
- El flujo de boletines carga varias fuentes de datos y, en la implementación, exige estados de carga y manejo de errores separados. Esto puede generar sensación de latencia y de falta de control.

**Mejoras recomendadas**
- Priorizar estabilidad de arranque y tiempos de respuesta de la ruta principal del hub legal.
- Añadir estados de carga más claros, con mensajes de “cargando datos” y “reintento automático” en lugar de pantallas vacías o fallos silenciosos.
- Reducir el número de peticiones iniciales en la pantalla de boletines y de expedientes.

### 2) Demasiados clics para llegar a una acción simple
**Impacto:** alto
**Esfuerzo:** medio

- El Centro Jurídico presenta demasiadas entradas de alto impacto: botones principales, tabs, tarjetas y enlaces secundarios. El usuario debe “descifrar” qué camino es el correcto.
- En la pantalla de boletines, el usuario debe completar un formulario, revisar alertas y luego ejecutar acciones por cada seguimiento. Hay demasiadas opciones sin una ruta recomendada.
- El panel de expedientes mezcla creación, edición, detalle, eliminación y gestión de partes/actuaciones en una interfaz muy densa.

**Mejoras recomendadas**
- Definir una ruta principal por tarea: “vigilar”, “buscar”, “redactar”, “gestionar expediente”.
- Reducir los botones de primer nivel a un máximo de 3-4 acciones claras.
- Convertir los flujos complejos en asistentes de 3 pasos con un “siguiente” claro.

### 3) Terminología y etiquetas poco claras
**Impacto:** alto
**Esfuerzo:** bajo

- Hay mezcla de nombres y conceptos: “Boletines Judiciales (Rastreo API)”, “Boletín judicial federal”, “Boletín general del CJF”, “Boletín judicial del estado”, “Seguimiento de expedientes y actuaciones”. Eso dificulta distinguir qué hace cada módulo.
- En la pantalla de boletines aparecen campos como “Abogado autorizado” y “Fuente Judicial” sin contexto de uso real para un abogado en una jornada diaria.
- El hub presenta textos promocionales y técnicos, pero no siempre un lenguaje orientado a la decisión del usuario.

**Mejoras recomendadas**
- Renombrar los módulos con términos más explícitos del trabajo jurídico: “Vigilar expedientes”, “Consultar jurisprudencia”, “Redactar escritos”, “Revisar cambios normativos”.
- Reemplazar etiquetas genéricas por frases de acción y contexto.

### 4) Flujos incompletos o demasiado cargados para una tarea práctica
**Impacto:** alto
**Esfuerzo:** medio

- En boletines, la experiencia está orientada a la configuración técnica, no al resultado esperado: crear seguimiento, revisar resultados, ejecutar manualmente, pausar, editar, eliminar. Falta un resultado claro en pantalla desde el primer vistazo.
- En expedientes, el usuario debe interactuar con varios formularios y prompts administrativos, lo que rompe el ritmo de trabajo.
- En los módulos de leyes, jurisprudencia y cambios, se ven filtros y listas, pero no se ve un “siguiente paso” evidente una vez encontrado el dato.

**Mejoras recomendadas**
- Mostrar un resumen de “estado del seguimiento” en la vista principal de boletines: activo, sin coincidencias, requiere revisión, error.
- Añadir un flujo “crear → revisar → confirmar” para cada seguimiento.
- En lugar de obligar a navegar a varias pantallas, favorecer el “continuar desde el resultado”.

### 5) Inconsistencias visuales y mezcla de estilos
**Impacto:** medio
**Esfuerzo:** medio

- La interfaz usa estilos inline en varias páginas, lo que hace que la experiencia sea inconsistente y más difícil de mantener. Esto se ve, por ejemplo, en [app/legal-hub/boletines/page.tsx](app/legal-hub/boletines/page.tsx), [app/legal-hub/cambios/page.tsx](app/legal-hub/cambios/page.tsx) y [app/legal-hub/leyes-vigentes/page.tsx](app/legal-hub/leyes-vigentes/page.tsx).
- Los cards, botones y paneles no siguen un patrón único de jerarquía visual ni de peso de información.
- El uso de colores e iconografía es útil, pero no está alineado con un sistema claro de estado o prioridad.

**Mejoras recomendadas**
- Establecer un sistema visual único para cards, formularios, estados y acciones.
- Mover estilos complejos a clases reutilizables del CSS central en [app/globals.css](app/globals.css).

### 6) Problemas de accesibilidad y control del teclado
**Impacto:** medio
**Esfuerzo:** bajo

- Hay múltiples formularios y modales con acciones importantes. En la práctica, conviene asegurar que todos los campos tengan etiquetas explícitas y que los modales tengan foco inicial y cierre con teclado.
- Los estados de error y éxito están presentes, pero no siempre están bien asociados a los campos o al contexto del componente.
- En pantallas con muchos botones, la navegación por teclado puede volverse más compleja.

**Mejoras recomendadas**
- Asignar `label` con `htmlFor` donde aplique.
- Asegurar foco inicial y retorno al disparador en modales.
- Añadir anuncios accesibles para mensajes de éxito/error.

## Propuesta de mejoras priorizadas

| Prioridad | Mejora | Impacto | Esfuerzo |
|---|---|---:|---:|
| P1 | Resolver la disponibilidad y el tiempo de carga del hub legal en producción | Muy alto | Medio |
| P1 | Reducir la cantidad de entradas y clics en el Centro Jurídico | Muy alto | Medio |
| P1 | Simplificar el flujo de boletines para que el usuario vea primero estados y resultados | Muy alto | Medio |
| P2 | Renombrar módulos y acciones con lenguaje orientado a tareas jurídicas | Alto | Bajo |
| P2 | Unificar patrones visuales y estados en cards, formularios y botones | Alto | Medio |
| P3 | Mejorar accesibilidad de formularios, modales y mensajes | Medio | Bajo |
| P3 | Añadir ayudas contextuales y estados vacíos más claros | Medio | Bajo |

## Recomendación de orden de trabajo
1. Corregir disponibilidad y carga del hub legal.
2. Simplificar navegación y reducir clics innecesarios.
3. Clarificar los flujos de seguimiento y expediente.
4. Unificar la interfaz visual y mejorar accesibilidad.
5. Solo entonces sumar nuevas funcionalidades.

## Conclusión
Antes de añadir nuevas funciones, conviene que el producto sea más predecible, más rápido y más claro en el día a día del usuario jurídico. El mayor problema no es la falta de funciones, sino la dificultad para saber qué hacer en el siguiente paso y la sensación de que el sistema requiere demasiada configuración para obtener un resultado útil.
