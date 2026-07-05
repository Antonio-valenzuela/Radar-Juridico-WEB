# Puntos de control seguros

Codex no debe depender de hooks externos para garantizar seguridad. Estos checkpoints son manuales y portables.

## Antes de escribir

- Confirmar alcance y archivos autorizados.
- Revisar `git status`; preservar cambios ajenos.
- Identificar backup/rollback cuando se toca configuración o datos.
- No leer secretos salvo necesidad explícita y autorizada.

## Antes de comandos

- Clasificar como lectura, escritura reversible, escritura externa o destructiva.
- Pedir autorización para acciones externas/destructivas.
- Fijar ruta de trabajo y timeout.
- No ejecutar scripts remotos recién descargados.

## Después de editar

- Inspeccionar diff solo del alcance.
- Ejecutar la prueba más cercana y luego el gate proporcional.
- Buscar secretos, placeholders y rutas personales.
- Documentar archivos y comportamiento cambiados.

## Antes de entregar

- Separar hechos comprobados de inferencias.
- Informar fallos de verificación, no ocultarlos.
- No afirmar “listo” con checks pendientes.

