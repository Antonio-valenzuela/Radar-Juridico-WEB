import { RenderedDocument } from './templateTypes';

const numberToOrdinal = (num: number): string => {
  const ordinals = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'DÉCIMO PRIMERO', 'DÉCIMO SEGUNDO', 'DÉCIMO TERCERO', 'DÉCIMO CUARTO', 'DÉCIMO QUINTO', 'DÉCIMO SEXTO', 'DÉCIMO SÉPTIMO', 'DÉCIMO OCTAVO', 'DÉCIMO NOVENO', 'VIGÉSIMO'];
  return ordinals[num - 1] || `${num}º`;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const printText = (value: string): string => escapeHtml(value).replace(/\r?\n/g, '<br>');

export const generatePrintHtml = (doc: RenderedDocument): string => {
  let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(doc.title)}</title>
      <style>
        @page {
          size: letter;
          margin: 2.5cm 2cm 2.5cm 3cm;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
          background: #fff;
        }
        .header-text {
          text-align: right;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .body-text {
          text-align: justify;
          margin-bottom: 20px;
        }
        .section-title {
          text-align: center;
          font-weight: bold;
          font-size: 14pt;
          margin-top: 30px;
          margin-bottom: 15px;
        }
        .section-content {
          text-align: justify;
          margin-bottom: 15px;
        }
        .footer-text {
          text-align: center;
          margin-top: 40px;
          white-space: pre-wrap;
        }
        .generated-at {
          margin-top: 24px;
          font-size: 9pt;
          text-align: center;
        }
        .disclaimer {
          margin-top: 50px;
          font-style: italic;
          font-size: 10pt;
          text-align: justify;
          border-top: 1px solid #000;
          padding-top: 10px;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body onload="window.print()">
  `;

  html += `<div class="header-text">${printText(doc.header)}</div>`;
  html += `<div class="body-text">${printText(doc.body)}</div>`;

  const formatMarkdownToHtml = (text: string): string => {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\r?\n/g, '<br>');
  };

  doc.sections.forEach(sec => {
    html += `<div class="section-title">${escapeHtml(sec.title)}</div>`;

    if (sec.blocks && Array.isArray(sec.blocks)) {
      sec.blocks.forEach((block: any) => {
        if (block.type === 'Table' && block.tableData) {
          const headers = block.tableData.headers || [];
          const rows = block.tableData.rows || [];
          let tableHtml = `<div style="margin: 15px 0; overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 10pt; font-family: Arial, sans-serif; border: 1px solid #ddd;">`;
          if (headers.length > 0) {
            tableHtml += `<thead style="background: #f2f2f2; font-weight: bold; border-bottom: 2px solid #ccc;"><tr>`;
            headers.forEach((h: string) => {
              tableHtml += `<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">${escapeHtml(h)}</th>`;
            });
            tableHtml += `</tr></thead>`;
          }
          tableHtml += `<tbody>`;
          rows.forEach((row: string[]) => {
            tableHtml += `<tr style="border-bottom: 1px solid #ddd;">`;
            row.forEach((cell: string) => {
              tableHtml += `<td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(cell)}</td>`;
            });
            tableHtml += `</tr>`;
          });
          tableHtml += `</tbody></table></div>`;
          html += tableHtml;
        } else {
          html += `<div class="section-content">${formatMarkdownToHtml(block.text)}</div>`;
        }
      });
    } else if (Array.isArray(sec.content)) {
      sec.content.forEach((item, i) => {
        const prefix = sec.numbered ? `<strong>${numberToOrdinal(i + 1)}.—</strong> ` : "- ";
        html += `<div class="section-content">${prefix}${formatMarkdownToHtml(item)}</div>`;
      });
    } else {
      html += `<div class="section-content">${formatMarkdownToHtml(sec.content || '')}</div>`;
    }
  });

  html += `<div class="footer-text">${printText(doc.footer)}</div>`;
  html += `<div class="generated-at">Generado el ${escapeHtml(
    new Date(doc.generatedAt).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    })
  )}</div>`;
  html += `<div class="disclaimer">${printText(doc.disclaimer)}</div>`;

  html += `
    </body>
    </html>
  `;

  return html;
};
