import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("emptySearchPrompt tiene las secciones requeridas y sugerencias familiares", () => {
  const content = fs.readFileSync("lib/ai/prompts/emptySearchPrompt.ts", "utf8");

  assert.match(content, /Diagnóstico/);
  assert.match(content, /Términos alternativos/);
  assert.match(content, /Filtros a revisar/);
  assert.match(content, /Materias relacionadas/);
  assert.match(content, /Fuentes oficiales sugeridas/);
  assert.match(content, /Próxima acción recomendada/);

  // Debe sugerir los sinónimos familiares obligatorios
  assert.match(content, /pensión alimenticia/);
  assert.match(content, /patria potestad/);
  assert.match(content, /guarda y custodia/);
  assert.match(content, /Código Nacional de Procedimientos Civiles y Familiares/);
});
