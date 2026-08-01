import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

test('Admin Token inputs use type="password" with toggle', () => {
  const filesToCheck = [
    'app/ai/page.tsx',
    'app/rag/page.tsx',
    'app/admin/sources/page.tsx'
  ];

  for (const file of filesToCheck) {
    const content = fs.readFileSync(path.join(root, file), 'utf-8');
    
    // Check that we're using the toggle logic for the password field
    const hasToggle = content.includes('type={showToken ? "text" : "password"}');
    const hasPasswordOnly = content.includes('type="password"');
    
    assert.ok(hasToggle || hasPasswordOnly, `${file} debe usar type="password" o un toggle seguro para el token.`);
    
    // Ensure that token state is not accidentally logged
    assert.ok(!content.includes('console.log(token)'), `${file} no debe imprimir el token en consola.`);
  }
});

test('Admin Token is managed securely in localStorage', () => {
  const libPath = path.join(root, 'lib/client/adminToken.ts');
  const content = fs.readFileSync(libPath, 'utf-8');
  
  assert.ok(content.includes("ADMIN_TOKEN_STORAGE_KEY = 'juridico_admin_token'"), 'El token debe guardarse bajo la clave juridico_admin_token');
  assert.ok(!content.includes('console.log'), 'No se debe imprimir información en lib/client/adminToken.ts');
  assert.ok(!content.includes('console.error'), 'No se debe imprimir errores explícitos del token en la consola (lib/client/adminToken.ts)');
});
