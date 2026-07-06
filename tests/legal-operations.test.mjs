import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }
  return JSON.parse(result.stdout.trim());
}

test("catalogo operativo contiene leyes vigentes requeridas por el abogado", () => {
  const result = runTs(`
    import { buildLawSearchHref, CURRENT_LEGAL_LAWS } from "./lib/legalOperations";
    console.log(JSON.stringify({
      ids: CURRENT_LEGAL_LAWS.map((law) => law.id),
      missingDates: CURRENT_LEGAL_LAWS.filter((law) => !law.lastKnownReform).map((law) => law.id),
      missingUrls: CURRENT_LEGAL_LAWS.filter((law) => !law.officialUrl).map((law) => law.id),
      missingJurisdiction: CURRENT_LEGAL_LAWS.filter((law) => !law.jurisdiction).map((law) => law.id),
      missingUpdateStatus: CURRENT_LEGAL_LAWS.filter((law) => !law.updateStatus).map((law) => law.id),
      missingOfficialName: CURRENT_LEGAL_LAWS.filter((law) => !law.officialName).map((law) => law.id),
      missingArticleHints: CURRENT_LEGAL_LAWS.filter((law) => law.articleSearchHints.length === 0).map((law) => law.id),
      comercioArticleHref: buildLawSearchHref(CURRENT_LEGAL_LAWS.find((law) => law.id === "codigo-comercio"), "artículo 1391")
    }));
  `);

  for (const id of [
    "codigo-civil-federal",
    "codigo-civil-jalisco",
    "codigo-comercio",
    "cnpcf",
    "ley-amparo",
    "cnpp",
    "lgtoc",
    "lgsm",
    "leyes-jalisco",
  ]) {
    assert.ok(result.ids.includes(id), `missing law ${id}`);
  }
  assert.deepEqual(result.missingDates, []);
  assert.deepEqual(result.missingUrls, []);
  assert.deepEqual(result.missingJurisdiction, []);
  assert.deepEqual(result.missingUpdateStatus, []);
  assert.deepEqual(result.missingOfficialName, []);
  assert.deepEqual(result.missingArticleHints, []);
  assert.match(result.comercioArticleHref, /matter=mercantil/);
  assert.match(decodeURIComponent(result.comercioArticleHref).replace(/\+/g, " "), /artículo 1391/);

  const page = fs.readFileSync("app/legal-hub/leyes-vigentes/page.tsx", "utf8");
  assert.match(page, /Jurisdicción/);
  assert.match(page, /Estado de actualización/);
  assert.match(page, /Artículo o concepto/);
});

test("jurisprudencia expone filtros juridicos completos", () => {
  const result = runTs(`
    import { buildJurisprudenceQuery, buildJurisprudenceSearchHref, JURISPRUDENCE_SEARCH_FIELDS } from "./lib/legalOperations";
    const values = {
      keyword: "pensión alimenticia",
      materia: "Familiar",
      registroDigital: "2029999",
      organoEmisor: "Primera Sala",
      epoca: "Undécima Época",
      tipoCriterio: "Jurisprudencia",
      fechaPublicacion: "2026-01-15",
      temaJuridico: "alimentos"
    };
    console.log(JSON.stringify({
      ids: JURISPRUDENCE_SEARCH_FIELDS.map((field) => field.id),
      query: buildJurisprudenceQuery(values),
      href: buildJurisprudenceSearchHref(values)
    }));
  `);

  for (const id of [
    "keyword",
    "materia",
    "registroDigital",
    "organoEmisor",
    "epoca",
    "tipoCriterio",
    "fechaPublicacion",
    "temaJuridico",
  ]) {
    assert.ok(result.ids.includes(id), `missing jurisprudence field ${id}`);
  }
  assert.match(result.query, /registro digital: 2029999/);
  assert.match(result.query, /tipo de criterio: Jurisprudencia/);
  assert.match(result.href, /source=SJF/);
  assert.match(decodeURIComponent(result.href).replace(/\+/g, " "), /Semanario|pensión alimenticia|registro digital/);

  const page = fs.readFileSync("app/legal-hub/jurisprudencia/page.tsx", "utf8");
  assert.match(page, /registroDigital/);
  assert.match(page, /tipoCriterio/);
  assert.match(page, /Semanario Judicial de la Federación/);
  assert.match(page, /Advertencia de verificación/);
});

test("seguimiento de expedientes permite guardar parametros y actuaciones sin brincar portales", () => {
  const result = runTs(`
    import {
      buildCaseSourceUrl,
      CASE_TRACKING_FIELDS,
      CASE_ALERT_RULES,
      CASE_SOURCE_OPTIONS,
      formatCaseSearchParameters,
      getCaseAlertState
    } from "./lib/legalOperations";
    const source = CASE_SOURCE_OPTIONS.find((item) => item.id === "cjf-sise");
    const params = {
      jurisdiction: "Federal",
      court: "Juzgado Segundo de Distrito",
      caseNumber: "123/2026",
      matter: "Amparo",
      actor: "Parte quejosa",
      defendant: "Autoridad responsable"
    };
    console.log(JSON.stringify({
      fields: CASE_TRACKING_FIELDS.map((field) => field.id),
      rules: CASE_ALERT_RULES.map((rule) => rule.id),
      url: buildCaseSourceUrl(source, params),
      formatted: formatCaseSearchParameters(params),
      alert: getCaseAlertState({ actuationCount: 1, lastReviewAt: new Date().toISOString() })
    }));
  `);

  for (const id of ["jurisdiction", "court", "caseNumber", "matter", "actor", "defendant", "source"]) {
    assert.ok(result.fields.includes(id), `missing case field ${id}`);
  }
  assert.ok(result.rules.includes("new-actuation"));
  assert.ok(result.rules.includes("review-window"));
  assert.match(decodeURIComponent(result.url), /expediente=123\/2026/);
  assert.match(decodeURIComponent(result.url).replace(/\+/g, " "), /juzgado=Juzgado Segundo de Distrito/);
  assert.match(result.formatted, /Actor: Parte quejosa/);
  assert.equal(result.alert.label, "Alerta: actuación nueva");

  const page = fs.readFileSync("app/legal-hub/expedientes/page.tsx", "utf8");
  assert.match(page, /localStorage/);
  assert.match(page, /Registrar actuación/);
  assert.match(page, /No intenta brincar login/);
  assert.match(page, /Abrir fuente con parámetros/);
  assert.match(page, /historial|actuations/i);
  assert.match(page, /actor/i);
  assert.match(page, /demandado/i);
});

test("machotes guiados tienen categorias, campos, advertencia y exportacion", () => {
  const result = runTs(`
    import { GUIDED_LEGAL_TEMPLATES } from "./lib/legalOperations";
    console.log(JSON.stringify({
      categories: Array.from(new Set(GUIDED_LEGAL_TEMPLATES.map((item) => item.category))),
      templatesWithoutFields: GUIDED_LEGAL_TEMPLATES.filter((item) => item.fields.length === 0).map((item) => item.id),
      exportFormats: Array.from(new Set(GUIDED_LEGAL_TEMPLATES.flatMap((item) => item.exportFormats)))
    }));
  `);

  for (const category of ["Amparo", "Civil", "Familiar", "Mercantil", "Administrativo/Fiscal", "General"]) {
    assert.ok(result.categories.includes(category), `missing category ${category}`);
  }
  assert.deepEqual(result.templatesWithoutFields, []);
  assert.ok(result.exportFormats.includes("word"));
  assert.ok(result.exportFormats.includes("pdf"));

  const page = fs.readFileSync("app/legal-hub/machotes/page.tsx", "utf8");
  assert.match(page, /requiere revisión profesional/);
  assert.match(page, /downloadWord/);
  assert.match(page, /window\.print/);
  assert.match(page, /setManualDraft/);
  assert.match(page, /Texto generado editable/);
});

test("machotes guiados usan editor juridico profesional y vista tipo hoja", () => {
  const page = fs.readFileSync("app/legal-hub/machotes/page.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");

  assert.match(page, /machotes-workspace/);
  assert.match(page, /machote-template-toolbar/);
  assert.match(page, /Campos obligatorios/);
  assert.match(page, /machote-document-paper/);
  assert.doesNotMatch(page, /legal-two-column/);

  assert.match(css, /\.machotes-workspace/);
  assert.match(css, /\.machote-document-paper/);
  assert.match(css, /background:\s*#fbfaf7/);
  assert.match(css, /\.machote-action-grid/);
});

test("fallback local del consultor usa lenguaje juridico, no texto tecnico de proveedores", () => {
  const router = fs.readFileSync("lib/ai/router.ts", "utf8");
  assert.doesNotMatch(router, /Reporte local simplificado debido a indisponibilidad de proveedores de IA/);
  assert.match(router, /Resultado jurídico actualizado|Resultado juridico actualizado/);
  assert.match(router, /fuentes oficiales/);
});
