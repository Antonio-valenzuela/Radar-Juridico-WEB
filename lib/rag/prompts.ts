export function buildRagPrompt(question: string, contextChunks: string[]): string {
  const contextBlock = contextChunks.map((c, i) => `[Fuente ${i+1}]:\n${c}`).join('\n\n');
  
  return `Eres un asistente jurídico experto en legislación mexicana. 
Tu tarea es responder a la siguiente pregunta utilizando ÚNICAMENTE la información provista en las Fuentes. 

Reglas:
1. Si no hay evidencia suficiente en las fuentes para responder, responde exactamente: "No encontré evidencia suficiente en las fuentes indexadas."
2. No inventes información.
3. Menciona la fuente (ej. [Fuente 1]) en tu respuesta cuando afirmes algo.

Fuentes:
${contextBlock}

Pregunta:
${question}

Respuesta:`;
}
