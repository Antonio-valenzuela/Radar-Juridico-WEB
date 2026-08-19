import 'server-only';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer, PageNumber, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle } from 'docx';
import { UniversalLegalDocument } from './types';
import { stripTrustMarkers } from './trustLayer';

function parseTextToRuns(text: string, baseBold: boolean = false): TextRun[] {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  const runs: TextRun[] = [];

  parts.forEach((part, idx) => {
    const isBold = idx % 2 === 1 || baseBold;
    const italicParts = part.split(/\*([^*]+)\*/g);
    italicParts.forEach((iPart, iIdx) => {
      const isItalic = iIdx % 2 === 1;
      runs.push(
        new TextRun({
          text: iPart,
          font: 'Arial',
          size: 24,
          bold: isBold,
          italics: isItalic,
        })
      );
    });
  });

  return runs;
}

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
            children: parseTextToRuns(line, true),
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
      if (block.type === 'Table' && block.tableData) {
        const headers = block.tableData.headers || [];
        const rows = block.tableData.rows || [];
        const tableRows: DocxTableRow[] = [];

        if (headers.length > 0) {
          tableRows.push(
            new DocxTableRow({
              children: headers.map((h: string) => (
                new DocxTableCell({
                  width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ children: [new TextRun({ text: h, font: 'Arial', size: 20, bold: true })] })],
                  shading: { fill: 'F2F2F2' },
                })
              )),
            })
          );
        }

        rows.forEach((row: string[]) => {
          const cellWidthPercentage = headers.length > 0 ? 100 / headers.length : 100 / Math.max(row.length, 1);
          tableRows.push(
            new DocxTableRow({
              children: row.map((cell: string) => (
                new DocxTableCell({
                  width: { size: cellWidthPercentage, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ children: [new TextRun({ text: cell, font: 'Arial', size: 20 })] })],
                })
              )),
            })
          );
        });

        if (tableRows.length > 0) {
          children.push(
            new DocxTable({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'D3D3D3' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D3D3D3' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'D3D3D3' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'D3D3D3' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D3D3D3' },
                insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D3D3D3' },
              },
            }) as any
          );
          children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        }
        continue;
      }

      const cleanText = stripTrustMarkers(block.text);
      const lines = cleanText.split('\n').filter((l) => l.trim().length > 0);

      lines.forEach((line) => {
        const isHeaderLine = /^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO|AGRAVIO|HECHO|PRUEBA|PETITORIO)/i.test(line);
        children.push(
          new Paragraph({
            alignment: isHeaderLine ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
            children: parseTextToRuns(line, isHeaderLine),
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
