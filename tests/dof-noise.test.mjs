import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--eval", code],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" },
      timeout: 10_000,
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  try {
    return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
  } catch {
    throw new Error("Invalid JSON returned: " + result.stdout);
  }
}

test("extractBodyText removes JavaScript warnings, login text, and menus", () => {
  const res = runTs(`
    import { extractBodyText } from "./lib/ingest/dofWeb";
    
    const mockHtml = \`
      <html>
        <head>
          <style>body { color: black; }</style>
        </head>
        <body>
          <header>
            <h1>Diario Oficial de la Federación</h1>
            <nav>
              <a href="/">Inicio</a> | <a href="/portada">Portada</a>
            </nav>
          </header>
          
          <noscript>
            <p>Su navegador no soporta JavaScript. Active JavaScript en su navegador para ver correctamente.</p>
          </noscript>
          
          <div id="login-box">
            <span>Iniciar sesión</span>
            <input type="text" placeholder="Usuario" />
            <input type="password" placeholder="Contraseña" />
            <a href="#">Olvidé mi contraseña</a>
          </div>
          
          <div class="menu">
            <ul>
              <li>Búsqueda avanzada</li>
              <li>Contacto</li>
              <li>Trámites</li>
            </ul>
          </div>
          
          <main>
            <p>El Congreso General de los Estados Unidos Mexicanos decreta: Se reforman diversas disposiciones de la Ley Federal del Trabajo.</p>
          </main>
          
          <footer>
            <p>&copy; Copyright 2026 DOF</p>
          </footer>
        </body>
      </html>
    \`;
    
    const text = extractBodyText(mockHtml);
    
    console.log(JSON.stringify({
      text,
      hasJsWarning: text.toLowerCase().includes("soporta javascript") || text.toLowerCase().includes("active javascript"),
      hasLoginText: text.toLowerCase().includes("iniciar sesión") || text.toLowerCase().includes("olvidé mi contraseña"),
      hasMenuText: text.toLowerCase().includes("búsqueda avanzada") || text.toLowerCase().includes("trámites"),
      hasLegalContent: text.includes("El Congreso General de los Estados Unidos Mexicanos decreta"),
    }));
  `);

  assert.equal(res.hasJsWarning, false, "Should not contain JS warnings");
  assert.equal(res.hasLoginText, false, "Should not contain login text");
  assert.equal(res.hasMenuText, false, "Should not contain menu items");
  assert.equal(res.hasLegalContent, true, "Should retain the actual legal text content");
});

test("quarantine matches mostly-noise page content", () => {
  const res = runTs(`
    import { isNoisyContent, checkContentQuality } from "./lib/ingest/quarantine";
    
    const noisyText = "Iniciar sesión usuario contraseña menú cookie política readmore footer header navigation sidebar copyright 2026";
    const goodText = "El Congreso General de los Estados Unidos Mexicanos decreta la reforma constitucional en materia de amparo y derechos humanos, publicada en el Diario Oficial.";
    
    console.log(JSON.stringify({
      isNoisy: isNoisyContent(noisyText),
      isNotNoisy: isNoisyContent(goodText),
      badQuality: checkContentQuality(noisyText, { minWords: 15, minChars: 50 }).ok,
      goodQuality: checkContentQuality(goodText, { minWords: 15, minChars: 50 }).ok,
    }));
  `);

  assert.equal(res.isNoisy, true, "Should identify noisy text as noise");
  assert.equal(res.isNotNoisy, false, "Should not identify real legal text as noise");
  assert.equal(res.badQuality, false, "Mostly noise or short text should fail quality checks");
  assert.equal(res.goodQuality, true, "Real legal text of sufficient length should pass quality checks");
});
