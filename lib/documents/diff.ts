// lib/documents/diff.ts

import crypto from 'crypto';

interface Change {
  type: 'added' | 'removed' | 'modified';
  before?: string;
  after?: string;
  description: string;
  extractedPlazoDias?: number;
  extractedPorcentaje?: number;
}

export function generateContentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function compareDocuments(
  previousText: string,
  currentText: string
): Change[] {
  const changes: Change[] = [];

  const prevLines = previousText.split('\n');
  const currLines = currentText.split('\n');

  // Línea por línea (simple diff)
  const removed = prevLines.filter((line) => !currLines.includes(line.trim()));
  const added = currLines.filter((line) => !prevLines.includes(line.trim()));

  for (const line of removed) {
    if (line.trim()) {
      changes.push({
        type: 'removed',
        before: line,
        description: `Removido: ${line.substring(0, 80)}...`,
      });
    }
  }

  for (const line of added) {
    if (line.trim()) {
      changes.push({
        type: 'added',
        after: line,
        description: `Agregado: ${line.substring(0, 80)}...`,
      });
    }
  }

  // Detectar cambios específicos (números)
  const modifiedChanges = detectNumberChanges(previousText, currentText);
  changes.push(...modifiedChanges);

  return changes;
}

function detectNumberChanges(beforeText: string, afterText: string): Change[] {
  const changes: Change[] = [];

  // Patrón: "plazo de XX días" o similar
  const plazoPattern = /plazo de (\d+)\s*días/gi;
  const beforePlazos = Array.from(beforeText.matchAll(plazoPattern)).map((m) => parseInt(m[1]));
  const afterPlazos = Array.from(afterText.matchAll(plazoPattern)).map((m) => parseInt(m[1]));

  if (beforePlazos[0] && afterPlazos[0] && beforePlazos[0] !== afterPlazos[0]) {
    changes.push({
      type: 'modified',
      before: `plazo de ${beforePlazos[0]} días`,
      after: `plazo de ${afterPlazos[0]} días`,
      description: `Plazo de respuesta modificado: de ${beforePlazos[0]} a ${afterPlazos[0]} días`,
      extractedPlazoDias: afterPlazos[0],
    });
  }

  // Patrón: porcentaje
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
  const beforePercent = Array.from(beforeText.matchAll(percentPattern)).map((m) =>
    parseFloat(m[1])
  );
  const afterPercent = Array.from(afterText.matchAll(percentPattern)).map((m) =>
    parseFloat(m[1])
  );

  if (beforePercent[0] && afterPercent[0] && beforePercent[0] !== afterPercent[0]) {
    changes.push({
      type: 'modified',
      before: `${beforePercent[0]}%`,
      after: `${afterPercent[0]}%`,
      description: `Porcentaje modificado: de ${beforePercent[0]}% a ${afterPercent[0]}%`,
      extractedPorcentaje: afterPercent[0],
    });
  }

  return changes;
}
