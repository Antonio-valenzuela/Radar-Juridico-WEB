# Demo Juridico Radar

## Objetivo

Demostrar que Juridico Radar ayuda a un abogado a investigar una pregunta aunque no conozca rutas internas.

## Preparacion

1. Levantar servicios:
   ```bash
   docker compose up -d postgres redis backend frontend worker
   ```
2. Abrir:
   ```text
   http://localhost:3100
   ```
3. Confirmar salud:
   ```text
   http://localhost:3100/api/health
   ```

## Demo en 7 pasos

1. Dashboard
   - Confirmar que se ven accesos a Radar, Busqueda y Agregar link juridico.

2. Agregar link juridico
   - Entrar a `/admin/ingest/manual-url`.
   - Pegar una URL oficial del DOF, SCJN, SJF o Camara de Diputados.
   - Procesar.
   - Resultado esperado: `stored` o cuarentena explicada, nunca error crudo.

3. Busqueda Avanzada
   - Entrar a `/search`.
   - Buscar:
     ```text
     derecho familiar
     ```
   - Resultado esperado: documentos locales reales si existen; si una fuente falla, mostrar parcial/timeout y acciones utiles.

4. RAG
   - Entrar a `/rag`.
   - Preguntar:
     ```text
     derecho familiar
     ```
   - Resultado esperado: respuesta en lenguaje natural con fuentes, no JSON tecnico.

5. Radar Legal
   - Entrar a `/rag` o al modulo Radar Legal.
   - Buscar:
     ```text
     derecho familiar
     ```
   - Resultado esperado: resultado, parcial o error controlado con reintento; nunca carga infinita.

6. Reporte IA
   - Desde busqueda o Radar, generar reporte legal IA.
   - Resultado esperado: la UI sale de loading aunque IA/fuentes fallen; se conserva busqueda documental.

7. Cierre
   - Mostrar fuentes consultadas, advertencias y boton para agregar nueva fuente si faltan documentos.

## Evidencia tecnica esperada

- `npm test`: 142/142 pruebas.
- `npm run build`: build exitoso.
- `/api/health`: `ok: true`, DB OK, Redis OK.
- `/api/search/advanced` con `derecho familiar`: resultados reales o estado parcial claro.
- `/api/rag/query` con `derecho familiar`: respuesta humana con fuentes indexadas.
- `/api/legal/radar` con `derecho familiar`: respuesta finita con `radarStatus`, no loading infinito.
