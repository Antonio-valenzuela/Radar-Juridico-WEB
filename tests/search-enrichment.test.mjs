import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    timeout: 15000
  });
  if (result.status !== 0) throw new Error(result.stderr || "tsx execution failed");
  return JSON.parse(result.stdout.trim());
}

test("Buscar por entity no usa campo Prisma inexistente", () => {
  const result = runTs(`
    import { parseAdvancedSearch } from "./lib/search/searchParser";
    const parsed = parseAdvancedSearch({ entity: "SAT" });
    const where = JSON.stringify(parsed.whereClause);
    console.log(JSON.stringify({
      hasEntityFieldInWhere: where.includes('"entity"') || where.includes('"entities"'),
      hasPostFilter: parsed.postFilters.entity === "SAT"
    }));
  `);
  assert.equal(result.hasEntityFieldInWhere, false);
  assert.ok(result.hasPostFilter);
});

test("Buscar por authority no usa campo Prisma inexistente", () => {
  const result = runTs(`
    import { parseAdvancedSearch } from "./lib/search/searchParser";
    const parsed = parseAdvancedSearch({ authority: "SCJN" });
    const where = JSON.stringify(parsed.whereClause);
    console.log(JSON.stringify({
      hasAuthorityFieldInWhere: where.includes('"authority"'),
      hasPostFilter: parsed.postFilters.authority === "SCJN"
    }));
  `);
  assert.equal(result.hasAuthorityFieldInWhere, false);
  assert.ok(result.hasPostFilter);
});

test("Buscar por sector no usa campo Prisma inexistente", () => {
  const result = runTs(`
    import { parseAdvancedSearch } from "./lib/search/searchParser";
    const parsed = parseAdvancedSearch({ sector: "empresas" });
    const where = JSON.stringify(parsed.whereClause);
    console.log(JSON.stringify({
      hasSectorFieldInWhere: where.includes('"sector"') || where.includes('"affectedSectors"') || where.includes('"sectors"'),
      hasPostFilter: parsed.postFilters.sector === "empresas"
    }));
  `);
  assert.equal(result.hasSectorFieldInWhere, false);
  assert.ok(result.hasPostFilter);
});

test("/search contiene Enriquecer con IA", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf8");
  assert.ok(content.includes("Enriquecer con IA"));
});
