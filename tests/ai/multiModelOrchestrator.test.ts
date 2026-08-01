import { describe, expect, it, vi } from 'vitest';
import { runFastMode, runDeepReviewMode, getProvidersStatus } from '@/lib/ai/orchestrator';
import { GeminiProvider } from '@/lib/ai/providers/gemini';
import { GroqProvider } from '@/lib/ai/providers/groq';
import { OpenRouterProvider } from '@/lib/ai/providers/openrouter';
import { LocalProvider } from '@/lib/ai/providers/local';

describe('Arquitectura Multimodelo G0DM0D3 (Fast vs Deep Review)', () => {
  it('Modo Rápido: intenta Gemini primero y retorna al obtener respuesta válida', async () => {
    vi.spyOn(GeminiProvider.prototype, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      success: true,
      content: 'Respuesta rápida de Gemini',
      latencyMs: 120,
    });

    const res = await runFastMode({ userMessage: 'Consulta procesal rápida' });

    expect(res.provider).toBe('gemini');
    expect(res.success).toBe(true);
    expect(res.content).toBe('Respuesta rápida de Gemini');
  });

  it('Modo Rápido: hace fallback a Groq si Gemini falla', async () => {
    vi.spyOn(GeminiProvider.prototype, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      success: false,
      content: '',
      latencyMs: 500,
      errorCode: 'TIMEOUT',
    });

    vi.spyOn(GroqProvider.prototype, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(GroqProvider.prototype, 'generate').mockResolvedValue({
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      success: true,
      content: 'Respuesta de fallback Groq',
      latencyMs: 200,
    });

    const res = await runFastMode({ userMessage: 'Consulta con fallback' });

    expect(res.provider).toBe('groq');
    expect(res.success).toBe(true);
    expect(res.content).toBe('Respuesta de fallback Groq');
  });

  it('Modo Rápido: hace fallback a Local si todos los proveedores fallan', async () => {
    vi.spyOn(GeminiProvider.prototype, 'isAvailable').mockResolvedValue(false);
    vi.spyOn(GroqProvider.prototype, 'isAvailable').mockResolvedValue(false);
    vi.spyOn(OpenRouterProvider.prototype, 'isAvailable').mockResolvedValue(false);

    const res = await runFastMode({ userMessage: 'Consulta sin conexión externa' });

    expect(res.provider).toBe('local');
    expect(res.success).toBe(true);
    expect(res.content).toContain('Análisis legal preliminar generado localmente');
  });

  it('Modo Revisión Profunda: ejecuta Gemini y Groq en paralelo yOpenRouter actúa como Juez', async () => {
    vi.spyOn(GeminiProvider.prototype, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      success: true,
      content: 'Gemini opina: El amparo procede.',
      latencyMs: 300,
    });

    vi.spyOn(GroqProvider.prototype, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(GroqProvider.prototype, 'generate').mockResolvedValue({
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      success: true,
      content: 'Groq opina: El acto reclamado requiere suspensión.',
      latencyMs: 250,
    });

    vi.spyOn(OpenRouterProvider.prototype, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(OpenRouterProvider.prototype, 'generate').mockResolvedValue({
      provider: 'openrouter',
      model: 'google/gemini-2.5-flash',
      success: true,
      content: JSON.stringify({
        summary: 'Revisión consolidada por el Juez OpenRouter',
        overallRisk: 'medium',
        issues: [
          {
            id: 'issue-1',
            severity: 'warning',
            section: 'puntos_petitorios',
            title: 'Verificar suspensión',
            explanation: 'Se recomienda especificar la autoridad ordenadora.',
            modelAgreement: 'both',
          },
        ],
        missingFields: [],
        contradictions: [],
        unsupportedClaims: [],
        recommendedActions: ['Revisar concepto de violación 1'],
        sourcesUsed: [],
      }),
      latencyMs: 400,
    });

    const deepResult = await runDeepReviewMode({
      userMessage: 'Revisión profunda del borrador de amparo',
      mode: 'deep',
      legalContext: { templateName: 'Demanda de amparo indirecto' },
    });

    expect(deepResult.summary).toContain('Revisión consolidada por el Juez OpenRouter');
    expect(deepResult.providerSummary.geminiCompleted).toBe(true);
    expect(deepResult.providerSummary.groqCompleted).toBe(true);
    expect(deepResult.providerSummary.judgeCompleted).toBe(true);
    expect(deepResult.providerSummary.fallbackUsed).toBe(false);
  });

  it('Modo Revisión Profunda: usa consolidador local si OpenRouter Juez falla', async () => {
    vi.spyOn(GeminiProvider.prototype, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      success: true,
      content: 'Respuesta Gemini',
      latencyMs: 200,
    });

    vi.spyOn(GroqProvider.prototype, 'isAvailable').mockResolvedValue(false);
    vi.spyOn(OpenRouterProvider.prototype, 'isAvailable').mockResolvedValue(false);

    const deepResult = await runDeepReviewMode({
      userMessage: 'Revisión profunda con fallo de juez',
      mode: 'deep',
      legalContext: { templateName: 'Demanda de amparo indirecto' },
    });

    expect(deepResult.providerSummary.judgeCompleted).toBe(false);
    expect(deepResult.providerSummary.fallbackUsed).toBe(true);
  });

  it('getProvidersStatus reporta el estado de salud de los 4 proveedores', async () => {
    const statuses = await getProvidersStatus();
    expect(statuses.length).toBe(4);
    const ids = statuses.map((s) => s.provider);
    expect(ids).toContain('gemini');
    expect(ids).toContain('groq');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('local');
  });
});
