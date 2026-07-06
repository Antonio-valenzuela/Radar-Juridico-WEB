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

test("legal hub exposes lawyer-requested sections and shortcuts", () => {
  const result = runTs(`
    import { LEGAL_HUB_TABS, LEGAL_SOURCE_SHORTCUTS, LEGAL_TEMPLATES } from "./lib/legalHub";
    console.log(JSON.stringify({
      tabIds: LEGAL_HUB_TABS.map((tab) => tab.id),
      shortcutIds: LEGAL_SOURCE_SHORTCUTS.map((item) => item.id),
      templateIds: LEGAL_TEMPLATES.map((item) => item.id)
    }));
  `);

  for (const tab of ["materias", "leyes", "jurisprudencia", "boletines", "sise", "machotes"]) {
    assert.ok(result.tabIds.includes(tab), `missing tab ${tab}`);
  }
  for (const shortcut of ["civil", "mercantil", "cnpcf", "scjn-jurisprudencia", "cjf-sise", "boletin-federal"]) {
    assert.ok(result.shortcutIds.includes(shortcut), `missing shortcut ${shortcut}`);
  }
  for (const template of ["amparo-indirecto", "recurso-revocacion", "solicitud-simple"]) {
    assert.ok(result.templateIds.includes(template), `missing template ${template}`);
  }
});

test("legal hub page and dashboard navigation are wired", () => {
  const page = fs.readFileSync("app/legal-hub/page.tsx", "utf8");
  const dashboard = fs.readFileSync("app/page.tsx", "utf8");
  const search = fs.readFileSync("app/search/page.tsx", "utf8");
  const legalHub = fs.readFileSync("lib/legalHub.ts", "utf8");
  assert.match(page, /Centro Juridico|Centro Jurídico/);
  assert.match(page, /LEGAL_HUB_TABS/);
  assert.match(dashboard, /href="\/legal-hub"/);

  for (const matter of ["civil", "mercantil", "familiar", "amparo", "cnpcf"]) {
    assert.match(search, new RegExp(`value: '${matter}'|value="${matter}"`), `search filter missing ${matter}`);
    assert.match(legalHub, new RegExp(matter, "i"), `legal hub missing ${matter}`);
  }

  for (const route of ["/legal-hub/leyes-vigentes", "/legal-hub/jurisprudencia", "/legal-hub/expedientes", "/legal-hub/machotes"]) {
    assert.match(page, new RegExp(route.replace(/\//g, "\\/")), `missing route ${route}`);
  }
});

test("official source seed includes lawyer-requested federal and bulletin sources", () => {
  const seed = fs.readFileSync("prisma/seed_sources.ts", "utf8");
  for (const slug of [
    "cnpcf_diputados",
    "cjf_sise",
    "boletin_judicial_federal",
    "boletin_general_cjf",
    "boletin_judicial_jalisco",
  ]) {
    assert.match(seed, new RegExp(slug), `missing seed source ${slug}`);
  }
  assert.match(seed, /Código Nacional de Procedimientos Civiles y Familiares/);
  assert.match(seed, /SISE/);
});
