// lib/documents/versionControl.ts

import { prisma } from '@/lib/prisma';
import { generateContentHash, compareDocuments } from './diff';

export async function createOrUpdateDocumentVersion(
  documentId: string,
  content: string
): Promise<{ version: number; isNew: boolean; documentVersionId: string }> {
  // Generar hash
  const newHash = generateContentHash(content);

  // Obtener versiones existentes
  const existingVersions = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { versionNumber: 'desc' },
    take: 1,
  });

  if (existingVersions.length === 0) {
    // Primera versión
    const newVersion = await prisma.documentVersion.create({
      data: {
        documentId,
        versionNumber: 1,
        contentHash: newHash,
        rawText: content,
        originalText: content,
      },
    });
    return { version: 1, isNew: true, documentVersionId: newVersion.id };
  }

  const lastVersion = existingVersions[0];

  // Si hash es igual, no crear nueva versión
  if (lastVersion.contentHash === newHash) {
    return { version: lastVersion.versionNumber, isNew: false, documentVersionId: lastVersion.id };
  }

  // Crear nueva versión y detectar cambios
  const newVersion = await prisma.documentVersion.create({
    data: {
      documentId,
      versionNumber: lastVersion.versionNumber + 1,
      contentHash: newHash,
      rawText: content,
      originalText: content,
    },
  });

  // Comparar y guardar cambios
  const changes = compareDocuments(lastVersion.originalText || lastVersion.rawText || '', content);
  for (const change of changes) {
    await prisma.documentChange.create({
      data: {
        documentVersionId: newVersion.id,
        changeType: change.type,
        before: change.before,
        after: change.after,
        changeDescription: change.description,
        extractedPlazoDias: change.extractedPlazoDias,
        extractedPorcentaje: change.extractedPorcentaje,
      },
    });
  }

  return { version: newVersion.versionNumber, isNew: true, documentVersionId: newVersion.id };
}
