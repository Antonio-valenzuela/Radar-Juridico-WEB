# Seguimiento de Boletín Judicial

El módulo vincula una consulta de boletín con un expediente (`Matter`) mediante `CaseBulletinWatch`. Cada ejecución crea un `BulletinCheckRun`, conserva evidencia mínima y deduplica publicaciones en `JudicialBulletinEntry` por fuente, juzgado, expediente, fecha de publicación y hash de contenido.

## Fuentes y límites

- Jalisco: el portal oficial es `https://ciudadano.cjj.gob.mx/boletin_judicial/consultar`. Su interfaz pública consume catálogos de `https://nilo.cjj.gob.mx/api/v1`, pero la búsqueda visible exige reCAPTCHA. La automatización permanece desactivada y responde `AUTH_REQUIRED`; se usa revisión/importación manual. Véase `JALISCO_BULLETIN_ADAPTER.md`.
- PJF/CJF: las páginas públicas se muestran como enlaces de consulta. Si la operación exige usuario, FIREL, firma o CAPTCHA, el resultado es `AUTH_REQUIRED` y el usuario debe abrir la fuente oficial o capturar la publicación manualmente.
- TJA Jalisco: está registrado como adaptador de extensión (`TJAJAL_BULLETIN`) y devuelve `UNSUPPORTED`/`MANUAL_REVIEW` hasta confirmar una interfaz pública estable.

No se evade autenticación, CAPTCHA, robots, controles anti-bot ni se guardan credenciales, cookies de sesión o certificados.

## Estados

El sistema separa el estado técnico (`SUCCESS`, `SOURCE_UNAVAILABLE`, `SOURCE_CHANGED`, `TIMEOUT`, `RATE_LIMITED`, `AUTH_REQUIRED`, `MANUAL_REVIEW`, `PROVIDER_ERROR`) del jurídico (`NEW_PUBLICATIONS`, `HAS_PREVIOUS_PUBLICATIONS`, `NO_PUBLICATION_FOUND_AS_OF`, `UNKNOWN`). Ningún error de red ni coincidencia del expediente electrónico se interpreta como ausencia de publicación.

## Ejecución

El scheduler de BullMQ sólo se registra cuando `BULLETIN_MONITOR_ENABLED=true`. La frecuencia, timeout, reintentos, concurrencia y máximo por corrida se configuran con las variables `BULLETIN_*` del `.env.example`. El worker aplica límite de casos e idempotencia; una ejecución repetida no crea otra actuación ni otra alerta para la misma entrada.

## Revisión de calidad

La pestaña **Boletín Judicial** del detalle del expediente permite configurar la consulta, consultar ahora, activar/pausar vigilancia, revisar historial, abrir la URL oficial y descargar JSON de evidencia. Las fechas que la fuente no entregue permanecen vacías y se muestran con advertencia.
