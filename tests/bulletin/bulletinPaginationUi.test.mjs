import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const component = fs.readFileSync('app/components/BulletinWatchPanel.tsx', 'utf8');
const detailRoute = fs.readFileSync(
  'app/api/legal/cases/[id]/bulletin/publications/[publicationId]/route.ts',
  'utf8',
);

test('el panel pagina publicaciones e historial mediante sus endpoints dedicados', () => {
  assert.match(component, /bulletin\/publications\?page=/);
  assert.match(component, /bulletin\/history\?page=/);
  assert.match(component, /Cargar m[aá]s publicaciones/);
  assert.match(component, /Cargar m[aá]s consultas/);
  assert.match(component, /Anterior/);
});

test('la evidencia se descarga desde el detalle de una publicación', () => {
  assert.match(component, /bulletin\/publications\/\$\{entryId\}/);
  assert.doesNotMatch(component, /JSON\.stringify\(payload/);
  assert.match(component, /Descargar evidencia JSON/);
  assert.match(detailRoute, /httpStatus/);
  assert.match(detailRoute, /hash/);
  assert.match(detailRoute, /adapterVersion/);
  assert.match(detailRoute, /evidence/);
});
