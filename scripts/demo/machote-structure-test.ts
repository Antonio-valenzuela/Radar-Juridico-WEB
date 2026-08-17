import { readFileSync } from 'fs';
import { extractMachoteStructure } from '../../lib/legal-engine/structureBuilder';

async function main() {
  const res = await fetch('http://localhost:3100/api/templates/analyze-upload', {
    method: 'POST',
    body: (() => {
      const buf = readFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/machote-real.pdf');
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: 'application/pdf' }), 'machote-real.pdf');
      return fd;
    })(),
  });
  const json = await res.json();
  const text = json.extractedText || '';
  console.log('TEXT CHARS:', text.length);

  const nodes = extractMachoteStructure(text);
  console.log('SECCIONES EXTRAÍDAS:', nodes.length);
  nodes.forEach((n) => console.log(`  - [${n.type}] ${n.title} (orden ${n.order}, rep=${n.isRepeatable})`));
}

main().catch((e) => { console.error(e); process.exit(1); });