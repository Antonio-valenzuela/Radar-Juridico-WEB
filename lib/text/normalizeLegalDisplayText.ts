const MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/�ltima/g, "Última"],
  [/�ltimo/g, "Último"],
  [/A�os/g, "Años"],
  [/a�os/g, "años"],
  [/P�blicas/g, "Públicas"],
  [/P�blico/g, "Público"],
  [/P�blica/g, "Pública"],
  [/Protecci�n/g, "Protección"],
  [/Administraci�n/g, "Administración"],
  [/Cronol�gico/g, "Cronológico"],
  [/Art�culo/g, "Artículo"],
  [/Relaci�n/g, "Relación"],
  [/M�s/g, "Más"],
  [/M�xico/g, "México"],
  [/Federaci�n/g, "Federación"],
  [/Secretar�a/g, "Secretaría"],
  [/Fiscal�a/g, "Fiscalía"],
  [/C�DIGO/g, "CÓDIGO"],
  [/C�digo/g, "Código"],
  [/CONSTITUCI�N/g, "CONSTITUCIÓN"],
  [/Constituci�n/g, "Constitución"],
  [/Energ�a/g, "Energía"],
  [/P�gina/g, "Página"],
  [/C�mara/g, "Cámara"],
  [/Jur�dico/g, "Jurídico"],
];

const HTML_ENTITY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/&nbsp;|&#160;/gi, " "],
  [/&quot;|&#34;/gi, '"'],
  [/&apos;|&#39;/gi, "'"],
  [/&amp;|&#38;/gi, "&"],
  [/&lt;|&#60;/gi, "<"],
  [/&gt;|&#62;/gi, ">"],
  [/&ldquo;|&rdquo;/gi, '"'],
  [/&lsquo;|&rsquo;/gi, "'"],
];

export function normalizeLegalDisplayText(value: string | null | undefined): string {
  if (!value) return "";

  let normalized = value
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ");

  for (const [pattern, replacement] of HTML_ENTITY_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)));

  for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}
