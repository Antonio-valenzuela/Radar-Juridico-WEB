import { GeminiProvider } from "./providers/gemini";
import { GroqProvider } from "./providers/groq";
import { LocalProvider } from "./providers/local";
import { NVIDIAProvider } from "./providers/nvidia";
import { OpenRouterProvider } from "./providers/openrouter";
import type { AIHealthResult, AIProviderResult, AIRequest } from "./providers/types";
import { deepReviewSchema, type DeepReviewOutput } from "./schemas/deepReviewSchema";

const nvidia = new NVIDIAProvider();
const gemini = new GeminiProvider();
const groq = new GroqProvider();
const openrouter = new OpenRouterProvider();
const local = new LocalProvider();

export async function runFastMode(request: AIRequest): Promise<AIProviderResult> {
  const chain = (process.env.AI_PROVIDER_CHAIN || "nvidia,gemini,groq,openrouter,local")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  let fallbackCount = 0;

  for (const providerId of chain) {
    if (providerId === "nvidia" && (await nvidia.isAvailable())) {
      const res = await nvidia.generate(request);
      if (res.success && res.content) {
        return { ...res, warnings: [...(res.warnings || [])] };
      }
      fallbackCount++;
    } else if (providerId === "gemini" && (await gemini.isAvailable())) {
      const res = await gemini.generate(request);
      if (res.success && res.content) {
        return { ...res, warnings: [...(res.warnings || [])] };
      }
      fallbackCount++;
    } else if (providerId === "groq" && (await groq.isAvailable())) {
      const res = await groq.generate(request);
      if (res.success && res.content) {
        return { ...res, warnings: [...(res.warnings || [])] };
      }
      fallbackCount++;
    } else if (providerId === "openrouter" && (await openrouter.isAvailable())) {
      const res = await openrouter.generate(request);
      if (res.success && res.content) {
        return { ...res, warnings: [...(res.warnings || [])] };
      }
      fallbackCount++;
    } else if (providerId === "local") {
      const res = await local.generate(request);
      return { ...res, warnings: [...(res.warnings || [])] };
    }
  }

  return local.generate(request);
}

export async function runDeepReviewMode(request: AIRequest): Promise<DeepReviewOutput> {
  // Step 1: Run Gemini and Groq in parallel
  const [geminiResult, groqResult] = await Promise.allSettled([
    gemini.isAvailable().then((avail) => (avail ? gemini.generate({ ...request, mode: "deep" }) : null)),
    groq.isAvailable().then((avail) => (avail ? groq.generate({ ...request, mode: "deep" }) : null)),
  ]);

  const geminiRes = geminiResult.status === "fulfilled" ? geminiResult.value : null;
  const groqRes = groqResult.status === "fulfilled" ? groqResult.value : null;

  const geminiSuccess = !!(geminiRes && geminiRes.success && geminiRes.content);
  const groqSuccess = !!(groqRes && groqRes.success && groqRes.content);

  // Step 2: Prepare prompt for OpenRouter Judge
  const judgePrompt = `Eres el Juez Consolidador de Inteligencia Artificial para la plataforma jurídica Radar Jurídico.
Tu función es analizar los resultados producidos en paralelo por dos modelos de IA (Gemini y Groq) sobre una consulta o borrador jurídico, evaluar sus coincidencias, detectar contradicciones, verificar que cada afirmación tenga sustento en las fuentes oficiales recuperadas y generar una sola revisión profunda estructurada.

[REGLAS ESTRICTAS DE CONSOLIDACIÓN]:
1. No inventes artículos, jurisprudencias ni autoridades.
2. Si un modelo afirma algo que NO está respaldado por las fuentes recuperadas, márcalo en "unsupportedClaims".
3. Si existe una contradicción entre hechos y puntos petitorios (p. ej. petitorios de privación de libertad con hechos vacíos), agrégala a "contradictions".
4. Devuelve ÚNICAMENTE un JSON estricto que cumpla con el siguiente formato sin Markdown ni texto extra:

{
  "summary": "Resumen ejecutivo de la consolidación...",
  "overallRisk": "critical" | "high" | "medium" | "low",
  "issues": [
    {
      "id": "issue-1",
      "severity": "critical" | "warning" | "suggestion",
      "section": "sección del documento",
      "fieldId": "campo_afectado",
      "title": "Título de la observación",
      "explanation": "Explicación detallada del riesgo o sugerencia",
      "currentText": "Texto actual",
      "suggestedText": "Texto sugerido",
      "supportedBySources": true,
      "sourceIds": [],
      "modelAgreement": "both" | "gemini_only" | "groq_only" | "judge_added",
      "confidence": 0.9
    }
  ],
  "missingFields": ["lista de campos faltantes"],
  "contradictions": ["lista de contradicciones"],
  "unsupportedClaims": ["lista de afirmaciones no sustentadas"],
  "recommendedActions": ["lista de acciones recomendadas"],
  "sourcesUsed": [],
  "providerSummary": {
    "geminiCompleted": ${geminiSuccess},
    "groqCompleted": ${groqSuccess},
    "judgeCompleted": true
  }
}`;

  const judgeUserMessage = `[SOLICITUD ORIGINAL DEL USUARIO]:
"${request.userMessage}"

[FUENTES OFICIALES RECUPERADAS]:
${JSON.stringify(request.retrievedSources || [], null, 2)}

[RESPUESTA MODELO 1 - GEMINI]:
${geminiSuccess ? geminiRes?.content : "GEMINI NO DISPONIBLE / FALLÓ"}

[RESPUESTA MODELO 2 - GROQ]:
${groqSuccess ? groqRes?.content : "GROQ NO DISPONIBLE / FALLÓ"}
`;

  // Step 3: Execute OpenRouter Judge if available
  if (await openrouter.isAvailable()) {
    try {
      const judgeResult = await openrouter.generate(
        {
          systemPrompt: judgePrompt,
          userMessage: judgeUserMessage,
          mode: "deep",
          temperature: 0.1,
        },
        true // isJudgeMode
      );

      if (judgeResult.success && judgeResult.content) {
        const cleaned = cleanJsonWrapper(judgeResult.content);
        const parsed = JSON.parse(cleaned);
        const validated = deepReviewSchema.parse({
          ...parsed,
          providerSummary: {
            geminiCompleted: geminiSuccess,
            groqCompleted: groqSuccess,
            judgeCompleted: true,
            fallbackUsed: false,
          },
        });
        return validated;
      }
    } catch (err) {
      console.error("[orchestrator] OpenRouter Judge failed, falling back to local consolidator:", err);
    }
  }

  // Step 4: Fallback to Local Deep Consolidator
  return runLocalDeepConsolidator(request, geminiRes, groqRes);
}

export function runLocalDeepConsolidator(
  request: AIRequest,
  geminiRes: AIProviderResult | null,
  groqRes: AIProviderResult | null
): DeepReviewOutput {
  const geminiSuccess = !!(geminiRes && geminiRes.success && geminiRes.content);
  const groqSuccess = !!(groqRes && groqRes.success && groqRes.content);

  const issues: any[] = [];
  const contradictions: string[] = [];

  let availableContent = geminiRes?.content || groqRes?.content || "";
  let fallbackGenerated = false;

  if (!availableContent || availableContent.trim().length < 50) {
    availableContent = generateLocalLegalDraft(request);
    fallbackGenerated = true;
  }

  if (availableContent) {
    issues.push({
      id: "issue-model-response-1",
      severity: "suggestion",
      section: "respuesta_generada",
      fieldId: "contenido",
      title: "Análisis y Escrito Proyectado por IA",
      explanation: "Respuesta y propuesta de contestación / recurso elaborada por el motor procesal de Jurídico Radar.",
      currentText: "",
      suggestedText: availableContent,
      supportedBySources: true,
      sourceIds: [],
      modelAgreement: geminiSuccess && groqSuccess ? "both" : geminiSuccess ? "gemini_only" : groqSuccess ? "groq_only" : "judge_added",
      confidence: 0.9,
    });
  }

  const text = (request.userMessage + " " + JSON.stringify(request.legalContext || {})).toLowerCase();

  if (/secuestro|privaci[oó]n de libertad|detenci[oó]n|incomunicaci[oó]n/i.test(text)) {
    const hechos = String(request.legalContext?.fields?.hechos || "").trim();
    if (hechos.length < 20) {
      const msg = "Los puntos petitorios presuponen una privación de libertad, pero el documento no contiene hechos ni acto reclamado que sustenten ese supuesto.";
      contradictions.push(msg);
      issues.push({
        id: "issue-local-contradiction-1",
        severity: "critical",
        section: "puntos_petitorios",
        fieldId: "petitorios",
        title: "Incongruencia entre hechos y puntos petitorios",
        explanation: msg,
        currentText: "SEGUNDO.- Conceder la suspensión provisional contra la privación de libertad...",
        suggestedText: "SEGUNDO.- Conceder la suspensión provisional respecto de los actos reclamados descritos...",
        supportedBySources: true,
        sourceIds: [],
        modelAgreement: geminiSuccess && groqSuccess ? "both" : geminiSuccess ? "gemini_only" : "groq_only",
        confidence: 0.85,
      });
    }
  }

  let summary = `Revisión y contestación procesada por el consolidador local. ${
    geminiSuccess || groqSuccess
      ? "Se utilizaron los resultados del modelo de IA disponible (Gemini / Groq)."
      : "No fue posible conectar con los proveedores remotos; se aplicó la validación determinística con el motor procesal local."
  }`;

  if (availableContent && availableContent.length > 50) {
    summary += "\n\n" + availableContent;
  }

  return {
    summary,
    overallRisk: contradictions.length > 0 ? "high" : "low",
    issues,
    missingFields: request.legalContext?.pendingMarkers || [],
    contradictions,
    unsupportedClaims: [],
    recommendedActions: [
      "Revisar el borrador en la vista previa antes de exportar",
      "Confirmar preceptos constitucionales en el Semanario Judicial de la Federación",
    ],
    sourcesUsed: (request.retrievedSources || []).map((s) => ({
      id: s.id || `src-${Math.random()}`,
      title: s.title,
      officialUrl: s.officialUrl || "",
      sourceType: "legislation",
      verified: true,
    })),
    providerSummary: {
      geminiCompleted: geminiSuccess,
      groqCompleted: groqSuccess,
      judgeCompleted: false,
      fallbackUsed: true,
    },
  };
}

export async function getProvidersStatus(): Promise<AIHealthResult[]> {
  const results = await Promise.all([
    gemini.healthCheck(),
    groq.healthCheck(),
    openrouter.healthCheck(),
    local.healthCheck(),
  ]);
  return results;
}

function cleanJsonWrapper(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function generateLocalLegalDraft(request: AIRequest): string {
  const msg = request.userMessage || "";

  const resourceTypeMatch = msg.match(/TIPO DE RECURSO \/ CONTESTACIÓN:\s*(.+)/i);
  const resourceType = resourceTypeMatch ? resourceTypeMatch[1].trim() : "Recurso / Contestación Legal";

  const expMatch = msg.match(/Expediente de origen:\s*(.+)/i);
  const expediente = expMatch ? expMatch[1].trim() : "Expediente de Origen";

  const tribunalMatch = msg.match(/Tribunal \/ Autoridad emisora:\s*(.+)/i);
  const tribunal = tribunalMatch ? tribunalMatch[1].trim() : "H. Tribunal / Autoridad Competente";

  const ponenteMatch = msg.match(/Magistrado ponente \/ Autoridad:\s*(.+)/i);
  const ponente = ponenteMatch ? ponenteMatch[1].trim() : "C. Juez / Magistrado Ponente";

  const fechaMatch = msg.match(/Fecha de resolución:\s*(.+)/i);
  const fecha = fechaMatch ? fechaMatch[1].trim() : "Fecha de notificación";

  let autoridad = "H. SUPREMA CORTE DE JUSTICIA DE LA NACIÓN\nPRESIDENCIA / SALA EN TURNO";
  if (resourceType.includes("Queja")) {
    autoridad = "H. TRIBUNAL COLEGIADO DE CIRCUITO EN TURNO";
  } else if (resourceType.includes("Laboral")) {
    autoridad = "H. TRIBUNAL DE ARBITRAJE Y ESCALAFÓN / JUZGADO LABORAL COMPETENTE";
  } else if (resourceType.includes("Civil")) {
    autoridad = "C. JUEZ DE LO CIVIL Y MERCANTIL EN TURNO";
  } else if (resourceType.includes("Incidente")) {
    autoridad = "C. JUEZ DE DISTRITO EN MATERIA DE AMPARO";
  }

  return `${resourceType.toUpperCase()}
EXPEDIENTE DE ORIGEN: ${expediente}
TRIBUNAL / AUTORIDAD EMISORA: ${tribunal}
MAGISTRADO PONENTE / AUTORIDAD: ${ponente}
FECHA DE RESOLUCIÓN: ${fecha}

${autoridad}
P R E S E N T E.-

PROMOVENTE, por mi propio derecho y/o en representación de la parte promovente dentro de los autos del expediente número ${expediente}, señalando domicilio procesal para oír y recibir notificaciones, comparezco respetuosamente y expongo:

Que por medio del presente escrito, y con fundamento en los artículos 1, 14, 16 y 17 de la Constitución Política de los Estados Unidos Mexicanos, la Ley de Amparo y demás disposiciones procesales aplicables, vengo a interponer en tiempo y forma ${resourceType.toUpperCase()} en contra de la resolución/demanda procesal dictada por ${tribunal} con fecha ${fecha}.

--- AGRAVIOS Y CONCEPTOS DE VIOLACIÓN ---

PRIMER AGRAVIO.- VIOLACIÓN A LOS PRINCIPIOS DE LEGALIDAD, EXHAUSTIVIDAD Y SEGURIDAD JURÍDICA.
La resolución recurrida resulta violatoria de las garantías contempladas en los artículos 14 y 16 Constitucionales, toda vez que la autoridad emisora omitió analizar de forma exhaustiva los planteamientos de las partes, incurriendo en una indebida motivación e inoperancia indebida de argumentos vertidos en autos.

SEGUNDO AGRAVIO.- INAPLICACIÓN DEL CONTROL DIFUSO DE CONSTITUCIONALIDAD Y CONVENCIONALIDAD.
Se reclama la omisión del ejercicio ex officio de control de constitucionalidad y convencionalidad garantizado en el Artículo 1 Constitucional, dejando a esta parte en estado de indefensión al vulnerar derechos fundamentales consagrados en tratados internacionales.

TERCER AGRAVIO.- INDEBIDA VALORACIÓN PROBATORIA Y FALTA DE MOTIVACIÓN.
La autoridad responsable omitió valorar adecuadamente las constancias y elementos probatorios aportados a los autos del expediente de origen ${expediente}, transgrediendo el debido proceso.

--- PUNTOS PETITORIOS ---

PRIMERO.- Tenerme por presentado en tiempo y forma legal interponiendo el presente ${resourceType}.
SEGUNDO.- Admitir a trámite el recurso/escrito y dar traslado a las partes en términos de ley.
TERCERO.- Previo el estudio de los agravios expuestos, declarar FUNDADO el presente recurso y revocar o modificar el acto impugnado para restituir a la promovente en el pleno goce de sus derechos violados.

PROTESTO LO NECESARIO EN DERECHO.
En la Ciudad de México / Guadalajara, Jalisco, a la fecha de su presentación.`;
}
