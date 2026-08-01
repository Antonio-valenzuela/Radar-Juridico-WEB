# Adaptador del Boletín Judicial de Jalisco

## Evidencia técnica observada el 1 de agosto de 2026

Portal inspeccionado:

`https://ciudadano.cjj.gob.mx/boletin_judicial/consultar`

La interfaz es una aplicación React y cargó:

- `https://ciudadano.cjj.gob.mx/static/js/main.5f2d7e02.chunk.js`
- `https://www.google.com/recaptcha/api.js?...`

Fetch/XHR observados directamente al abrir el portal y seleccionar **Civil**:

| Método | URL | Resultado observado |
|---|---|---|
| GET | `https://nilo.cjj.gob.mx/api/v1/app_config` | JSON público del cliente |
| GET | `https://nilo.cjj.gob.mx/api/v1/matters/get_all_matters` | JSON: `data.matters`; Civil tiene `value=2` |
| GET | `https://nilo.cjj.gob.mx/api/v1/courts_matters/courts_parties/2` | JSON: `data.options`; 33 partidos judiciales |

El bundle oficial confirmó además que su propia interfaz construye:

| Método | Ruta |
|---|---|
| GET | `/courts/get_list/{districtId}/{subjectId}` |
| GET | `/electronic_expedients/find/{expediente}/{courtId}/{subjectId}` |
| GET | `/electronic_expedients/by_date/{courtId}/{year}/{month}/{day}/{subjectId}` |

El cliente agrega `Authorization: btoa("alpha1")` (`YWxwaGEx`) en las rutas públicas. No se observaron cookies de sesión ni CSRF para los catálogos. La acción de búsqueda, sin embargo, está condicionada por reCAPTCHA invisible en la interfaz.

`robots.txt` respondió 404 con el shell de la aplicación. El endpoint público de términos respondió 200, pero esto no constituye autorización para automatizar búsquedas protegidas.

## Clasificación

- `PUBLIC_JSON_ENDPOINT`: catálogos y rutas JSON consumidos por la interfaz.
- `JAVASCRIPT_REQUIRED`: el flujo visible depende de React.
- `CAPTCHA_PRESENT`: la búsqueda exige reCAPTCHA.
- `AUTH_REQUIRED`/`MANUAL_REVIEW`: política operativa actual.

No se envió una consulta final ni se resolvió/eludió el CAPTCHA. Tampoco se usaron expedientes reales.

## Política del adaptador

Los catálogos se validan con Zod. La consulta automática está desactivada por defecto y devuelve `AUTH_REQUIRED` con publicación `UNKNOWN`. Una coincidencia de `/electronic_expedients/find/...` sólo demuestra que existe el expediente electrónico: se clasifica `MANUAL_REVIEW` y nunca `PUBLISHED`.

El parser del boletín diario se prueba con fixtures sanitizados. La suite normal no llama al portal. Las pruebas de contrato en vivo deben permanecer opt-in:

```env
RUN_LIVE_JALISCO_BULLETIN_TESTS=false
```

## Qué hacer si cambia el portal del CJJ

1. Establecer `BULLETIN_MONITOR_ENABLED=false`.
2. Marcar la fuente como `SOURCE_CHANGED`.
3. Usar importación manual PDF/texto/URL.
4. Capturar nuevamente el tráfico Fetch/XHR sin datos personales.
5. Revisar método, URL, parámetros, headers, CAPTCHA y esquema JSON/HTML.
6. Actualizar schemas Zod y fixtures sanitizados.
7. Ejecutar pruebas unitarias, Prisma, typecheck, lint y build.
8. Reactivar únicamente después de una revisión jurídica y técnica explícita.
