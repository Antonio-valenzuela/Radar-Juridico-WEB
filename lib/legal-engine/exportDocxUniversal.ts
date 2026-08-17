import 'server-only';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer, PageNumber } from 'docx';
import { UniversalLegalDocument } from './types';
import { stripTrustMarkers } from './trustLayer';

/**
 * Export a UniversalLegalDocument to a DOCX buffer formatted to Mexican judicial standards.
 */
export const exportUniversalToDocx = async (docData: UniversalLegalDocument): Promise<Buffer> => {
  const children: Paragraph[] = [];

  // Header section (Autoridad / Destinatario)
  const headerSection = docData.sections.find((s) => s.type === 'header');
  if (headerSection && headerSection.content.length > 0) {
    headerSection.content.forEach((block) => {
      const cleanText = stripTrustMarkers(block.text);
      cleanText.split('\n').filter((l) => l.trim()).forEach((line) => {
        children.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: line, font: 'Arial', size: 24, bold: true })],
            spacing: { after: 120 },
          })
        );
      });
    });
    children.push(new Paragraph({ text: '', spacing: { after: 240 } }));
  }

  // Render main body sections
  const mainSections = docData.sections.filter((s) => s.type !== 'header');

  for (const sec of mainSections) {
    // Section title
    if (sec.type !== 'closing' && sec.type !== 'signature') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: sec.title.toUpperCase(), font: 'Arial', size: 26, bold: true })],
          spacing: { before: 360, after: 180 },
        })
      );
    }

    // Section content blocks
    for (const block of sec.content) {
      const cleanText = stripTrustMarkers(block.text);
      const lines = cleanText.split('\n').filter((l) => l.trim().length > 0);

      lines.forEach((line) => {
        const isHeaderLine = /^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO|AGRAVIO|HECHO|PRUEBA|PETITORIO)/i.test(line);
        children.push(
          new Paragraph({
            alignment: isHeaderLine ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: line,
                font: 'Arial',
                size: 24,
                bold: isHeaderLine,
              }),
            ],
            spacing: { after: 180, line: 360 }, // 1.5 line spacing
          })
        );
      });
    }
  }

  // Mandatory professional disclaimer
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({
          text: `[DOCUMENTO GENERADO CON MOTOR JURÍDICO UNIVERSAL — REVISIÓN PROFESIONAL OBLIGATORIA ANTES DE PRESENTAR ANTE AUTORIDADES.]`,
          font: 'Arial',
          size: 16,
          italics: true,
        }),
      ],
      spacing: { before: 400 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1417, // 2.5 cm
              bottom: 1417,
              left: 1701, // 3.0 cm
              right: 1134, // 2.0 cm
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: docData.caseRefs.expediente ? `EXPEDIENTE: ${docData.caseRefs.expediente}` : docData.title,
                    font: 'Arial',
                    size: 18,
                    color: '666666',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [
                      `Página `,
                      PageNumber.CURRENT,
                      ' de ',
                      PageNumber.TOTAL_PAGES,
                    ],
                    font: 'Arial',
                    size: 18,
                    color: '666666',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
};
