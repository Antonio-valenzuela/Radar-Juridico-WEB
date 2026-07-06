export type LegalLaw = {
  id: string;
  title: string;
  officialName: string;
  matter: string;
  jurisdiction: string;
  sourceName: string;
  officialUrl: string;
  searchHref: string;
  lastKnownReform: string;
  updateStatus: string;
  practicalUse: string;
  updateNote: string;
  articleSearchHints: string[];
};

export type JurisprudenceSearchField = {
  id:
    | "keyword"
    | "materia"
    | "registroDigital"
    | "organoEmisor"
    | "epoca"
    | "tipoCriterio"
    | "fechaPublicacion"
    | "temaJuridico";
  label: string;
  placeholder: string;
};

export type CaseTrackingField = {
  id: "jurisdiction" | "court" | "caseNumber" | "matter" | "actor" | "defendant" | "source";
  label: string;
  placeholder: string;
};

export type CaseSourceOption = {
  id: string;
  label: string;
  jurisdiction: string;
  officialUrl: string;
  requiresSession: boolean;
  note: string;
};

export type CaseAlertRule = {
  id: "new-actuation" | "review-window" | "source-session-required";
  label: string;
  description: string;
};

export type CaseSearchParams = Partial<Record<CaseTrackingField["id"], string>>;

export type CaseAlertState = {
  level: "ok" | "attention" | "review";
  label: string;
  description: string;
};

export type GuidedTemplateField = {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
};

export type GuidedLegalTemplate = {
  id: string;
  category: "Amparo" | "Civil" | "Familiar" | "Mercantil" | "Administrativo/Fiscal" | "General";
  title: string;
  description: string;
  fields: GuidedTemplateField[];
  body: string;
  exportFormats: Array<"word" | "pdf" | "text">;
  disclaimer: string;
};

export const CURRENT_LEGAL_LAWS: LegalLaw[] = [
  {
    id: "codigo-civil-federal",
    title: "Código Civil Federal",
    officialName: "Código Civil Federal",
    matter: "Civil",
    jurisdiction: "Federal",
    sourceName: "Cámara de Diputados",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf",
    searchHref: "/search?matter=civil&query=Codigo%20Civil%20Federal&auto=1",
    lastKnownReform: "Verificar texto vigente en Cámara de Diputados antes de presentar escrito.",
    updateStatus: "Texto vigente sujeto a verificación directa en fuente oficial.",
    practicalUse: "Contratos, obligaciones, propiedad, responsabilidad civil, sucesiones y capacidad.",
    updateNote: "Usar como texto federal base y contrastar con código estatal aplicable.",
    articleSearchHints: ["artículo", "contratos", "obligaciones", "responsabilidad civil", "sucesiones"],
  },
  {
    id: "codigo-civil-jalisco",
    title: "Código Civil del Estado de Jalisco",
    officialName: "Código Civil del Estado de Jalisco",
    matter: "Civil / Familiar",
    jurisdiction: "Jalisco",
    sourceName: "Congreso del Estado de Jalisco",
    officialUrl: "https://congresoweb.congresojal.gob.mx/BibliotecaVirtual/busquedasleyes/Listado.cfm",
    searchHref: "/search?query=Codigo%20Civil%20del%20Estado%20de%20Jalisco&auto=1",
    lastKnownReform: "Verificar versión vigente en Biblioteca Virtual del Congreso de Jalisco.",
    updateStatus: "Revisión estatal requerida por versión publicada en Congreso de Jalisco.",
    practicalUse: "Civil local, familia, sucesiones, propiedad y obligaciones en Jalisco.",
    updateNote: "La app conserva liga oficial y facilita búsqueda; la fecha vigente debe revisarse en el portal estatal.",
    articleSearchHints: ["artículo", "familia", "alimentos", "sucesiones", "propiedad"],
  },
  {
    id: "codigo-comercio",
    title: "Código de Comercio",
    officialName: "Código de Comercio",
    matter: "Mercantil",
    jurisdiction: "Federal",
    sourceName: "Cámara de Diputados",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf",
    searchHref: "/search?matter=mercantil&query=Codigo%20de%20Comercio&auto=1",
    lastKnownReform: "Última reforma indicada por el abogado: DOF 14/11/2025; cantidades por acuerdo DOF 18/02/2026.",
    updateStatus: "Reforma reciente identificada; revisar cuantías y acuerdos publicados.",
    practicalUse: "Juicios mercantiles, actos de comercio, contabilidad mercantil y oralidad mercantil.",
    updateNote: "Revisar cuantías y acuerdos de actualización antes de promover.",
    articleSearchHints: ["artículo", "juicio ejecutivo mercantil", "pagaré", "oralidad mercantil", "cuantía"],
  },
  {
    id: "cnpcf",
    title: "Código Nacional de Procedimientos Civiles y Familiares",
    officialName: "Código Nacional de Procedimientos Civiles y Familiares",
    matter: "Civil / Familiar / Procesal",
    jurisdiction: "Nacional",
    sourceName: "Cámara de Diputados",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPCF.pdf",
    searchHref: "/search?matter=cnpcf&query=Codigo%20Nacional%20de%20Procedimientos%20Civiles%20y%20Familiares&auto=1",
    lastKnownReform: "Última reforma indicada por el abogado: DOF 15/01/2026; implementación gradual sin exceder 01/04/2027.",
    updateStatus: "Implementación gradual nacional; validar calendario local antes de litigar.",
    practicalUse: "Procedimientos civiles y familiares, audiencias, notificaciones, expediente electrónico y justicia digital.",
    updateNote: "Prioridad alta por entrada en vigor gradual nacional.",
    articleSearchHints: ["artículo", "audiencia", "notificación", "justicia digital", "expediente electrónico"],
  },
  {
    id: "ley-amparo",
    title: "Ley de Amparo",
    officialName: "Ley de Amparo, Reglamentaria de los artículos 103 y 107 de la Constitución Política de los Estados Unidos Mexicanos",
    matter: "Amparo",
    jurisdiction: "Federal",
    sourceName: "Cámara de Diputados",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LAmp.pdf",
    searchHref: "/search?matter=amparo&query=Ley%20de%20Amparo%20suspension%20acto%20reclamado&auto=1",
    lastKnownReform: "Verificar texto vigente en Cámara de Diputados antes de presentar demanda.",
    updateStatus: "Texto vigente sujeto a verificación directa antes de promover.",
    practicalUse: "Amparo directo, indirecto, suspensión, revisión, queja y reclamación.",
    updateNote: "Cruzar con jurisprudencia SCJN/SJF aplicable al acto reclamado.",
    articleSearchHints: ["artículo", "suspensión", "acto reclamado", "amparo indirecto", "revisión"],
  },
  {
    id: "cnpp",
    title: "Código Nacional de Procedimientos Penales",
    officialName: "Código Nacional de Procedimientos Penales",
    matter: "Penal",
    jurisdiction: "Nacional",
    sourceName: "Cámara de Diputados",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPP.pdf",
    searchHref: "/search?matter=penal&query=Codigo%20Nacional%20de%20Procedimientos%20Penales&auto=1",
    lastKnownReform: "Verificar texto vigente en Cámara de Diputados.",
    updateStatus: "Texto vigente sujeto a verificación directa en fuente oficial.",
    practicalUse: "Proceso penal, medidas cautelares, investigación, audiencia inicial y juicio oral.",
    updateNote: "Consultar también criterios recientes de SCJN/SJF.",
    articleSearchHints: ["artículo", "audiencia inicial", "medidas cautelares", "investigación", "juicio oral"],
  },
  {
    id: "lgtoc",
    title: "Ley General de Títulos y Operaciones de Crédito",
    officialName: "Ley General de Títulos y Operaciones de Crédito",
    matter: "Mercantil",
    jurisdiction: "Federal",
    sourceName: "Cámara de Diputados",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGTOC.pdf",
    searchHref: "/search?matter=mercantil&query=Ley%20General%20de%20Titulos%20y%20Operaciones%20de%20Credito&auto=1",
    lastKnownReform: "Verificar texto vigente en Cámara de Diputados.",
    updateStatus: "Texto vigente sujeto a verificación directa en fuente oficial.",
    practicalUse: "Pagarés, cheques, letras de cambio, fideicomiso y operaciones de crédito.",
    updateNote: "Útil para ejecutivos mercantiles y excepciones sobre títulos de crédito.",
    articleSearchHints: ["artículo", "pagaré", "cheque", "letra de cambio", "fideicomiso"],
  },
  {
    id: "lgsm",
    title: "Ley General de Sociedades Mercantiles",
    officialName: "Ley General de Sociedades Mercantiles",
    matter: "Mercantil / Corporativo",
    jurisdiction: "Federal",
    sourceName: "Cámara de Diputados",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGSM.pdf",
    searchHref: "/search?matter=mercantil&query=Ley%20General%20de%20Sociedades%20Mercantiles&auto=1",
    lastKnownReform: "Verificar texto vigente en Cámara de Diputados.",
    updateStatus: "Texto vigente sujeto a verificación directa en fuente oficial.",
    practicalUse: "Sociedades, asambleas, administración, responsabilidad, fusión, escisión y disolución.",
    updateNote: "Cruzar con estatutos y documentos corporativos del caso.",
    articleSearchHints: ["artículo", "asamblea", "administrador", "sociedad anónima", "disolución"],
  },
  {
    id: "leyes-jalisco",
    title: "Leyes estatales de Jalisco",
    officialName: "Biblioteca Virtual de Leyes del Estado de Jalisco",
    matter: "Estatal / Jalisco",
    jurisdiction: "Jalisco",
    sourceName: "Congreso del Estado de Jalisco",
    officialUrl: "https://congresoweb.congresojal.gob.mx/BibliotecaVirtual/busquedasleyes/Listado.cfm",
    searchHref: "/search?query=leyes%20estatales%20Jalisco%20civil%20mercantil%20familiar&auto=1",
    lastKnownReform: "Verificar cada ordenamiento en Biblioteca Virtual del Congreso de Jalisco.",
    updateStatus: "Cada ley estatal requiere verificación individual en el portal del Congreso.",
    practicalUse: "Normativa local aplicable a litigio civil, familiar, administrativo y estatal.",
    updateNote: "La app facilita acceso y registro; la fuente estatal conserva la versión oficial.",
    articleSearchHints: ["artículo", "Jalisco", "civil", "familiar", "administrativo"],
  },
];

export const JURISPRUDENCE_SEARCH_FIELDS: JurisprudenceSearchField[] = [
  { id: "keyword", label: "Palabra clave", placeholder: "pensión alimenticia retroactiva" },
  { id: "materia", label: "Materia", placeholder: "Civil, Familiar, Mercantil, Amparo" },
  { id: "registroDigital", label: "Registro digital", placeholder: "Ej. 202..." },
  { id: "organoEmisor", label: "Órgano emisor", placeholder: "SCJN, Pleno, Sala, Tribunal Colegiado" },
  { id: "epoca", label: "Época", placeholder: "Undécima Época" },
  { id: "tipoCriterio", label: "Tipo", placeholder: "Jurisprudencia, tesis aislada, precedente" },
  { id: "fechaPublicacion", label: "Fecha de publicación", placeholder: "2026-01-15" },
  { id: "temaJuridico", label: "Tema jurídico", placeholder: "alimentos, suspensión, pagaré" },
];

export const CASE_TRACKING_FIELDS: CaseTrackingField[] = [
  { id: "jurisdiction", label: "Jurisdicción", placeholder: "Federal, Jalisco u otro estado" },
  { id: "court", label: "Órgano / juzgado", placeholder: "Segundo Civil de Guadalajara" },
  { id: "caseNumber", label: "Expediente", placeholder: "1234/2025" },
  { id: "matter", label: "Materia", placeholder: "Civil, familiar, mercantil, amparo" },
  { id: "actor", label: "Actor / promovente", placeholder: "Nombre de la parte actora" },
  { id: "defendant", label: "Demandado / contraparte", placeholder: "Nombre de la contraparte" },
  { id: "source", label: "Fuente oficial", placeholder: "SISE, CJF, Boletín Jalisco" },
];

export const CASE_SOURCE_OPTIONS: CaseSourceOption[] = [
  {
    id: "cjf-sise",
    label: "SISE / CJF",
    jurisdiction: "Federal",
    officialUrl: "https://sise.cjf.gob.mx/SiseInternet/default.aspx",
    requiresSession: true,
    note: "Puede requerir navegador, sesión o captura manual. La app no intenta brincar login ni captcha.",
  },
  {
    id: "cjf-listas",
    label: "Listas de acuerdos CJF",
    jurisdiction: "Federal",
    officialUrl: "https://www.dgej.cjf.gob.mx/SiseInternet/consulta/busquedaacuerdos.aspx",
    requiresSession: true,
    note: "Usar para abrir la consulta oficial y registrar la actuación detectada.",
  },
  {
    id: "jalisco-boletin",
    label: "Boletín Judicial de Jalisco",
    jurisdiction: "Jalisco",
    officialUrl: "https://ciudadano.cjj.gob.mx/boletin_judicial/consultar",
    requiresSession: true,
    note: "Permite buscar por partido judicial, juzgado y materia cuando la fuente lo permita.",
  },
];

export const CASE_ALERT_RULES: CaseAlertRule[] = [
  {
    id: "new-actuation",
    label: "Nueva actuación registrada",
    description: "Se marca alerta cuando el abogado registra una actuación nueva contra un expediente guardado.",
  },
  {
    id: "review-window",
    label: "Revisión pendiente",
    description: "Se sugiere revisar la fuente oficial si el expediente no se ha revisado en varios días.",
  },
  {
    id: "source-session-required",
    label: "Fuente con sesión",
    description: "La app abre la fuente oficial y guarda parámetros, pero no intenta eludir login, captcha o restricciones.",
  },
];

function normalizeMatterForSearch(matter: string) {
  const value = matter.toLowerCase();
  if (value.includes("cnpcf") || value.includes("procesal")) return "cnpcf";
  if (value.includes("mercantil")) return "mercantil";
  if (value.includes("amparo")) return "amparo";
  if (value.includes("penal")) return "penal";
  if (value.includes("familiar")) return "familiar";
  if (value.includes("civil")) return "civil";
  return "";
}

export function buildLawSearchHref(law: LegalLaw, keywordOrArticle = "") {
  const params = new URLSearchParams();
  const matter = normalizeMatterForSearch(law.matter);
  const query = [law.officialName || law.title, keywordOrArticle.trim()].filter(Boolean).join(" ");

  if (matter) params.set("matter", matter);
  params.set("query", query);
  params.set("auto", "1");

  return `/search?${params.toString()}`;
}

const JURISPRUDENCE_FIELD_LABELS: Record<JurisprudenceSearchField["id"], string> = {
  keyword: "palabra clave",
  materia: "materia",
  registroDigital: "registro digital",
  organoEmisor: "órgano emisor",
  epoca: "época",
  tipoCriterio: "tipo de criterio",
  fechaPublicacion: "fecha de publicación",
  temaJuridico: "tema jurídico",
};

export function buildJurisprudenceSearchHref(values: Record<string, string>) {
  const query = buildJurisprudenceQuery(values) || "jurisprudencia SCJN Semanario Judicial de la Federación";
  const params = new URLSearchParams({
    source: "SJF",
    query,
    auto: "1",
  });

  return `/search?${params.toString()}`;
}

export function buildCaseSourceUrl(source: CaseSourceOption, params: CaseSearchParams) {
  const url = new URL(source.officialUrl);
  const mappedParams: Array<[string, string | undefined]> = [
    ["expediente", params.caseNumber],
    ["juzgado", params.court],
    ["jurisdiccion", params.jurisdiction],
    ["materia", params.matter],
    ["actor", params.actor],
    ["demandado", params.defendant],
  ];

  for (const [key, value] of mappedParams) {
    const cleanValue = value?.trim();
    if (cleanValue) url.searchParams.set(key, cleanValue);
  }

  return url.toString();
}

export function formatCaseSearchParameters(params: CaseSearchParams) {
  return [
    ["Expediente", params.caseNumber],
    ["Juzgado", params.court],
    ["Jurisdicción", params.jurisdiction],
    ["Materia", params.matter],
    ["Actor", params.actor],
    ["Demandado", params.defendant],
  ]
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join(" · ");
}

export function getCaseAlertState(params: { actuationCount: number; lastReviewAt?: string | null }): CaseAlertState {
  if (params.actuationCount > 0) {
    return {
      level: "attention",
      label: "Alerta: actuación nueva",
      description: "El expediente tiene actuaciones registradas que deben revisarse para plazos y siguiente promoción.",
    };
  }

  if (params.lastReviewAt) {
    const reviewedAt = new Date(params.lastReviewAt).getTime();
    const daysSinceReview = Number.isFinite(reviewedAt)
      ? (Date.now() - reviewedAt) / (1000 * 60 * 60 * 24)
      : 0;

    if (daysSinceReview >= 3) {
      return {
        level: "review",
        label: "Revisión pendiente",
        description: "Conviene abrir la fuente oficial para confirmar si hay acuerdo o publicación nueva.",
      };
    }
  }

  return {
    level: "ok",
    label: "Sin actuación nueva registrada",
    description: "No hay actuaciones guardadas en el historial local de este expediente.",
  };
}

const PROFESSIONAL_REVIEW =
  "Este machote es una base de trabajo generada para captura y organización. Requiere revisión profesional antes de presentarse.";

export const GUIDED_LEGAL_TEMPLATES: GuidedLegalTemplate[] = [
  {
    id: "amparo-indirecto-guiado",
    category: "Amparo",
    title: "Demanda de amparo indirecto",
    description: "Genera una base con quejoso, autoridad, acto reclamado, conceptos y suspensión.",
    fields: [
      { id: "quejoso", label: "Quejoso", placeholder: "Nombre completo", required: true },
      { id: "autoridad", label: "Autoridad responsable", placeholder: "Autoridad responsable", required: true },
      { id: "acto", label: "Acto reclamado", placeholder: "Describe el acto", required: true },
      { id: "fecha", label: "Fecha de conocimiento", placeholder: "DD/MM/AAAA", required: true },
      { id: "suspension", label: "Suspensión", placeholder: "Sí / No y por qué", required: false },
    ],
    body:
      "C. JUEZ DE DISTRITO EN TURNO\n\n{{quejoso}}, por mi propio derecho, solicito el amparo y protección de la Justicia Federal en contra de {{autoridad}} por el acto consistente en {{acto}}. Bajo protesta de decir verdad manifiesto que tuve conocimiento del acto el {{fecha}}.\n\nCONCEPTOS DE VIOLACIÓN\n[Desarrollar conceptos de violación asistidos por IA y revisados por abogado.]\n\nSUSPENSIÓN\n{{suspension}}\n\nPROTESTO LO NECESARIO.",
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "demanda-ordinaria-civil",
    category: "Civil",
    title: "Demanda ordinaria civil",
    description: "Estructura hechos, prestaciones, pruebas y puntos petitorios.",
    fields: [
      { id: "actor", label: "Actor", placeholder: "Nombre del actor", required: true },
      { id: "demandado", label: "Demandado", placeholder: "Nombre del demandado", required: true },
      { id: "prestaciones", label: "Prestaciones", placeholder: "Qué se reclama", required: true },
      { id: "hechos", label: "Hechos", placeholder: "Relato breve", required: true },
    ],
    body:
      "C. JUEZ CIVIL COMPETENTE\n\n{{actor}}, promoviendo en contra de {{demandado}}, vengo a demandar las siguientes prestaciones: {{prestaciones}}.\n\nHECHOS\n{{hechos}}\n\nPRUEBAS\n[Relacionar documentos, testigos, confesional, pericial u otras.]\n\nPUNTOS PETITORIOS\nSe admita la demanda y se emplace a la parte demandada.",
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "demanda-alimentos",
    category: "Familiar",
    title: "Demanda de alimentos",
    description: "Base para alimentos, guarda, custodia o convivencia.",
    fields: [
      { id: "promovente", label: "Promovente", placeholder: "Nombre", required: true },
      { id: "menores", label: "Menores o acreedores", placeholder: "Nombres", required: true },
      { id: "deudor", label: "Deudor alimentario", placeholder: "Nombre", required: true },
      { id: "necesidades", label: "Necesidades", placeholder: "Gastos y circunstancias", required: true },
    ],
    body:
      "C. JUEZ FAMILIAR COMPETENTE\n\n{{promovente}}, en representación de {{menores}}, demando de {{deudor}} el pago de alimentos.\n\nHECHOS Y NECESIDADES\n{{necesidades}}\n\nMEDIDAS PROVISIONALES\nSolicito se fije pensión alimenticia provisional y se dicten medidas de protección si proceden.",
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "demanda-ejecutiva-mercantil",
    category: "Mercantil",
    title: "Demanda ejecutiva mercantil",
    description: "Base para pagaré, título de crédito y prestaciones accesorias.",
    fields: [
      { id: "actor", label: "Actor", placeholder: "Acreedor", required: true },
      { id: "demandado", label: "Demandado", placeholder: "Deudor", required: true },
      { id: "titulo", label: "Título de crédito", placeholder: "Pagaré, cheque, letra", required: true },
      { id: "monto", label: "Monto", placeholder: "Cantidad reclamada", required: true },
    ],
    body:
      "C. JUEZ MERCANTIL COMPETENTE\n\n{{actor}} demanda en la vía ejecutiva mercantil a {{demandado}} con base en {{titulo}}, por la cantidad de {{monto}}, más intereses, gastos y costas.\n\nDOCUMENTO BASE DE LA ACCIÓN\n[Describir y anexar título de crédito.]\n\nPUNTOS PETITORIOS\nSe dicte auto de exequendo y se requiera de pago, embargo y emplazamiento.",
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "recurso-revocacion-guiado",
    category: "Administrativo/Fiscal",
    title: "Recurso de revocación",
    description: "Ordena resolución impugnada, agravios, pruebas y peticiones.",
    fields: [
      { id: "recurrente", label: "Recurrente", placeholder: "Nombre/RFC", required: true },
      { id: "autoridad", label: "Autoridad emisora", placeholder: "SAT u otra autoridad", required: true },
      { id: "resolucion", label: "Resolución impugnada", placeholder: "Número y fecha", required: true },
      { id: "agravios", label: "Agravios", placeholder: "Agravios principales", required: true },
    ],
    body:
      "C. AUTORIDAD COMPETENTE\n\n{{recurrente}} interpone recurso de revocación en contra de la resolución {{resolucion}} emitida por {{autoridad}}.\n\nAGRAVIOS\n{{agravios}}\n\nPRUEBAS\n[Ofrecer pruebas documentales y demás aplicables.]\n\nPUNTOS PETITORIOS\nSe admita el recurso y se revoque la resolución impugnada.",
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "promocion-general",
    category: "General",
    title: "Promoción simple / solicitud de copias",
    description: "Formato breve para pedir copias, autorizar abogados o señalar domicilio.",
    fields: [
      { id: "promovente", label: "Promovente", placeholder: "Nombre", required: true },
      { id: "expediente", label: "Expediente", placeholder: "Número", required: true },
      { id: "autoridad", label: "Autoridad o juzgado", placeholder: "Juzgado", required: true },
      { id: "peticion", label: "Petición", placeholder: "Qué solicita", required: true },
    ],
    body:
      "C. {{autoridad}}\n\n{{promovente}}, dentro del expediente {{expediente}}, comparezco para solicitar {{peticion}}.\n\nPor lo expuesto, pido se acuerde de conformidad.\n\nPROTESTO LO NECESARIO.",
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
];

export function buildJurisprudenceQuery(values: Record<string, string>) {
  return JURISPRUDENCE_SEARCH_FIELDS.map((field) => {
    const value = values[field.id]?.trim();
    return value ? `${JURISPRUDENCE_FIELD_LABELS[field.id]}: ${value}` : "";
  })
    .filter(Boolean)
    .join(" ");
}

export function fillGuidedTemplate(template: GuidedLegalTemplate, values: Record<string, string>) {
  return template.body.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const value = values[key]?.trim();
    return value || `[PENDIENTE: ${key}]`;
  });
}
