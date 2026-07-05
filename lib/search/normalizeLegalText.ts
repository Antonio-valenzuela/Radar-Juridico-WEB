const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "en", "con", "por", "para", "a", "del", "al", "se", "lo", "su", "sus", "sobre", "entre"
]);

// Basic Mexican legal abbreviations
const ABBREVIATIONS: Record<string, string> = {
  "nna": "niñas niños y adolescentes",
  "dof": "diario oficial de la federacion",
  "sat": "servicio de administracion tributaria",
  "cpeum": "constitucion politica de los estados unidos mexicanos",
  "scjn": "suprema corte de justicia de la nacion",
  "sjf": "semanario judicial de la federacion",
  "pae": "procedimiento administrativo de ejecucion",
  "ptu": "participacion de los trabajadores en las utilidades",
  "isr": "impuesto sobre la renta",
  "iva": "impuesto al valor agregado",
  "imss": "instituto mexicano del seguro social",
  "stps": "secretaria del trabajo y prevision social",
  "issste": "instituto de seguridad y servicios sociales de los trabajadores del estado",
  "infonavit": "instituto del fondo nacional de la vivienda para los trabajadores",
  "profeco": "procuraduria federal del consumidor",
  "inai": "instituto nacional de transparencia acceso a la informacion y proteccion de datos personales",
  "cofepris": "comision federal para la proteccion contra riesgos sanitarios",
  "cre": "comision reguladora de energia",
  "cnh": "comision nacional de hidrocarburos",
  "sener": "secretaria de energia",
  "ine": "instituto nacional electoral",
  "tepjf": "tribunal electoral del poder judicial de la federacion",
  "inm": "instituto nacional de migracion",
  "impi": "instituto mexicano de la propiedad industrial",
  "indautor": "instituto nacional del derecho de autor",
  "lgeepa": "ley general del equilibrio ecologico y la proteccion al ambiente",
  "conagua": "comision nacional del agua",
  "cjf": "consejo de la judicatura federal",
  "tfja": "tribunal federal de justicia administrativa"
};

export function normalizeLegalText(text: string): string {
  if (!text) return "";

  // 1. Lowercase
  let normalized = text.toLowerCase();

  // 2. Remove accents
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 3. Expand abbreviation if it matches directly
  const trimmed = normalized.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  if (ABBREVIATIONS[trimmed]) {
    return ABBREVIATIONS[trimmed];
  }

  // 4. Remove punctuation but keep letters/numbers and basic spacing
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");

  // 5. Split into words
  const words = normalized.split(/\s+/).filter(Boolean);

  // 6. Singular/plural basic handling & abbreviation expanding word-by-word
  const processedWords = words.map(word => {
    // Expand inside word if matching abbreviation
    if (ABBREVIATIONS[word]) {
      return ABBREVIATIONS[word];
    }
    
    // Basic Mexican Spanish singularization
    if (word.endsWith("ces")) {
      return word.slice(0, -3) + "z";
    }
    if (word.endsWith("es") && word.length > 3) {
      return word.slice(0, -2);
    }
    if (word.endsWith("s") && !word.endsWith("is") && !word.endsWith("us") && word.length > 2) {
      return word.slice(0, -1);
    }
    return word;
  });

  // Join, remove stopwords and return clean
  const finalStr = processedWords
    .join(" ")
    .split(/\s+/)
    .filter(w => !STOPWORDS.has(w))
    .join(" ");

  return finalStr;
}
