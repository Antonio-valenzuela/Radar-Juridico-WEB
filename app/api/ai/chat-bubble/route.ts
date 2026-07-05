import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, extractIp } from "@/lib/security/rateLimit";
import { routeLlmCompletion } from "@/lib/ai/router";
import { bubbleSystemPrompt } from "@/lib/ai/prompts/bubbleSystemPrompt";
import { emptySearchPrompt } from "@/lib/ai/prompts/emptySearchPrompt";
import { ragPrompt } from "@/lib/ai/prompts/ragPrompt";
import { prisma } from "@/lib/prisma";

function sanitizeInput(str: string): string {
  if (!str) return "";
  return str
    .replace(/ignore previous instructions/gi, "")
    .replace(/forget all rules/gi, "")
    .replace(/you are now a/gi, "")
    .trim();
}

function parseRelativeDate(phrase: string): { dateFrom: Date | null; dateTo: Date | null } {
  const now = new Date();
  const lower = phrase.toLowerCase().trim();

  if (lower.includes("esta semana")) {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return { dateFrom: startOfWeek, dateTo: new Date() };
  }
  if (lower.includes("hoy")) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endOfToday.setHours(23, 59, 59, 999);
    return { dateFrom: startOfToday, dateTo: endOfToday };
  }
  if (lower.includes("ayer")) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);
    return { dateFrom: yesterday, dateTo: endOfYesterday };
  }
  if (lower.includes("reciente") || lower.includes("ultimo") || lower.includes("últimos cambios")) {
    const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0);
    return { dateFrom: lastWeek, dateTo: new Date() };
  }
  return { dateFrom: null, dateTo: null };
}

function classifyIntentRegex(message: string): { intent: string; materia: string | null; relativeDate: string | null } {
  const lower = message.toLowerCase().trim();
  let intent = "general_platform_help";
  let materia: string | null = null;
  let relativeDate: string | null = null;

  if (lower.includes("cambio") || lower.includes("reforma") || lower.includes("novedad") || lower.includes("publica") || lower.includes("dame los ultimos") || lower.includes("esta semana") || lower.includes("hoy") || lower.includes("ayer")) {
    intent = "latest_changes";
  } else if (lower.includes("buscar") || lower.includes("como busco") || lower.includes("encontrar")) {
    intent = "search_help";
  }

  // Materias keywords
  if (lower.includes("penal") || lower.includes("delito") || lower.includes("prision")) materia = "penal";
  else if (lower.includes("fiscal") || lower.includes("sat") || lower.includes("impuesto") || lower.includes("iva") || lower.includes("isr")) materia = "fiscal";
  else if (lower.includes("laboral") || lower.includes("trabajo") || lower.includes("despido") || lower.includes("patron")) materia = "laboral";
  else if (lower.includes("salud") || lower.includes("cofepris") || lower.includes("medico")) materia = "salud";
  else if (lower.includes("ambiental") || lower.includes("ambiente") || lower.includes("ecologia")) materia = "ambiental";
  else if (lower.includes("energia") || lower.includes("cre") || lower.includes("cfe") || lower.includes("petroleo")) materia = "energia";
  else if (lower.includes("financiero") || lower.includes("banco") || lower.includes("cnbv")) materia = "financiero";
  else if (lower.includes("administrativo")) materia = "administrativo";
  else if (lower.includes("comercio") || lower.includes("importa")) materia = "comercio_exterior";
  else if (lower.includes("datos") || lower.includes("privacidad") || lower.includes("inai")) materia = "proteccion_datos";
  else if (lower.includes("constitucional") || lower.includes("amparo")) materia = "constitucional";

  if (lower.includes("esta semana")) relativeDate = "esta semana";
  else if (lower.includes("hoy")) relativeDate = "hoy";
  else if (lower.includes("ayer")) relativeDate = "ayer";
  else if (lower.includes("reciente") || lower.includes("ultimo") || lower.includes("últimos cambios")) relativeDate = "reciente";

  return { intent, materia, relativeDate };
}

const VALID_CHAT_INTENTS = new Set([
  "latest_changes",
  "search_help",
  "empty_search_assistant",
  "document_qa",
  "admin_source_diagnostic",
  "general_platform_help",
  "rag",
]);

function normalizeChatIntent(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "general_platform_help";
  const normalized = value.trim();
  if (normalized === "general") return "general_platform_help";
  return VALID_CHAT_INTENTS.has(normalized) ? normalized : "general_platform_help";
}

function lawyerSafeFallback(intent: string, query?: string) {
  if (intent === "empty_search_assistant") {
    return `No tengo una coincidencia suficiente para "${query || "tu búsqueda"}" en este momento. Puedes intentar con términos más amplios, revisar la fuente oficial aplicable o agregar una URL jurídica específica para analizarla.

⚠️ Respuesta generada por IA; verifica con fuentes oficiales.`;
  }

  if (intent === "latest_changes") {
    return `Puedo ayudarte a revisar los cambios recientes con una búsqueda jurídica filtrada por materia y fecha. Usa la acción de búsqueda para consultar los registros oficiales disponibles de esta semana; si no aparece una publicación suficiente, valida directamente en DOF, SIDOF, SCJN o la fuente oficial aplicable antes de tomar una decisión jurídica.

⚠️ Respuesta generada por IA; verifica con fuentes oficiales.`;
  }

  return `Puedo orientarte de forma informativa. Para una petición jurídica, conviene precisar: hechos relevantes, materia, jurisdicción, fechas, documentos disponibles y objetivo procesal o contractual. Con esos datos puedo ayudarte a ordenar argumentos, riesgos, puntos de prueba y fuentes oficiales que deberías verificar.

⚠️ Respuesta generada por IA; verifica con fuentes oficiales.`;
}

function sanitizeLawyerFacingAnswer(answer: string, intent: string, query?: string) {
  const unsafe = /degradad|sin conexión|IA externa|proveedor(?:es)? de IA|base local|base de datos|indexad|documentos locales|local-static|fallback/i;
  if (!answer || unsafe.test(answer)) {
    return lawyerSafeFallback(intent, query);
  }
  return answer;
}

function parseModelJsonObject(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

export async function POST(req: NextRequest) {
  const ip = extractIp(req);
  const rateLimitResult = checkRateLimit(ip, 30);
  if (!rateLimitResult.ok) {
    return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Por favor intente más tarde." }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...rateLimitResult.headers }
    });
  }

  try {
    const payload = await req.json();
    const { message, currentPath, mode, query, filters, resultCount, selectedText, documentId } = payload;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "El mensaje es obligatorio y debe ser texto." }, { status: 400 });
    }

    // Security check for admin pages
    if (currentPath && typeof currentPath === "string" && currentPath.startsWith("/admin")) {
      const adminToken = req.headers.get("x-admin-token") || "";
      if (adminToken !== "dev-admin-token") {
        return NextResponse.json({ error: "No autorizado para consultar en contexto administrativo." }, { status: 401 });
      }
    }

    const cleanMessage = sanitizeInput(message);
    const cleanSelectedText = selectedText ? sanitizeInput(String(selectedText)) : "";

    const regexMatch = classifyIntentRegex(cleanMessage);

    // 1. Classifier LLM Call (failsafe to regex classification)
    let intent = normalizeChatIntent(mode);
    let materia: string | null = regexMatch.materia;
    let relativeDate: string | null = regexMatch.relativeDate;

    try {
      const classifierPrompt = `Clasifica el mensaje del usuario de una plataforma jurídica en una de las siguientes intenciones:
- "latest_changes": El usuario pide novedades, reformas, decretos, circulares o publicaciones de fechas recientes ("esta semana", "hoy", "ayer", "últimos días", "recientemente", "materia fiscal esta semana").
- "search_help": El usuario pide consejos sobre cómo buscar, qué términos usar o cómo encontrar información.
- "empty_search_assistant": Búsquedas que no arrojaron resultados o ayuda directa.
- "document_qa": El usuario pregunta sobre un documento específico (si se proporciona documentId o texto del documento).
- "admin_source_diagnostic": Dudas o soporte sobre ingestas de fuentes oficiales y telemetría.
- "general_platform_help": Mensajes generales de ayuda o preguntas enciclopédicas/generales ("explícame qué es la patria potestad", etc.).

Debes responder ÚNICAMENTE con un objeto JSON válido que contenga:
{
  "intent": "latest_changes" | "search_help" | "empty_search_assistant" | "document_qa" | "admin_source_diagnostic" | "general_platform_help",
  "materia": string | null (materia jurídica identificada en minúsculas: penal, fiscal, civil, laboral, salud, ambiental, energia, financiero, administrativo, comercio_exterior, proteccion_datos, constitucional),
  "tema": string | null (tema o palabra clave específico),
  "relativeDate": string | null ("esta semana", "hoy", "ayer", "reciente" u otro),
  "source": string | null,
  "jurisdiction": string | null
}
`;
      const classifierResult = await routeLlmCompletion(
        classifierPrompt + `\n\nMensaje: "${cleanMessage}"`,
        "classification",
        "class_" + Math.random().toString(36).substring(7)
      );

      const parsed = JSON.parse(classifierResult.answer.trim());
      if (parsed.intent) {
        intent = normalizeChatIntent(parsed.intent);
        materia = parsed.materia;
        relativeDate = parsed.relativeDate;
      }
    } catch (e) {
      // Fallback to regex
      intent = normalizeChatIntent(regexMatch.intent);
      materia = regexMatch.materia;
      relativeDate = regexMatch.relativeDate;
    }

    // Deterministic guardrail: recency language must not be downgraded to generic help.
    if (regexMatch.intent === "latest_changes" && (intent === "general_platform_help" || normalizeChatIntent(mode) === "general_platform_help")) {
      intent = "latest_changes";
      materia = materia || regexMatch.materia;
      relativeDate = relativeDate || regexMatch.relativeDate;
    }

    if (normalizeChatIntent(mode) === "empty_search_assistant" && Number(resultCount || 0) === 0) {
      intent = "empty_search_assistant";
    }

    // Force RAG mode if we have a documentId
    if (documentId) {
      intent = "document_qa";
    }

    // 2. Fetch local data before generating response
    let localItems: any[] = [];
    let usedLocalData = false;

    if (intent === "latest_changes") {
      const dates = parseRelativeDate(relativeDate || cleanMessage);
      const queryParams: any = {
        take: 5,
        orderBy: { published: "desc" },
        include: { aiEnrichment: true },
      };

      const whereClause: any = {};
      if (dates.dateFrom && dates.dateTo) {
        whereClause.published = {
          gte: dates.dateFrom,
          lte: dates.dateTo,
        };
      }
      if (materia) {
        whereClause.OR = [
          { tema: materia.toLowerCase() },
          { aiEnrichment: { is: { matter: materia.toLowerCase() } } },
        ];
      }

      if (Object.keys(whereClause).length > 0) {
        queryParams.where = whereClause;
      }

      try {
        localItems = await prisma.item.findMany(queryParams);
        if (localItems.length === 0 && materia) {
          const recentFallbackFrom = new Date();
          recentFallbackFrom.setDate(recentFallbackFrom.getDate() - 45);
          localItems = await prisma.item.findMany({
            take: 5,
            orderBy: { published: "desc" },
            include: { aiEnrichment: true },
            where: {
              published: { gte: recentFallbackFrom },
              OR: [
                { tema: materia.toLowerCase() },
                { aiEnrichment: { is: { matter: materia.toLowerCase() } } },
              ],
            },
          });
          if (localItems.length > 0) {
            relativeDate = relativeDate ? `${relativeDate} (sin hallazgos exactos; se muestran publicaciones recientes relacionadas)` : "reciente";
          }
        }
        usedLocalData = localItems.length > 0;
      } catch (err) {
        console.error("Failed to query database in chat bubble:", err);
      }
    } else if (intent === "document_qa" && documentId) {
      try {
        const item = await prisma.item.findUnique({
          where: { id: documentId },
          include: { aiEnrichment: true }
        });
        if (item) {
          localItems = [item];
          usedLocalData = true;
        }
      } catch (err) {
        console.error("Failed to query document details in chat bubble:", err);
      }
    }

    // In empty_search_assistant mode, expand the query using the legal thesaurus
    let expandedData: any = null;
    if (intent === "empty_search_assistant" && query) {
      try {
        const { expandLegalQuery } = await import("@/lib/search/expandLegalQuery");
        expandedData = expandLegalQuery(query);
      } catch (err) {
        console.error("Failed to expand query in chat route:", err);
      }
    }

    // 3. Build Prompt context
    let systemInstructions = bubbleSystemPrompt;
    if (intent === "empty_search_assistant") {
      systemInstructions = `${bubbleSystemPrompt}\n\n${emptySearchPrompt}`;
    } else if (intent === "document_qa" || intent === "rag") {
      systemInstructions = `${bubbleSystemPrompt}\n\n${ragPrompt}`;
    }

    let userContext = `
[RUTA DE PAGINA ACTUAL]: ${currentPath || ""}
[MENSAJE DEL USUARIO]: "${cleanMessage}"
[TEXTO SELECCIONADO]: "${cleanSelectedText || ""}"
[INTENCION CLASIFICADA]: ${intent}
[MATERIA IDENTIFICADA]: ${materia || "ninguna"}
[PERIODO DETECTADO]: ${relativeDate || "ninguno"}
`;

    if (expandedData && expandedData.expandedTerms.length > 0) {
      userContext += `\n[EXPANSION DE CONSULTA DE DICCIONARIO LOCAL (THESAURUS)]:
- Términos alternativos detectados: ${expandedData.expandedTerms.join(", ")}
- Materias relacionadas: ${expandedData.relatedMaterias.join(", ")}
- Fuentes sugeridas: ${expandedData.suggestedSources.join(", ")}
`;
    }

    if (usedLocalData) {
      userContext += `\n[DOCUMENTOS ENCONTRADOS EN BASE LOCAL]:\n` + localItems.map((item, idx) => `
${idx + 1}. [${item.source.toUpperCase()}] ${item.title}
   - Fecha: ${new Date(item.published).toLocaleDateString("es-MX")}
   - Materia: ${item.tema || "General"}
   - Impacto: ${item.impacto || "Medio"}
   - Resumen: ${item.summary || "No disponible"}
   - URL/Enlace: ${item.url}
   - ID: ${item.id}
`).join("\n");
    } else if (intent === "latest_changes" || intent === "empty_search_assistant") {
      userContext += `\n[CONTEXTO DE EVIDENCIA]: No hay documentos recuperados para citar directamente en esta respuesta. No inventes fuentes, artículos ni fechas; sugiere validar en fuentes oficiales.`;
    } else {
      userContext += `\n[CONTEXTO DE RESPUESTA]: Responde como orientación jurídica informativa. Si no hay documento específico recuperado, no cites artículos ni jurisprudencias concretas; pide datos faltantes y sugiere verificar fuentes oficiales.`;
    }

    // Request LLM to format response into structured JSON
    const finalPrompt = `
${systemInstructions}

${userContext}

Por favor responde a la consulta del usuario estructurando tu respuesta en formato JSON exacto:
{
  "answer": "Tu respuesta textual en formato Markdown, explicando de forma precisa (y citando documentos locales si los hay). Si no hay datos locales, acláralo explícitamente sin inventar nada y da recomendaciones de búsqueda.",
  "citations": [{"id": "ID del documento", "title": "Título", "url": "URL"}],
  "suggestedActions": [{"label": "Texto del botón", "type": "clear_filters" | "add_link" | "create_alert" | "search_source" | "search_query" | "force_textual", "payload": {}}]
}
`;

    const completion = await routeLlmCompletion(
      finalPrompt,
      intent,
      Math.random().toString(36).substring(7),
      { mode: intent, route: currentPath }
    );

    // 4. Parse JSON Response or build safe default
    let answerText = "";
    let citations: any[] = [];
    let suggestedActions: any[] = [];

    try {
      const parsedRes = parseModelJsonObject(completion.answer);
      answerText = parsedRes.answer || "";
      citations = parsedRes.citations || [];
      suggestedActions = parsedRes.suggestedActions || [];
    } catch (e) {
      // Safe fallback if JSON parsing failed
      answerText = completion.answer;
    }

    // 5. Append programmatic/deterministic action buttons based on intent/context to prevent LLM hallucination in actions
    const finalActions: any[] = [...suggestedActions];

    if (intent === "empty_search_assistant" || resultCount === 0) {
      const termsToSuggest = expandedData?.expandedTerms.slice(0, 3) || [];
      const newActions = [];

      for (const term of termsToSuggest) {
        if (term.toLowerCase() === (query || '').toLowerCase()) continue;
        newActions.push({
          label: `Buscar ${term}`,
          type: "search",
          payload: { query: term }
        });
      }

      newActions.push({ label: "Quitar filtros", type: "clear_filters", payload: {} });
      newActions.push({ label: "Agregar link jurídico", type: "add_source_url", payload: {} });

      for (const act of newActions) {
        if (!finalActions.some((a) => a.label === act.label)) {
          finalActions.push(act);
        }
      }
    } else if (intent === "latest_changes") {
      const matterLabel = materia ? `derecho ${materia}` : "derecho penal";
      if (!finalActions.some((a) => a.type === "search_query")) {
        finalActions.push({
          label: `Buscar reformas recientes en ${materia || "penal"}`,
          type: "search_query",
          payload: {
            query: `reformas ${matterLabel}`,
            matter: materia || "penal",
            dateRange: "this_week",
          },
        });
      }
      if (!finalActions.some((a) => a.type === "create_alert")) {
        finalActions.push({
          label: `Crear alerta de ${matterLabel}`,
          type: "create_alert",
          payload: { query: matterLabel, matter: materia || "penal" },
        });
      }
    }

    if (!answerText) {
      if (intent === "empty_search_assistant") {
        answerText = `No tengo una coincidencia suficiente para "${query || ""}" en este momento.

Prueba con términos alternativos, revisa la fuente oficial aplicable o agrega una URL jurídica específica para analizarla.`;
      } else {
        answerText = completion.answer;
      }
    }

    if (
      intent === "latest_changes" &&
      localItems.length > 0 &&
      (/No tengo una publicación específica recuperada/i.test(answerText) ||
        /Puedo ayudarte a revisar cambios recientes/i.test(answerText) ||
        !citations.length)
    ) {
      const periodNote = relativeDate ? ` para ${relativeDate}` : "";
      const itemLines = localItems.map((item, idx) => {
        const date = item.published ? new Date(item.published).toLocaleDateString("es-MX") : "sin fecha";
        const source = item.source || "Fuente oficial";
        return `${idx + 1}. **${item.title}** (${source}, ${date}).`;
      }).join("\n");
      const publicationLabel = localItems.length === 1 ? "publicación relacionada" : "publicaciones relacionadas";
      answerText = `Encontré ${localItems.length} ${publicationLabel} con ${materia ? `materia ${materia}` : "tu consulta"}${periodNote}:\n\n${itemLines}\n\nRevisa el texto completo en la fuente oficial antes de tomar una decisión jurídica.\n\n⚠️ Respuesta generada por IA; verifica con fuentes oficiales.`;
    }

    answerText = sanitizeLawyerFacingAnswer(answerText, intent, query);

        return NextResponse.json({
          answer: answerText,
          displayAnswer: answerText,
          mode: intent,
          usedLocalData,
          technical: {
            provider: completion.provider,
            intent,
            resultCount: localItems.length,
            usedLocalData,
            mode: intent,
          },
          citations: citations.length > 0 ? citations : localItems.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
          })),
          actions: finalActions,
        });
  } catch (err: any) {
    console.error("[chat-bubble] Error in chatbot bubble endpoint:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
