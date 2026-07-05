# Prompt y checklist: móvil

```text
Audita la aplicación <Android/iOS/Flutter/Kotlin/React Native> para producción y publicación. No cambies configuración de firma ni credenciales. Detecta framework, variantes y targets antes de recomendar.

Entrega bloqueadores de tienda, seguridad, estabilidad, accesibilidad y rendimiento; incluye comandos de verificación seguros y evidencia faltante.
```

- [ ] Signing/entitlements/keystore fuera del repo
- [ ] Permisos mínimos y disclosures consistentes
- [ ] Keychain/Keystore para tokens; sin secretos embebidos
- [ ] TLS, pinning solo con estrategia de rotación y logs redactados
- [ ] Deep links validados y componentes no exportados innecesariamente
- [ ] Offline/sync/retries/idempotencia
- [ ] Startup, ANR/jank, memoria, batería y tamaños
- [ ] TalkBack/VoiceOver, texto, contraste y touch targets
- [ ] Crash reporting, símbolos/source maps y privacidad
- [ ] Data Safety/Privacy Labels, política y eliminación de cuenta
- [ ] Tests unitarios, UI y dispositivos/versiones soportadas
- [ ] Rollout gradual y rollback de versión/API

