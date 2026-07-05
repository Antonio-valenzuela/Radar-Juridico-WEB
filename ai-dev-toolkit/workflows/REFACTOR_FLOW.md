# Workflow: refactor seguro

1. Define la deuda y el comportamiento que debe permanecer idéntico.
2. Mapea callers, dependencias y contratos públicos.
3. Añade pruebas de caracterización para caminos críticos y errores.
4. Divide el refactor en extracciones pequeñas y compilables.
5. Ejecuta pruebas después de cada extracción.
6. Elimina código solo cuando no tenga callers y el reemplazo esté verificado.
7. Compara rendimiento y tamaño si el motivo era operativo.
8. Documenta migración y rollback si cambia una interfaz.

Evita reescrituras simultáneas, cambios de nombres masivos y “limpieza” no relacionada.

