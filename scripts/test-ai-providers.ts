import { GeminiProvider } from "../lib/ai/providers/gemini";
import { GroqProvider } from "../lib/ai/providers/groq";
import { OpenRouterProvider } from "../lib/ai/providers/openrouter";
import { LocalProvider } from "../lib/ai/providers/local";

async function main() {
  console.log("====================================================");
  console.log("  JURÍDICO RADAR — PRUEBA DE PROVEEDORES IA (CLI)");
  console.log("====================================================\n");

  const gemini = new GeminiProvider();
  const groq = new GroqProvider();
  const openrouter = new OpenRouterProvider();
  const local = new LocalProvider();

  let hasErrors = false;
  const testMessage = "Responde únicamente con la palabra 'OK' para probar la conexión.";

  // 1. Gemini
  console.log("[1/4] Probando Gemini...");
  if (await gemini.isAvailable()) {
    const res = await gemini.generate({ userMessage: testMessage, maxTokens: 10 });
    if (res.success) {
      console.log(`  ✓ Gemini OK | Modelo: ${res.model} | Latencia: ${res.latencyMs}ms`);
    } else {
      console.error(`  ✗ Gemini FALLÓ | Modelo: ${res.model} | Error: ${res.errorCode}`);
      hasErrors = true;
    }
  } else {
    console.log("  ⚠️ Gemini NO CONFIGURADO (GEMINI_API_KEY no presente)");
  }

  // 2. Groq
  console.log("\n[2/4] Probando Groq...");
  if (await groq.isAvailable()) {
    const res = await groq.generate({ userMessage: testMessage, maxTokens: 10 });
    if (res.success) {
      console.log(`  ✓ Groq OK | Modelo: ${res.model} | Latencia: ${res.latencyMs}ms`);
    } else {
      console.error(`  ✗ Groq FALLÓ | Modelo: ${res.model} | Error: ${res.errorCode}`);
      hasErrors = true;
    }
  } else {
    console.log("  ⚠️ Groq NO CONFIGURADO (GROQ_API_KEY no presente)");
  }

  // 3. OpenRouter
  console.log("\n[3/4] Probando OpenRouter...");
  if (await openrouter.isAvailable()) {
    const res = await openrouter.generate({ userMessage: testMessage, maxTokens: 10 });
    if (res.success) {
      console.log(`  ✓ OpenRouter OK | Modelo: ${res.model} | Latencia: ${res.latencyMs}ms`);
    } else {
      console.error(`  ✗ OpenRouter FALLÓ | Modelo: ${res.model} | Error: ${res.errorCode}`);
      hasErrors = true;
    }
  } else {
    console.log("  ⚠️ OpenRouter NO CONFIGURADO (OPENROUTER_API_KEY no presente)");
  }

  // 4. Local
  console.log("\n[4/4] Probando Fallback Local...");
  const localRes = await local.generate({ userMessage: testMessage });
  console.log(`  ✓ Fallback Local OK | Modelo: ${localRes.model} | Latencia: ${localRes.latencyMs}ms`);

  console.log("\n====================================================");
  if (hasErrors) {
    console.error("❌ AL MENOS UN PROVEEDOR CONFIGURADO FALLÓ LA PRUEBA.");
    process.exit(1);
  } else {
    console.log("✅ TODOS LOS PROVEEDORES CONFIGURADOS RESPONDIERON CORRECTAMENTE.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Error inesperado en script de prueba:", err);
  process.exit(1);
});
