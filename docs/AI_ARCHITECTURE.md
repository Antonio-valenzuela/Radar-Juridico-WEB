# Arquitectura de Inteligencia Artificial & RAG — Radar Jurídico

Este documento detalla la arquitectura de Inteligencia Artificial, RAG (Retrieval-Augmented Generation) e Ingesta de Documentos en **Radar Jurídico**, así como la especificación de integración de **NVIDIA Build** y **pgvector**.

---

## 1. Arquitectura de IA & RAG

```
                        ┌───────────────────────────────┐
                        │   Cliente / Interfaz Web      │
                        └──────────────┬────────────────┘
                                       │
                                       ▼
                        ┌───────────────────────────────┐
                        │    Endpoints Next.js (API)    │
                        └──────────────┬────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
     ┌──────────────────┐    ┌──────────────────┐   ┌──────────────────┐
     │  Chat / Assistant│    │ RAG & Búsqueda   │   │ Ingesta / Worker │
     └──────────┬───────┘    └─────────┬────────┘   └─────────┬────────┘
                │                      │                      │
                └──────────────────────┼──────────────────────┐
                                       │
                                       ▼
                        ┌───────────────────────────────┐
                        │    MultiModelOrchestrator     │
                        └──────────────┬────────────────┘
                                       │
                        ┌──────────────┴────────────────┐
                        │       providerSelector        │
                        └──────────────┬────────────────┘
                                       │
      ┌──────────────────┬─────────────┴──────┬──────────────────┬──────────────┐
      │                  │                    │                  │              │
      ▼                  ▼                    ▼                  ▼              ▼
┌──────────────┐  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│ NVIDIA Build │  │ Gemini API   │   │  Groq API    │   │ OpenRouter   │  │ Fallback     │
│ (Principal)  │  │ (Respaldo)   │   │ (Respaldo)   │   │ (Respaldo)   │  │ Local (Rule) │
└──────────────┘  └──────────────┘   └──────────────┘   └──────────────┘  └──────────────┘
```

---

## 2. Componentes Clave

1. **`lib/ai/providers/nvidia.ts`**: Cliente principal LLM para NVIDIA Build con timeouts de 30s y reintentos.
2. **`lib/ai/providers/nvidiaEmbeddings.ts`**: Servicio de vectorización con `nvidia/nv-embedqa-e5-v5` y caché en memoria.
3. **`lib/file/ocrPipeline.ts`**: Pipeline de discriminación rápida de PDFs escaneados vs vectoriales.
4. **`lib/search/vectorSearch.ts`**: Búsqueda vectorial por similitud coseno con `pgvector`.
5. **`lib/ai/providerSelector.ts`**: Selección dinámica basada en capacidad y salud del proveedor.
6. **`lib/ai/orchestrator.ts`**: Cascada de tolerancia a fallos: `nvidia` $\rightarrow$ `gemini` $\rightarrow$ `groq` $\rightarrow$ `openrouter` $\rightarrow$ `local`.

---

## 3. Configuración de Entorno

```bash
NVIDIA_API_KEY="nvapi-..."
NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1"
GLM_MODEL="thudm/glm-4-9b-chat"
EMBEDDING_MODEL="nvidia/nv-embedqa-e5-v5"
OCR_MODEL="meta/llama-3.2-90b-vision-instruct"
```
