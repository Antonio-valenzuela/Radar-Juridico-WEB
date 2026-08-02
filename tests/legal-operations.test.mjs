import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function runTs(code) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--eval", code],
    {
    cwd: process.cwd(),
      encoding: "utf8",
      env: { NODE_PATH: process.cwd() + "/node_modules", ...process.env, NODE_ENV: "test"  },
      timeout: 60000,
    }
  );
  if (result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        result.error?.message ||
        "tsx execution failed"
    );
  }
  return JSON.parse(result.stdout.trim());
}

test("leyes vigentes usa PostgreSQL y conserva el catálogo estático sólo como seed pendiente", () => {
  const page = read("app/legal-hub/leyes-vigentes/page.tsx");
  const api = read("app/api/norms/route.ts");
  const seed = read("prisma/seed_norms.ts");
  const schema = read("prisma/schema.prisma");

  assert.match(page, /fetch\(['"]\/api\/norms['"]\)/);
  assert.doesNotMatch(page, /CURRENT_LEGAL_LAWS/);
  assert.match(page, /verificationStatus/);
  assert.match(page, /lastVerifiedAt/);
  assert.match(page, /urlBase/);

  assert.match(api, /prisma\.norma\.(?:findMany|create)/);
  assert.match(api, /verificationStatus/);
  assert.match(seed, /CURRENT_LEGAL_LAWS/);
  assert.match(seed, /verificationStatus:\s*['"]pending['"]/);
  assert.doesNotMatch(seed, /verificationStatus:\s*['"]verified['"]/);

  for (const model of [
    "Norma",
    "NormaVersion",
    "NormaArticle",
    "NormaReform",
    "NormaSourceVerification",
  ]) {
    assert.match(schema, new RegExp(`model\\s+${model}\\b`));
  }
});

test("jurisprudencia consulta filtros internos y muestra sólo criterios verificados", () => {
  const page = read("app/legal-hub/jurisprudencia/page.tsx");
  const api = read("app/api/jurisprudencia/route.ts");
  const validation = read("lib/jurisprudencia/validation.ts");
  const importer = read("lib/jurisprudencia/sjfImporter.ts");

  for (const field of [
    "registroDigital",
    "materia",
    "organoEmisor",
    "epoca",
    "tipoCriterio",
    "fechaPublicacion",
    "temaJuridico",
  ]) {
    assert.match(page, new RegExp(field));
  }
  assert.match(
    page,
    /No se encontraron criterios jurídicos verificados en la base local\./
  );
  assert.match(api, /prisma\.jurisprudencia\.findMany/);
  assert.match(api, /precedents/);
  assert.match(api, /contradictions/);
  assert.match(page, /name="fechaPublicacion"/);
  assert.match(page, /name="temaJuridico"/);
  assert.match(validation, /verificationStatus:\s*['"]verified['"]/);
  assert.match(importer, /browser_required/);
  assert.doesNotMatch(importer, /captcha.*(?:bypass|solve)|(?:bypass|solve).*captcha/i);
});

test("expedientes persiste CRUD real y reserva localStorage para el borrador", () => {
  const page = read("app/legal-hub/expedientes/page.tsx");
  const access = read("lib/cases/access.ts");
  const validation = read("lib/cases/validation.ts");
  const rootApi = read("app/api/cases/route.ts");

  // La pantalla usa el wrapper autorizado para adjuntar ADMIN_TOKEN; conserva
  // compatibilidad con el fetch directo de la implementación anterior.
  assert.match(page, /(?:authorizedFetch|fetch)\(['"`]\/api\/cases/);
  assert.match(page, /Nuevo expediente/);
  assert.match(page, /Editar/);
  assert.match(page, /Eliminar/);
  assert.match(page, /Agregar parte/);
  assert.match(page, /Agregar actuación/);
  assert.match(page, /Agregar plazo/);
  assert.match(page, /Agregar documento/);
  assert.match(page, /Exportar JSON/);
  assert.match(page, /localStorage\.(?:getItem|setItem)\(DRAFT_KEY/);

  assert.match(access, /requireCaseAccess/);
  assert.match(access, /organizationId:\s*membership\.orgId/);
  assert.match(access, /userId:\s*membership\.userId/);
  assert.match(rootApi, /organizationId:\s*access\.context\.organizationId/);
  assert.doesNotMatch(validation, /organizationId:\s*input\./);
  assert.doesNotMatch(validation, /userId:\s*input\./);
});

test("expedientes maneja errores de token en todas las acciones protegidas", () => {
  const page = read("app/legal-hub/expedientes/page.tsx");
  const sections = [
    ["handleDeleteCase", "handleExport"],
    ["handleExport", "mutateChild"],
    ["mutateChild", "markCaseReviewed"],
    ["markCaseReviewed", "filteredCases"],
  ];

  for (const [name, next] of sections) {
    const start = page.indexOf(`const ${name}`);
    const end = page.indexOf(`const ${next}`, start + 1);
    assert.ok(start >= 0 && end > start, `No se encontró la sección ${name}`);
    const section = page.slice(start, end);
    assert.match(section, /try\s*\{/i, `${name} debe envolver la llamada protegida`);
    assert.match(section, /catch\s*\(error\)/i, `${name} debe manejar errores`);
    assert.match(section, /friendlyError|ADMIN_TOKEN_REQUIRED/, `${name} debe mostrar un error amigable`);
  }
});

test("machotes expone las 15 plantillas y exportadores reales con revisión profesional", () => {
  const result = runTs(`
    import { PROFESSIONAL_TEMPLATES } from "./lib/templates/templateDefinitions";
    console.log(JSON.stringify({
      count: PROFESSIONAL_TEMPLATES.length,
      categories: Array.from(new Set(PROFESSIONAL_TEMPLATES.map((item) => item.category))),
      withoutRequired: PROFESSIONAL_TEMPLATES.filter((item) => !item.sections.some((section) => section.required)).map((item) => item.id),
      unsafeBasis: PROFESSIONAL_TEMPLATES.filter((item) => !item.legalBasis.startsWith("[PENDIENTE: verificar fundamento")).map((item) => item.id),
      genericMarkers: PROFESSIONAL_TEMPLATES.filter((item) => /\\[(?:Desarrollar|Agregar|Relacionar)/.test(JSON.stringify(item))).map((item) => item.id)
    }));
  `);

  assert.equal(result.count, 15);
  for (const category of [
    "Amparo",
    "Civil",
    "Familiar",
    "Mercantil",
    "Administrativo/Fiscal",
    "General",
  ]) {
    assert.ok(result.categories.includes(category), `missing category ${category}`);
  }
  assert.deepEqual(result.withoutRequired, []);
  assert.deepEqual(result.unsafeBasis, []);
  assert.deepEqual(result.genericMarkers, []);

  const page = read("app/legal-hub/machotes/page.tsx");
  const aiRoute = read("app/api/templates/ai-assist/route.ts");
  const docx = read("lib/templates/exportDocx.ts");
  const pdf = read("lib/templates/exportPdf.ts");
  assert.match(page, /validateTemplateValues/);
  assert.match(page, /exportToDocx/);
  assert.match(page, /generatePrintHtml/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(page, /ADVERTENCIA PROFESIONAL/);
  assert.match(page, /Texto propuesto/);
  assert.match(page, /Fuentes utilizadas/);
  assert.match(page, /Elementos pendientes/);
  assert.match(page, /confidenceLevel/);
  assert.match(aiRoute, /orderBy:\s*\{\s*verifiedAt:\s*['"]desc['"]\s*\}/);
  assert.match(docx, /new Document/);
  assert.match(pdf, /escapeHtml/);
  assert.match(pdf, /window\.print/);
});

test("machotes conserva workspace profesional y vista de documento tipo hoja", () => {
  const page = read("app/legal-hub/machotes/page.tsx");
  const css = read("app/globals.css");

  assert.match(page, /machotes-workspace/);
  assert.match(page, /machote-template-toolbar/);
  assert.match(page, /machote-preview-panel/);
  assert.match(page, /machote-document-paper/);
  assert.doesNotMatch(page, /legal-two-column/);

  assert.match(css, /\.machotes-workspace/);
  assert.match(css, /\.machote-document-paper/);
  assert.match(css, /background:\s*#fbfaf7/);
  assert.match(css, /\.machote-action-grid/);
});

test("fallback local del consultor usa lenguaje jurídico, no texto técnico de proveedores", () => {
  const router = read("lib/ai/router.ts");
  assert.doesNotMatch(
    router,
    /Reporte local simplificado debido a indisponibilidad de proveedores de IA/
  );
  assert.match(router, /Resultado jurídico actualizado|Resultado juridico actualizado/);
  assert.match(router, /fuentes oficiales/);
});
