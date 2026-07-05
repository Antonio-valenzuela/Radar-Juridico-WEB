export interface Classification {
  impacto: "alto" | "medio" | "bajo";
  tipo: string;
  tema: string | null;
  keywordsHit: string[];
}

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function classifyItem(title: string, summary?: string | null): Classification {
  const raw = `${title} ${summary || ""}`;
  const text = removeDiacritics(raw).toUpperCase();

  const { impacto, hitHigh, hitMedium } = detectImpact(text);
  const tipo = detectType(text);
  const { tema, hitTema } = detectTema(text);

  const keywordsHit = [...hitHigh, ...hitMedium, ...hitTema];

  return { impacto, tipo, tema, keywordsHit };
}

function detectImpact(text: string): {
  impacto: "alto" | "medio" | "bajo";
  hitHigh: string[];
  hitMedium: string[];
} {
  const highKeywords = [
    "REFORMA CONSTITUCIONAL",
    "NUEVA LEY",
    "NUEVO CODIGO",
    "EXPIDE",
    "SE EXPIDE",
    "DECRETO POR EL QUE SE EXPIDE",
    "ACCION DE INCONSTITUCIONALIDAD",
    "CONTROVERSIA CONSTITUCIONAL",
    "REFORMA INTEGRAL",
    "ABROGACION",
    "SE ABROGA",
    "ABROGA",
    "ENTRA EN VIGOR",
    "TRANSITORIOS",
  ];

  const hitHigh = highKeywords.filter((k) => text.includes(k));
  if (hitHigh.length > 0) return { impacto: "alto", hitHigh, hitMedium: [] };

  const mediumKeywords = [
    "REFORMA",
    "REFORMAN",
    "SE REFORMAN",
    "ADICIONA",
    "SE ADICIONAN",
    "ADICION",
    "DEROGA",
    "SE DEROGAN",
    "DEROGACION",
    "REGLAMENTO",
    "ACUERDO GENERAL",
    "LINEAMIENTOS",
  ];

  const hitMedium = mediumKeywords.filter((k) => text.includes(k));
  if (hitMedium.length > 0) return { impacto: "medio", hitHigh: [], hitMedium };

  return { impacto: "bajo", hitHigh: [], hitMedium: [] };
}

function detectType(text: string): string {
  if (text.includes("DECRETO")) return "DECRETO";
  if (text.includes("CODIGO") || text.includes("LEY")) return "LEY";
  if (text.includes("REGLAMENTO")) return "REGLAMENTO";
  if (text.includes("LINEAMIENTOS")) return "LINEAMIENTOS";
  if (text.includes("ACUERDO")) return "ACUERDO";
  if (text.includes("AVISO")) return "AVISO";
  if (text.includes("CIRCULAR")) return "CIRCULAR";
  if (text.includes("NOM-") || text.includes("NORMA OFICIAL")) return "NOM";
  if (text.includes("JURISPRUDENCIA")) return "JURISPRUDENCIA";
  if (text.includes("TESIS")) return "TESIS";
  if (text.includes("SENTENCIA")) return "SENTENCIA";
  if (text.includes("COMUNICADO")) return "COMUNICADO";
  return "NOTA";
}

function detectTema(text: string): { tema: string | null; hitTema: string[] } {
  // Constitucional / Amparo (maxima prioridad)
  const constitucionalKw = [
    "REFORMA CONSTITUCIONAL",
    "ACCION DE INCONSTITUCIONALIDAD",
    "CONTROVERSIA CONSTITUCIONAL",
    "AMPARO",
    "CONSTITUCION POLITICA",
    "SUPREMA CORTE",
    "SCJN",
    "DERECHOS HUMANOS",
    "GARANTIAS INDIVIDUALES",
  ];
  const constitucionalHit = constitucionalKw.filter((k) => text.includes(k));
  if (constitucionalHit.length > 0) return { tema: "constitucional", hitTema: constitucionalHit };

  // Penal
  const penalKw = [
    "PENAL",
    "CODIGO PENAL",
    "PROCEDIMIENTO PENAL",
    "ACCION PENAL",
    "PRISION PREVENTIVA",
    "MINISTERIO PUBLICO",
    "FISCALIA",
    "DELITO",
    "HOMICIDIO",
    "ROBO",
    "FRAUDE",
    "SECUESTRO",
    "VICTIMA",
    "IMPUTADO",
    "EXTINCION DE DOMINIO",
    "DELINCUENCIA ORGANIZADA",
    "NARCOTRAFICO",
    "PROCESO PENAL",
    "JUEZ DE CONTROL",
    "VINCULACION A PROCESO",
  ];
  const penalHit = penalKw.filter((k) => text.includes(k));
  if (penalHit.length > 0) return { tema: "penal", hitTema: penalHit };

  // Civil / Familiar
  const civilKw = [
    "CIVIL",
    "CODIGO CIVIL",
    "FAMILIAR",
    "MATRIMONIO",
    "DIVORCIO",
    "CONCUBINATO",
    "ALIMENTOS",
    "PENSION ALIMENTICIA",
    "GUARDA Y CUSTODIA",
    "PATRIA POTESTAD",
    "ADOPCION",
    "SUCESION",
    "TESTAMENTO",
    "HERENCIA",
    "ARRENDAMIENTO",
    "HIPOTECA",
    "COMPRAVENTA",
    "RESPONSABILIDAD CIVIL",
    "REGISTRO CIVIL",
  ];
  const civilHit = civilKw.filter((k) => text.includes(k));
  if (civilHit.length > 0) return { tema: "civil", hitTema: civilHit };

  // Laboral
  const laboralKw = [
    "LABORAL",
    "TRABAJO",
    "DESPIDO",
    "HUELGA",
    "SINDICATO",
    "JUNTA DE CONCILIACION",
    "CONTRATO COLECTIVO",
    "SALARIOS CAIDOS",
    "SEGURIDAD SOCIAL",
    "IMSS",
    "INFONAVIT",
    "STPS",
  ];
  const laboralHit = laboralKw.filter((k) => text.includes(k));
  if (laboralHit.length > 0) return { tema: "laboral", hitTema: laboralHit };

  // Fiscal
  const fiscalKw = [
    "FISCAL",
    "IMPUESTO",
    "SAT",
    "HACIENDA",
    "TRIBUTARIO",
    "ADUANERO",
    "CFF",
    "ISR",
    "IVA",
    "IEPS",
    "CONTRIBUCION",
    "CREDITO FISCAL",
    "PRESUPUESTO DE EGRESOS",
    "LEY DE INGRESOS",
    "AUDITORIA FISCAL",
  ];
  const fiscalHit = fiscalKw.filter((k) => text.includes(k));
  if (fiscalHit.length > 0) return { tema: "fiscal", hitTema: fiscalHit };

  // Administrativo
  const adminKw = [
    "ADMINISTRATIVO",
    "LICITACION",
    "CONTRATACION PUBLICA",
    "CONCESION",
    "PERMISO",
    "AUTORIZACION ADMINISTRATIVA",
    "SERVICIO PUBLICO",
    "ORGANISMO DESCENTRALIZADO",
    "DEPENDENCIA FEDERAL",
    "FUNCION PUBLICA",
  ];
  const adminHit = adminKw.filter((k) => text.includes(k));
  if (adminHit.length > 0) return { tema: "administrativo", hitTema: adminHit };

  return { tema: null, hitTema: [] };
}
