import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--eval", code],
    { encoding: "utf8", env: { ...process.env, NODE_ENV: "development" }, timeout: 45000 }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }
  return JSON.parse(result.stdout.trim());
}

test("parseDofNote limpia chrome DOF y conserva decreto jurídico", () => {
  const result = runTs(`
    import { parseDofNote } from "./lib/ingest/dofParser";
    const html = \`
      <html>
        <head><title>DOF - Diario Oficial de la Federación</title><script>bad()</script><style>.x{}</style></head>
        <body>
          <header>Inicio Buscar Contacto</header>
          <nav>Su navegador no soporta JavaScript Login Trámites</nav>
          <table><tr><td class="txt">
            <h1>DECRETO por el que se reforman disposiciones de la Ley Federal del Trabajo</h1>
            <p>Secretaría del Trabajo y Previsión Social</p>
            <p>Al margen un sello con el Escudo Nacional, que dice: Estados Unidos Mexicanos.</p>
            <p>Se reforman y adicionan diversas disposiciones de la Ley Federal del Trabajo.</p>
            <p>Transitorios. Primero. El presente Decreto entrará en vigor al día siguiente.</p>
          </td></tr></table>
          <footer>Mapa del sitio Contacto</footer>
        </body>
      </html>\`;
    const parsed = parseDofNote(html, "https://www.dof.gob.mx/nota_detalle.php?codigo=1");
    console.log(JSON.stringify(parsed));
  `);

  assert.equal(result.quality.status, "valid");
  assert.match(result.title, /DECRETO/);
  assert.match(result.text, /Ley Federal del Trabajo/);
  assert.equal(result.authority, "Secretaría del Trabajo y Previsión Social");
  assert.doesNotMatch(result.text, /JavaScript|Login|Mapa del sitio|bad/);
});

test("parseDofNote clasifica portada o login como ruido", () => {
  const result = runTs(`
    import { parseDofNote } from "./lib/ingest/dofParser";
    const parsed = parseDofNote("<html><body><nav>Login</nav><p>Su navegador no soporta JavaScript</p></body></html>", "https://www.dof.gob.mx");
    console.log(JSON.stringify(parsed.quality));
  `);

  assert.equal(result.status, "noise");
  assert.ok(result.reasons.length > 0);
});

test("dofWeb usa parseDofNote y no extrae toda la página cruda", () => {
  const content = fs.readFileSync("lib/ingest/dofWeb.ts", "utf8");

  assert.match(content, /parseDofNote/);
  assert.doesNotMatch(content, /stripHtml\(noteHtml\)\.replace/);
  assert.match(content, /category:\s*"ruido"|category:\s*'ruido'/);
  assert.match(content, /quality/);
});
