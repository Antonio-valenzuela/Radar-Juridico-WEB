# Diseño de Jurídico Radar

Este documento registra la identidad visual existente. No es una propuesta de
rediseño ni autoriza cambios de marca, color, tipografía o navegación.

## Base técnica

- Framework: Next.js 16 con React 19 y TypeScript.
- Estilos: hoja global `app/globals.css` y estilos puntuales por pantalla.
- Shell de aplicación: `components/layout/AppShell.tsx`.
- Datos visuales: Recharts para métricas; no hay una biblioteca de componentes
  de terceros para los controles de la aplicación.

## Navegación

`AppShell` presenta una cabecera fija de marca y un drawer lateral accesible.
El drawer agrupa navegación operativa y administración. Se abre con un botón
hamburguesa, se cierra al navegar, al tocar el fondo o con Escape. Los enlaces
activos se determinan con `usePathname`.

## Tokens de color

La fuente de verdad es `app/globals.css`.

| Rol | Token |
| --- | --- |
| Fondo | `--background: #f5f7fa` |
| Superficie | `--surface: #ffffff` |
| Superficie secundaria | `--surface-muted: #edf1f5` |
| Texto principal | `--text-primary` / `--text-main: #172230` |
| Texto secundario | `--text-secondary: #536171` |
| Marca primaria | `--primary: #173b57` |
| Acento | `--accent: #0f766e` |
| Éxito, advertencia y error | `--success`, `--warning`, `--danger` |
| Foco | `--focus: #2563eb` |

No se deben introducir colores de marca nuevos. Los colores escritos en línea
en pantallas heredadas son deuda técnica a migrar gradualmente hacia estos
tokens, tras una revisión visual independiente.

## Tipografía y jerarquía

- La interfaz usa una pila `Inter`/sistema; el layout carga Geist y Geist Mono
  como variables para usos específicos.
- Títulos globales: `h1` 2.75rem/800, `h2` 1.75rem/700 y `h3` 1.25rem/600.
- Los machotes usan Georgia/Times como excepción intencional para lectura y
  presentación jurídica.

## Componentes y patrones existentes

- `container`: máximo de 1200px, margen centrado y padding base de 2rem.
- `glass-card`/`legal-card`: superficies blancas con borde, radio de 12px y
  elevación muy discreta. El nombre histórico no implica glassmorphism real.
- Botones: `btn-primary`, `btn-secondary` y variantes de acento en CSS global.
- `badge`, alertas legales, estados de fuente y tarjetas de métrica reutilizan
  los tokens globales.
- `FloatingLegalChat` es global; no se debe duplicar como asistente flotante
  por pantalla.

## Accesibilidad y móvil

El shell incluye etiquetas ARIA y Escape para el drawer. El CSS contiene
breakpoints para 980px, 991px, 640px y 600px. Todo cambio futuro debe conservar
zoom, evitar scroll horizontal y mantener controles táctiles de 44px como
mínimo. Los estados no deben depender únicamente del color.

## Inventario de deuda técnica observado

- Existen estilos en línea y valores hexadecimales puntuales en rutas como
  búsqueda, RAG y administración; no deben copiarse a código nuevo.
- La pantalla de ingesta manual define variables `--lawyer-*` locales que se
  solapan conceptualmente con los tokens globales.
- Hay nombres históricos (`glass-card`) y reglas visuales duplicadas que pueden
  consolidarse en una futura tarea específica de UI, con pruebas visuales y
  autorización explícita.

## Reglas de mantenimiento

1. Reutilizar `AppShell`, clases globales y componentes existentes antes de
   crear otro patrón visual.
2. No cambiar paleta, logotipo, tipografía, navegación ni espaciado global sin
   aprobación explícita.
3. Todo nuevo control debe tener etiqueta, foco visible, estado de carga/error
   y soporte de teclado.
4. Antes de una mejora visual, revisar este documento y `app/globals.css`.
