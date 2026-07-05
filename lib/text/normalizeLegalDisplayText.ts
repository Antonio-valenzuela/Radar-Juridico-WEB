const MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/P�blicas/g, "Públicas"],
  [/P�blico/g, "Público"],
  [/P�blica/g, "Pública"],
  [/Protecci�n/g, "Protección"],
  [/Administraci�n/g, "Administración"],
  [/Relaci�n/g, "Relación"],
  [/M�xico/g, "México"],
  [/Federaci�n/g, "Federación"],
  [/Secretar�a/g, "Secretaría"],
  [/Fiscal�a/g, "Fiscalía"],
  [/C�digo/g, "Código"],
  [/Constituci�n/g, "Constitución"],
  [/Energ�a/g, "Energía"],
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

  for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}
