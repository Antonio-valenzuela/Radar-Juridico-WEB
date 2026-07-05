# Workflow: auditoría móvil

## Común

- Identidad, almacenamiento seguro, TLS y redacción de logs.
- Permisos mínimos y textos de justificación.
- Deep links/universal links y validación de origen.
- Offline, sincronización, reintentos e idempotencia.
- Rendimiento de arranque, memoria, batería y redes lentas.
- Accesibilidad, tamaños táctiles, escalado de texto y orientación.

## Android/Kotlin

Revisar manifest, exported components, intent filters, Network Security Config, Keystore, R8/ProGuard, target SDK, background limits y App Bundle.

## iOS/Swift

Revisar entitlements, ATS, Keychain, privacy manifests, background modes, signing, símbolos y TestFlight.

## Flutter/React Native

Revisar canales/bridges nativos, dependencias, flavors, tree shaking, source maps y coherencia de permisos por plataforma.

## Publicación

Política de privacidad, data safety/privacy labels, eliminación de cuenta, contenido, screenshots, versionado, firma y rollout gradual.

