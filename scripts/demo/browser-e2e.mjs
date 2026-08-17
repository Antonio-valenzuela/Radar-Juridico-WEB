import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, statSync, readFileSync } from 'fs';

const BASE = 'http://localhost:3100';
const CASE_PDF = 'C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/0129000036717288006AST.PDF';
const OUT = 'C:/Users/yahir/AppData/Local/Temp/opencode/br5';
mkdirSync(OUT, { recursive: true });

const MARK = 'MARCA-EDITADA-BR5';
const results = [];
const print = (paso, estado, detalle = '') => {
  results.push({ paso, estado, detalle });
  console.log(`[${estado.toUpperCase()}] ${paso} :: ${String(detalle).slice(0, 240)}`);
};
const low = (s) => s.toLowerCase();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();
const errors = [];
const apiLog = [];
const genResponses = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('response', async (r) => {
  if (r.url().includes('/api/')) {
    apiLog.push(`${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()}`);
    if (new URL(r.url()).pathname === '/api/legal-engine/generate') {
      try {
        genResponses.push(await r.json());
      } catch { genResponses.push({ status: r.status() }); }
    }
  }
});

const DRAFT_ID = 'cmswb3pne0001j83sw2h6j6ye';
await ctx.addInitScript((id) => {
  try {
    if (!localStorage.getItem('jr_last_draft_id')) localStorage.setItem('jr_last_draft_id', id);
  } catch (e) {}
}, DRAFT_ID);

const waitForButton = async (namePattern, tries = 25, label = '') => {
  const loc = page.getByRole('button', { name: namePattern }).first();
  for (let i = 0; i < tries; i++) {
    const n = await loc.count().catch(() => 0);
    if (n > 0) return loc;
    await page.waitForTimeout(500);
  }
  throw new Error(`botón ${label || namePattern} no apareció tras ${tries * 500}ms`);
};

try {
  await page.goto(`${BASE}/legal-hub/machotes`, { waitUntil: 'networkidle', timeout: 60000 });
  const bodyA = low(await page.locator('body').innerText());
  const workspaceOk = bodyA.includes('motor universal') || bodyA.includes('biblioteca');
  let autoLoadOk = false;
  for (let i = 0; i < 20; i++) {
    if (/página \d+ de \d+/.test(low(await page.locator('body').innerText()))) { autoLoadOk = true; break; }
    await page.waitForTimeout(1000);
  }
  print('A. workspace + auto-carga', workspaceOk && autoLoadOk ? 'OK' : 'REVISAR', workspaceOk && autoLoadOk ? 'biblioteca + borrador en hoja Carta' : `workspace=${workspaceOk} paginación=${autoLoadOk}`);

  const tabs = {
    'Motor Universal': /Motor Universal/,
    'Escritos Iniciales': /Escritos Iniciales/,
    'Contestaciones y Recursos': /Contestaciones y Recursos/,
    'Mis Plantillas': /Mis Plantillas/,
  };
  let tabsOk = true;
  const tabDetail = [];
  for (const [label, re] of Object.entries(tabs)) {
    const btn = page.getByRole('button', { name: re }).first();
    if ((await btn.count()) === 0) { tabsOk = false; tabDetail.push(`${label}:ausente`); continue; }
    try {
      await btn.click({ force: true, timeout: 5000 });
    } catch (e) { tabsOk = false; tabDetail.push(`${label}:click`); continue; }
    await page.waitForTimeout(1200);
    if (label === 'Mis Plantillas') {
      const bodyT = low(await page.locator('body').innerText());
      if (!bodyT.includes('recurso de revision amparo directo 800-2024')) { tabsOk = false; tabDetail.push(`${label}:sin plantilla`); }
    }
    if (label === 'Escritos Iniciales' || label === 'Contestaciones y Recursos') {
      const closeBtn = page.getByRole('button', { name: '✕', exact: true }).first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(600);
      }
    }
    tabDetail.push(label);
  }
  print('T. pestañas A-D', tabsOk ? 'OK' : 'FALLIDO', tabsOk ? tabDetail.join(' | ') : tabDetail.join(' | '));
  await page.getByRole('button', { name: /Motor Universal/ }).first().click({ force: true });
  await page.waitForTimeout(800);

  await page.setInputFiles('input[type="file"]', CASE_PDF);
  let uploadState = 'timeout';
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1500);
    const body = low(await page.locator('body').innerText());
    const apiOk = apiLog.some((l) => l.includes('/api/templates/analyze-upload') && l.includes('-> 200'));
    if (apiOk && (body.includes('verificada') || body.includes('procesado'))) { uploadState = 'done'; break; }
  }
  writeFileSync(`${OUT}/01-tras-upload.txt`, await page.locator('body').innerText());
  print('B. subir PDF real', uploadState === 'done' ? 'OK' : 'FALLIDO', uploadState);

  await waitForButton(/Redactar Nuevo Escrito/, 25, 'Redactar');
  await page.getByRole('button', { name: /Redactar Nuevo Escrito/ }).first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(2000);
  const bodyC = low(await page.locator('body').innerText());
  writeFileSync(`${OUT}/02-modal.txt`, await page.locator('body').innerText());
  const fichaOk = bodyC.includes('ficha del caso detectada') && bodyC.includes('800/2024');
  print('C. modal + ficha 800/2024', fichaOk ? 'OK' : 'FALLIDO', fichaOk ? 'ficha visible en modal' : 'sin ficha');

  const tplCard = page.locator('div', { hasText: 'Recurso de Revision Amparo Directo 800-2024 Version Ampliada' }).last();
  if (await tplCard.count() > 0) {
    await tplCard.click();
    await page.waitForTimeout(800);
    print('D. seleccionar machote real en modal', 'OK', 'plantilla 800-2024 seleccionada');
  } else {
    print('D. seleccionar machote real en modal', 'SALTADO', 'tarjeta de plantilla no encontrada');
  }

  await waitForButton(/Generar Escrito Completo/, 25, 'Generar');
  await page.getByRole('button', { name: /Generar Escrito Completo/ }).first().click();
  let genRes = 'no response';
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(2000);
    genRes = apiLog.find((l) => l.includes('/api/legal-engine/generate ')) || genRes;
    if (/\/api\/legal-engine\/generate\s+->\s+\d{3}/.test(genRes)) break;
    const bodyE = low(await page.locator('body').innerText());
    if (bodyE.includes('generación ia no disponible')) { genRes = '503 en pantalla'; break; }
  }
  const honesto503 = genRes.includes('503') || genRes === '503 en pantalla';
  const apiBody = genResponses[genResponses.length - 1] || {};
  const apiHonesto = apiBody?.ok === false && String(apiBody?.error || '').includes('GENERACIÓN IA NO DISPONIBLE');
  let mensajeOk = false;
  for (let i = 0; i < 5; i++) {
    const bodyE = low(await page.locator('body').innerText());
    if (bodyE.includes('generación ia no disponible')) { mensajeOk = true; break; }
    await page.waitForTimeout(1000);
  }
  writeFileSync(`${OUT}/03-tras-generar.txt`, await page.locator('body').innerText());
  const evidencia = apiHonesto
    ? `API 503 + body {ok:false, error:${JSON.stringify(apiBody.error)}, aiStatus:${JSON.stringify(apiBody.aiStatus)}, provider:${JSON.stringify(apiBody.provider)}, model:${JSON.stringify(apiBody.model)}}`
    : `solo banner=${mensajeOk}`;
  print('E. generar IA (honestidad)', honesto503 && (apiHonesto || mensajeOk) ? 'OK' : 'FALLIDO', `${evidencia} | banner=${mensajeOk}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  const getPage = async () => {
    const m = (await page.locator('body').innerText()).match(/Página (\d+) de (\d+)/);
    return m ? `${m[1]}/${m[2]}` : '?';
  };
  const antes = await getPage();
  await page.locator('main').getByRole('button', { name: '→', exact: true }).first().click();
  await page.waitForTimeout(500);
  const despues = await getPage();
  await page.locator('main').getByRole('button', { name: '←', exact: true }).first().click();
  await page.waitForTimeout(500);
  const regreso = await getPage();
  print('G. paginación', antes !== despues && regreso === antes ? 'OK' : 'FALLIDO', `${antes} → ${despues} → ${regreso}`);

  const searchInput = page.getByPlaceholder('Buscar...');
  if (await searchInput.count() > 0) {
    await searchInput.fill('PETITORIOS');
    await page.waitForTimeout(900);
    const bodyH = await page.locator('body').innerText();
    print('H. buscar', /(\d+)\/\d+/.test(bodyH) ? 'OK' : 'REVISAR', /(\d+)\/\d+/.test(bodyH) ? 'contador de coincidencias' : 'sin contador');
  } else { print('H. buscar', 'SALTADO', 'no encontrado'); }

  const editBtn = page.getByTitle('Editar este párrafo').first();
  if (await editBtn.count() > 0) {
    await editBtn.hover();
    await editBtn.click({ force: true });
    await page.waitForTimeout(400);
    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0) {
      const current = (await textarea.inputValue()) || '';
      await textarea.fill(`${current}\n\n${MARK}`);
      await page.getByRole('button', { name: /Guardar cambios/ }).first().click();
      await page.waitForTimeout(800);
      const bodyI = low(await page.locator('body').innerText());
      const editadoOk = bodyI.includes(low(MARK)) && bodyI.includes('modificado');
      print('I. editar párrafo', editadoOk ? 'OK' : 'FALLIDO', editadoOk ? 'texto guardado + badge Modificado' : 'sin marca/badge');
    } else { print('I. editar párrafo', 'FALLIDO', 'textarea no apareció'); }
  } else { print('I. editar párrafo', 'SALTADO', 'sin botón ✏️ en página 1'); }

  const saveBtn = page.getByRole('button', { name: /Salvar/ }).first();
  try {
    await saveBtn.click({ timeout: 10000 });
  } catch (e) {
    print('J. salvar borrador', 'REVISAR', `click falló: ${e.message.split('\n')[0]}`);
  }
  await page.waitForTimeout(1500);
  let savedFeedback = false;
  for (let i = 0; i < 15; i++) {
    const bodyJ = low(await page.locator('body').innerText());
    if (bodyJ.includes('borrador guardado') || bodyJ.includes('salvado')) { savedFeedback = true; break; }
    await page.waitForTimeout(1500);
  }
  print('J. salvar borrador', savedFeedback ? 'OK' : 'FALLIDO', savedFeedback ? 'feedback éxito' : 'sin feedback');

  const exportMenuBtn = page.getByRole('button', { name: /Texto Final/ }).first();
  const exportDocx = page.getByRole('button', { name: /Exportar DOCX/ }).first();
  if (await exportMenuBtn.count() > 0) {
    await exportMenuBtn.click();
    await page.waitForTimeout(500);
  }
  if (await exportDocx.count() > 0) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), exportDocx.click()]);
    const p = `${OUT}/salida-browser.docx`;
    await dl.saveAs(p);
    print('K1. export DOCX', 'OK', `${statSync(p).size} bytes`);
  } else { print('K1. export DOCX', 'SALTADO', 'no encontrado'); }
  const pdfBtn = page.getByRole('button', { name: /Exportar PDF/ }).first();
  if (await pdfBtn.count() === 0 && (await page.getByRole('button', { name: /Texto Final/ }).count()) > 0) {
    await page.getByRole('button', { name: /Texto Final/ }).first().click();
    await page.waitForTimeout(500);
  }
  if (await pdfBtn.count() > 0) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), pdfBtn.click()]);
    const p = `${OUT}/salida-browser.pdf`;
    await dl.saveAs(p);
    const buf = readFileSync(p);
    const isPdf = buf.subarray(0, 4).toString('latin1') === '%PDF';
    print('K2. export PDF real', isPdf ? 'OK' : 'FALLIDO', `${buf.length} bytes, firma=${buf.subarray(0, 4).toString('latin1')}`);
  } else { print('K2. export PDF real', 'SALTADO', 'no encontrado'); }

  await page.reload({ waitUntil: 'networkidle' });
  let reloaded = false;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const body = low(await page.locator('body').innerText());
    if (/página \d+ de \d+/.test(body)) { reloaded = true; break; }
  }
  if (reloaded) {
    const searchL = page.getByPlaceholder('Buscar...');
    if (await searchL.count() > 0) {
      await searchL.fill(MARK);
      await page.waitForTimeout(1200);
    }
    const bodyL = low(await page.locator('body').innerText());
    writeFileSync(`${OUT}/04-tras-recargar.txt`, await page.locator('body').innerText());
    print('L. persistencia edición', bodyL.includes(low(MARK)) ? 'OK' : 'FALLIDO', bodyL.includes(low(MARK)) ? 'marca sobrevivió al reload (buscada en el documento)' : 'marca perdida');
  } else {
    print('L. persistencia edición', 'FALLIDO', 'no se pudo reabrir tras recargar');
  }

  const expected503 = errors.filter((e) => e.includes('503 (Service Unavailable)') || e.includes('status of 503')).length;
  const otherErrors = errors.filter((e) => !e.includes('503'));
  print('M. consola', otherErrors.length === 0 ? 'OK' : 'FALLIDO', otherErrors.length ? otherErrors.slice(0, 3).join(' || ') : `solo ${expected503} error(es) 503 esperado(s)`);

  writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n'));
  writeFileSync(`${OUT}/resultados.json`, JSON.stringify(results, null, 2));
} catch (e) {
  print('FATAL', 'FALLIDO', e.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => r.estado === 'FALLIDO').length;
console.log(`\n== NAVEGADOR: ${results.length} pasos, ${failed} FAIL(s) ==`);