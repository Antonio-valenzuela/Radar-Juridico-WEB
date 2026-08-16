import { describe, expect, it } from 'vitest';
import {
  buildAutoContext,
  buildGenerationContext,
  createSourceDocument,
  requiresValidatedSources,
} from '../../lib/legal-engine/context';
import { runGenerationPipeline } from '../../lib/legal-engine/pipeline';
import { runMultiStepLegalQuery } from '../../lib/legal-engine/multiStep';

const fullSource = createSourceDocument({
  id: 'sentencia-1',
  filename: 'sentencia.pdf',
  sourceValidated: true,
  pages: [
    { page: 1, text: 'AMPARO DIRECTO 800/2024. Antecedentes de la resolución.', chars: 63 },
    { page: 2, text: 'La autoridad responsable sostuvo que la carga de la prueba corresponde a la parte demandada.', chars: 97 },
    { page: 3, text: 'PUNTOS RESOLUTIVOS. Se niega el amparo solicitado.', chars: 54 },
  ],
});

describe('motor universal de documentos', () => {
  it('conserva la extracción por página y recupera evidencia fuera del inicio del documento', () => {
    const context = buildGenerationContext({
      instruction: 'Refuta el criterio de carga de la prueba',
      sources: [fullSource],
      sectionTitle: 'Agravio primero',
    });

    expect(context.text).toContain('carga de la prueba corresponde');
    expect(context.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: 'sentencia-1', page: 2 }),
      ])
    );
  });

  it('bloquea la generación cuando una fuente no está validada', async () => {
    const unsafeSource = createSourceDocument({
      id: 'escaneo-1',
      filename: 'escaneo.pdf',
      sourceValidated: false,
      pages: [{ page: 1, text: 'texto incompleto', chars: 16 }],
    });

    await expect(runGenerationPipeline({
      userInstruction: 'Necesito un escrito de contestación',
      sourceDocuments: [unsafeSource],
    })).rejects.toThrow(/fuente no.*validada/i);

    expect(requiresValidatedSources([unsafeSource])).toBe(true);
  });

  it('no reemplaza una sección editada manualmente al regenerar', async () => {
    const doc = await runGenerationPipeline({
      userInstruction: 'Necesito un escrito de contestación',
      sourceDocuments: [fullSource],
      generateSection: async ({ section }) => `Contenido generado para ${section.title}`,
    });
    const target = doc.sections.find((section) => section.type === 'argument')!;
    target.isManuallyEdited = true;
    target.content[0].isManuallyEdited = true;
    target.content[0].text = 'Texto corregido por el abogado.';

    const result = await runGenerationPipeline({
      existingDocument: doc,
      targetSection: target.id,
      userInstruction: 'Amplía el argumento',
      sourceDocuments: [fullSource],
      generateSection: async () => 'Texto que no debe sustituir la edición.',
    });

    expect(result.sections.find((section) => section.id === target.id)?.content[0].text)
      .toBe('Texto corregido por el abogado.');
  });

  it('limita el modo multi-step y registra una traza de recuperación', async () => {
    const result = await runMultiStepLegalQuery({
      question: '¿Qué argumento responde a la carga de la prueba?',
      sources: [fullSource],
      maxSteps: 2,
    });

    expect(result.trace).toHaveLength(2);
    expect(result.context.references.some((reference) => reference.page === 2)).toBe(true);
  });

  it('agrega AutoContext de encabezado a cada fragmento recuperado', () => {
    const chunks = buildAutoContext(fullSource, 70);
    expect(chunks.every((chunk) => chunk.text.includes('Documento: sentencia.pdf'))).toBe(true);
  });
});
