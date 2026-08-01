import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('expediente incluye pestaña y acciones del Boletín Judicial', () => {
  const page = fs.readFileSync('app/legal-hub/expedientes/page.tsx', 'utf8');
  const component = fs.readFileSync('app/components/BulletinWatchPanel.tsx', 'utf8');
  assert.match(page, /BulletinWatchPanel/);
  assert.match(page, /bolet[ií]n/gi);
  assert.match(component, /Consultar ahora/);
  assert.match(component, /Activar vigilancia/);
  assert.match(component, /Descargar evidencia/);
  assert.match(component, /Coincidencias detectadas/);
  assert.match(component, /publication\.matches/);
  assert.match(component, /previewToken/);
});
