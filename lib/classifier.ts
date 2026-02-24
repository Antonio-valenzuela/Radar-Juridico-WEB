export interface Classification {
  impacto: "alto" | "medio" | "bajo";
  tipo: string | null;
  tema: string | null;
}

export function classifyItem(title: string, summary?: string | null): Classification {
  const text = `${title} ${summary || ""}`.toUpperCase();
  const summaryUpper = (summary || "").toUpperCase();

  const impacto = detectImpact(text);
  const tipo = detectType(text);
  const tema = detectTema(text, summaryUpper);

  return { impacto, tipo, tema };
}

function detectImpact(text: string): "alto" | "medio" | "bajo" {
  const highImpactKeywords = [
    "REFORMA CONSTITUCIONAL", "NUEVA LEY", "NUEVO CÓDIGO",
    "EXPIDE", "SE EXPIDE", "DECRETO POR EL QUE SE EXPIDE",
    "ACCIÓN DE INCONSTITUCIONALIDAD", "CONTROVERSIA CONSTITUCIONAL",
    "REFORMA INTEGRAL", "ABROGACIÓN", "SE ABROGA"
  ];

  if (highImpactKeywords.some(k => text.includes(k))) return "alto";

  const mediumImpactKeywords = [
    "REFORMA", "REFORMAN", "SE REFORMAN",
    "ADICIONA", "SE ADICIONAN", "ADICIÓN",
    "DEROGA", "SE DEROGAN", "DEROGACIÓN",
    "REGLAMENTO", "ACUERDO GENERAL", "LINEAMIENTOS"
  ];

  if (mediumImpactKeywords.some(k => text.includes(k))) return "medio";

  return "bajo";
}

function detectType(text: string): string | null {
  if (text.includes("DECRETO")) return "DECRETO";
  if (text.includes("LEY") || text.includes("CÓDIGO")) return "LEY";
  if (text.includes("REGLAMENTO")) return "REGLAMENTO";
  if (text.includes("ACUERDO")) return "ACUERDO";
  if (text.includes("AVISO")) return "AVISO";
  if (text.includes("CIRCULAR")) return "CIRCULAR";
  if (text.includes("NOM-") || text.includes("NORMA OFICIAL")) return "NOM";
  if (text.includes("SENTENCIA") || text.includes("TESIS") || text.includes("JURISPRUDENCIA")) return "SENTENCIA";
  if (text.includes("COMUNICADO")) return "COMUNICADO";

  return "NOTA";
}

function detectTema(text: string, summary: string): string | null {
  // 1. PENAL (Prioridad alta)
  const penalKeywords = [
    "PENAL", "CÓDIGO PENAL", "PROCEDIMIENTO PENAL", "ACCIÓN PENAL",
    "PRISIÓN PREVENTIVA", "MINISTERIO PÚBLICO", "FISCALÍA", "DELITO",
    "HOMICIDIO", "ROBO", "FRAUDE", "SECUESTRO", "VÍCTIMA", "IMPUTADO",
    "SENTENCIA CONDENATORIA", "ORDEN DE APREHENSIÓN", "VINCULACIÓN A PROCESO",
    "EXTINCIÓN DE DOMINIO", "DELINCUENCIA ORGANIZADA", "NARCOTRÁFICO",
    "CÁRCEL", "RECLUSORIO", "SANCIÓN PENAL", "PUNIBLE", "CULPABLE",
    "PROCESO PENAL", "JUEZ DE CONTROL", "AUTO DE VINCULACIÓN"
  ];
  if (penalKeywords.some(k => text.includes(k) || summary.includes(k))) return "penal";

  // 2. CIVIL / FAMILIAR
  const civilKeywords = [
    "CIVIL", "CÓDIGO CIVIL", "PROCEDIMIENTO CIVIL", "JUZGADO CIVIL",
    "FAMILIAR", "JUZGADO FAMILIAR", "MATRIMONIO", "DIVORCIO", "SOCIEDAD CONYUGAL",
    "CONCUBINATO", "ALIMENTOS", "PENSIÓN ALIMENTICIA", "GUARDA Y CUSTODIA",
    "PATRIA POTESTAD", "ADOPCIÓN", "TUTELA", "SUCESIÓN", "TESTAMENTO", "HERENCIA",
    "ARRENDAMIENTO", "HIPOTECA", "COMPRAVENTA", "PROPIEDAD", "POSESIÓN",
    "USUFRUCTO", "SERVIDUMBRE", "DAÑO MORAL", "RESPONSABILIDAD CIVIL",
    "COMPENSACIÓN ECONÓMICA", "REGISTRO CIVIL", "ACTA DE NACIMIENTO",
    "OBLIGACIONES", "CONTRATO"
  ];
  if (civilKeywords.some(k => text.includes(k) || summary.includes(k))) return "civil";

  // 3. LABORAL
  const laboralKeywords = [
    "LABORAL", "TRABAJO", "DESPIDO", "HUELGA", "SINDICATO", "JUNTA DE CONCILIACIÓN",
    "CONTRATO COLECTIVO", "INDEMNIZACIÓN CONSTITUCIONAL", "SALARIOS CAÍDOS",
    "PRESTACIONES", "SEGURIDAD SOCIAL"
  ];
  if (laboralKeywords.some(k => text.includes(k) || summary.includes(k))) return "laboral";

  // 4. FISCAL / ADMINISTRATIVO
  const fiscalKeywords = [
    "FISCAL", "IMPUESTO", "SAT", "HACIENDA", "TRIBUTARIO", "ADUANERO",
    "CFF", "ISR", "IVA", "IEPS", "CONTRIBUCIÓN", "CRÉDITO FISCAL",
    "PRESUPUESTO", "EGRESOS", "INGRESOS", "AUDITORÍA"
  ];
  if (fiscalKeywords.some(k => text.includes(k) || summary.includes(k))) return "fiscal";

  return null;
}