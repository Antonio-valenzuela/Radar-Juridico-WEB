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
    description: "Demanda de amparo indirecto ante Juzgado de Distrito con estructura procesal completa conforme a la Ley de Amparo.",
    fields: [
      { id: "quejoso", label: "Quejoso", placeholder: "Nombre completo del quejoso", required: true },
      { id: "domicilio_notificaciones", label: "Domicilio para notificaciones", placeholder: "Calle, número, colonia, ciudad, estado, C.P.", required: true },
      { id: "autoridad", label: "Autoridad responsable", placeholder: "Nombre y cargo de la autoridad responsable", required: true },
      { id: "acto", label: "Acto reclamado", placeholder: "Descripción completa del acto que se reclama", required: true },
      { id: "fecha", label: "Fecha de conocimiento del acto", placeholder: "DD/MM/AAAA", required: true },
      { id: "antecedentes", label: "Antecedentes / hechos", placeholder: "Narración cronológica de los hechos previos al acto reclamado", required: true },
      { id: "derechos_violados", label: "Derechos fundamentales violados", placeholder: "Artículos constitucionales que se estiman violados", required: true },
      { id: "conceptos_violacion", label: "Conceptos de violación", placeholder: "Argumentos jurídicos que demuestren la inconstitucionalidad del acto", required: true },
      { id: "tercero_interesado", label: "Tercero interesado", placeholder: "Nombre del tercero interesado, si aplica", required: false },
      { id: "suspension", label: "Fundamento para suspensión", placeholder: "Razones por las que debe otorgarse la suspensión del acto reclamado", required: false },
      { id: "personas_autorizadas", label: "Personas autorizadas", placeholder: "Nombres de abogados autorizados en términos del artículo 12 de la Ley de Amparo", required: false },
    ],
    body:
`C. JUEZ DE DISTRITO EN MATERIA {{materia_competencia}} EN TURNO EN {{ciudad_competencia}}
P R E S E N T E

{{quejoso}}, mexicano(a), mayor de edad, por mi propio derecho, señalando como domicilio para oír y recibir todo tipo de notificaciones, aun las de carácter personal, el ubicado en {{domicilio_notificaciones}}, autorizando en términos amplios del artículo 12 de la Ley de Amparo a {{personas_autorizadas}}, ante usted con el debido respeto comparezco y expongo:

Que por medio del presente escrito, y con fundamento en lo dispuesto por los artículos 1°, 103, fracción I, y 107 de la Constitución Política de los Estados Unidos Mexicanos; 1°, 2°, 5°, fracción I, 6°, 17, 107, 108, 109, 110, 112 y demás aplicables de la Ley de Amparo, Reglamentaria de los artículos 103 y 107 de la Constitución Política de los Estados Unidos Mexicanos, vengo a solicitar el AMPARO Y PROTECCIÓN DE LA JUSTICIA FEDERAL en contra del acto y de la autoridad que a continuación se precisan.

I. NOMBRE Y DOMICILIO DEL QUEJOSO:
Ya quedaron precisados en el proemio del presente escrito.

II. NOMBRE Y DOMICILIO DEL TERCERO INTERESADO:
{{tercero_interesado}}

III. AUTORIDAD RESPONSABLE:
Señalo como autoridad responsable a: {{autoridad}}.

IV. ACTO RECLAMADO:
Reclamo de la autoridad responsable señalada: {{acto}}.

V. BAJO PROTESTA DE DECIR VERDAD, los hechos y abstenciones que constituyen los antecedentes del acto reclamado y que sirven de fundamento a los conceptos de violación, son los siguientes:

PRIMERO.- {{antecedentes}}

SEGUNDO.- Que el acto reclamado fue conocido por el quejoso el día {{fecha}}, por lo que la presente demanda se interpone dentro del plazo de quince días que establece el artículo 17 de la Ley de Amparo.

VI. PRECEPTOS CONSTITUCIONALES CUYA VIOLACIÓN SE RECLAMA:
Se estiman violados los artículos {{derechos_violados}} de la Constitución Política de los Estados Unidos Mexicanos, así como los artículos 1, 2, 8, 14 y 25 de la Convención Americana sobre Derechos Humanos.

VII. CONCEPTOS DE VIOLACIÓN:

PRIMERO.- {{conceptos_violacion}}

VIII. SUSPENSIÓN DEL ACTO RECLAMADO:
Con fundamento en los artículos 125, 126, 128, 129, 130, 131, 132, 133, 134, 135, 136, 138, 139, 147 y 148 de la Ley de Amparo, solicito a este H. Juzgado la suspensión provisional y en su oportunidad la definitiva del acto reclamado, en virtud de que: {{suspension}}

IX. PRUEBAS:
Ofrezco las siguientes pruebas:

A) DOCUMENTALES PÚBLICAS:
1. Copia certificada del acto reclamado.
2. Constancia de notificación del acto reclamado.

B) DOCUMENTALES PRIVADAS:
Las que se acompañan al presente escrito y las que se ofrezcan en la audiencia constitucional.

C) PRESUNCIONAL LEGAL Y HUMANA:
En su doble aspecto, legal y humana, en todo lo que favorezca al quejoso.

D) INSTRUMENTAL DE ACTUACIONES:
Todo lo que de autos se desprenda y beneficie al quejoso.

X. PUNTOS PETITORIOS:
A usted, C. Juez de Distrito, atentamente pido se sirva:

PRIMERO.- Tenerme por presentado con este escrito demandando el amparo y protección de la Justicia Federal.
SEGUNDO.- Admitir la presente demanda de amparo con sus anexos.
TERCERO.- Conceder la suspensión provisional y en su oportunidad la definitiva del acto reclamado.
CUARTO.- Previo los trámites de ley, en la audiencia constitucional dictar sentencia que ampare y proteja al quejoso.

PROTESTO LO NECESARIO EN DERECHO.

{{ciudad_competencia}}, a {{fecha_escrito}}.

_______________________________
{{quejoso}}`,
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "demanda-ordinaria-civil",
    category: "Civil",
    title: "Demanda ordinaria civil",
    description: "Demanda en la vía ordinaria civil con estructura procesal completa conforme al Código de Procedimientos Civiles aplicable.",
    fields: [
      { id: "actor", label: "Actor", placeholder: "Nombre completo del actor", required: true },
      { id: "domicilio_actor", label: "Domicilio para notificaciones", placeholder: "Calle, número, colonia, ciudad, estado, C.P.", required: true },
      { id: "demandado", label: "Demandado", placeholder: "Nombre completo del demandado", required: true },
      { id: "domicilio_demandado", label: "Domicilio del demandado", placeholder: "Domicilio conocido del demandado", required: true },
      { id: "prestaciones", label: "Prestaciones reclamadas", placeholder: "Lista detallada de cada prestación que se reclama", required: true },
      { id: "hechos", label: "Hechos (narración cronológica)", placeholder: "Relato cronológico y numerado de los hechos", required: true },
      { id: "fundamento_derecho", label: "Fundamento de derecho", placeholder: "Artículos del Código Civil y de Procedimientos Civiles aplicables", required: true },
      { id: "valor_asunto", label: "Valor del asunto o cuantía", placeholder: "Monto o descripción del interés jurídico", required: false },
      { id: "personas_autorizadas", label: "Personas autorizadas", placeholder: "Nombre de abogados autorizados", required: false },
      { id: "medidas_cautelares", label: "Medidas cautelares", placeholder: "Medidas precautorias solicitadas, si aplican", required: false },
    ],
    body:
`C. JUEZ DE LO CIVIL EN TURNO EN {{ciudad_competencia}}
P R E S E N T E

{{actor}}, mexicano(a), mayor de edad, señalando como domicilio para oír y recibir todo tipo de notificaciones el ubicado en {{domicilio_actor}}, autorizando para oírlas y recibirlas en mi nombre y representación, así como para imponerse de autos, a {{personas_autorizadas}}, ante usted con el debido respeto comparezco y expongo:

Que por medio del presente escrito vengo a demandar en la VÍA ORDINARIA CIVIL a {{demandado}}, con domicilio en {{domicilio_demandado}}, a quien reclamo las siguientes:

I. PRESTACIONES:

{{prestaciones}}

II. HECHOS:
Los hechos que motivan la presente demanda son los siguientes:

{{hechos}}

III. FUNDAMENTO DE DERECHO:
Son aplicables al presente asunto los artículos {{fundamento_derecho}}, así como las tesis de jurisprudencia y criterios aislados aplicables al caso concreto.

IV. PRUEBAS:
Desde este momento ofrezco las siguientes pruebas, relacionándolas con cada uno de los hechos de la demanda:

A) CONFESIONAL: A cargo del demandado {{demandado}}, quien deberá ser citado a absolver posiciones bajo apercibimiento legal, en términos de ley.

B) DOCUMENTALES PÚBLICAS:
Las que se acompañan al presente escrito, mismas que se describen en el capítulo de anexos.

C) DOCUMENTALES PRIVADAS:
Las que obran en poder de la parte actora y se exhiben con el presente, así como las que se ofrezcan durante el procedimiento.

D) TESTIMONIAL: A cargo de los testigos cuyos nombres y domicilios se señalarán oportunamente, quienes depondrán sobre los hechos materia de la litis.

E) PERICIAL: En la materia que resulte necesaria, designándose perito en el momento procesal oportuno.

F) PRESUNCIONAL LEGAL Y HUMANA: En todo lo que favorezca a los intereses de la parte actora.

G) INSTRUMENTAL DE ACTUACIONES: Todo lo que de autos se desprenda y beneficie a la parte actora.

V. PUNTOS PETITORIOS:
A usted, C. Juez, atentamente pido se sirva:

PRIMERO.- Tenerme por presentado con la personalidad que ostento demandando en la vía ordinaria civil a {{demandado}}.
SEGUNDO.- Admitir la demanda en la vía y forma propuesta.
TERCERO.- Ordenar el emplazamiento del demandado en el domicilio señalado.
CUARTO.- Tener por ofrecidas las pruebas enunciadas.
QUINTO.- En su oportunidad dictar sentencia favorable condenando al demandado al pago de las prestaciones reclamadas.

PROTESTO LO NECESARIO EN DERECHO.

{{ciudad_competencia}}, a {{fecha_escrito}}.

_______________________________
{{actor}}`,
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "demanda-alimentos",
    category: "Familiar",
    title: "Demanda de pensión alimenticia",
    description: "Demanda de pensión alimenticia (provisional y definitiva) en materia familiar, con estructura conforme al Código Civil y CNPCF.",
    fields: [
      { id: "promovente", label: "Promovente", placeholder: "Nombre completo del acreedor alimentario o su representante", required: true },
      { id: "domicilio_promovente", label: "Domicilio para notificaciones", placeholder: "Calle, número, colonia, ciudad, estado, C.P.", required: true },
      { id: "menores", label: "Acreedores alimentarios", placeholder: "Nombres completos y edades de los menores o acreedores", required: true },
      { id: "deudor", label: "Deudor alimentario", placeholder: "Nombre completo del obligado a proporcionar alimentos", required: true },
      { id: "domicilio_deudor", label: "Domicilio del deudor", placeholder: "Domicilio conocido del deudor alimentario", required: true },
      { id: "relacion_juridica", label: "Relación jurídica", placeholder: "Parentesco: cónyuge, concubino(a), padre/madre, ascendiente", required: true },
      { id: "necesidades", label: "Necesidades de los acreedores", placeholder: "Descripción de gastos: alimentación, habitación, vestido, educación, salud, esparcimiento", required: true },
      { id: "capacidad_deudor", label: "Capacidad económica del deudor", placeholder: "Ingresos conocidos, ocupación, patrimonio del deudor", required: true },
      { id: "monto_provisional", label: "Monto de pensión provisional solicitada", placeholder: "Porcentaje o cantidad mensual solicitada como provisional", required: false },
      { id: "personas_autorizadas", label: "Personas autorizadas", placeholder: "Nombre de abogados autorizados", required: false },
    ],
    body:
`C. JUEZ DE LO FAMILIAR EN TURNO EN {{ciudad_competencia}}
P R E S E N T E

{{promovente}}, mexicano(a), mayor de edad, en ejercicio de la patria potestad y en representación de {{menores}}, señalando como domicilio para oír y recibir todo tipo de notificaciones el ubicado en {{domicilio_promovente}}, autorizando en términos de ley a {{personas_autorizadas}}, ante usted con el debido respeto comparezco y expongo:

Que por medio del presente escrito, con fundamento en los artículos 4° de la Constitución Política de los Estados Unidos Mexicanos, 301, 302, 303, 304, 308, 309, 311, 314, 315, 316, 317 y demás aplicables del Código Civil Federal y/o del Código Civil de la entidad federativa correspondiente, vengo a demandar a {{deudor}}, con domicilio en {{domicilio_deudor}}, en CONTROVERSIA DEL ORDEN FAMILIAR, reclamando las siguientes:

I. PRESTACIONES:

PRIMERA.- El pago de una pensión alimenticia definitiva a favor de {{menores}}, que comprenda: alimentación, habitación, vestido, atención médica, hospitalaria y en su caso gastos de embarazo y parto, educación, esparcimiento y los demás que sean necesarios para su sano desarrollo.

SEGUNDA.- El pago de una pensión alimenticia provisional, misma que deberá fijarse desde la admisión de la demanda, en cantidad no menor a {{monto_provisional}}.

TERCERA.- La inscripción en el Registro de Deudores Alimentarios Morosos en caso de incumplimiento.

II. HECHOS:

PRIMERO.- Existe relación de {{relacion_juridica}} entre el promovente y el demandado, lo cual acredito con la documental que se acompaña.

SEGUNDO.- Los acreedores alimentarios son: {{menores}}, quienes dependen económicamente del suscrito(a) y del deudor alimentario.

TERCERO.- Las necesidades de los acreedores alimentarios consisten en: {{necesidades}}.

CUARTO.- El deudor alimentario {{deudor}} tiene capacidad económica para proporcionar alimentos, toda vez que: {{capacidad_deudor}}.

QUINTO.- A pesar de lo anterior, el deudor alimentario ha incumplido con su obligación de proporcionar alimentos, poniendo en riesgo la subsistencia de los acreedores alimentarios.

III. FUNDAMENTO DE DERECHO:
Artículos 4° constitucional; 301 a 323 del Código Civil Federal; 940 a 956 del Código de Procedimientos Civiles Federal; artículos relativos de la legislación estatal aplicable; Convención sobre los Derechos del Niño, artículos 3, 27 y 28; y criterios jurisprudenciales aplicables en materia de alimentos.

IV. PRUEBAS:

A) DOCUMENTALES PÚBLICAS:
1. Actas de nacimiento de los acreedores alimentarios.
2. Acta de matrimonio o constancia de concubinato, según proceda.
3. Constancias de inscripción escolar.

B) DOCUMENTALES PRIVADAS:
1. Comprobantes de gastos de alimentación, salud, educación y vestido.
2. Recibos de renta, servicios y demás necesidades del hogar.

C) CONFESIONAL: A cargo del demandado {{deudor}}.

D) TESTIMONIAL: A cargo de testigos cuyos datos se proporcionarán oportunamente.

E) PERICIAL: En materia contable y/o de trabajo social, en caso de ser necesaria.

F) PRESUNCIONAL LEGAL Y HUMANA: En todo lo que favorezca.

G) INSTRUMENTAL DE ACTUACIONES.

V. MEDIDAS PROVISIONALES:
Solicito a su Señoría que, de conformidad con los artículos 940, 941 y 943 del Código de Procedimientos Civiles (o artículos equivalentes del CNPCF), se decreten las siguientes medidas provisionales:
1. Se fije pensión alimenticia provisional.
2. Se gire oficio al empleador del demandado para que informe sobre sus percepciones.
3. Se dicten las medidas de protección necesarias.

VI. PUNTOS PETITORIOS:

PRIMERO.- Tenerme por presentada con la demanda en la vía de controversia del orden familiar.
SEGUNDO.- Fijar pensión alimenticia provisional desde la admisión de la demanda.
TERCERO.- Emplazar al demandado en el domicilio señalado.
CUARTO.- Tener por ofrecidas las pruebas.
QUINTO.- En su oportunidad dictar sentencia condenando al demandado al pago de pensión alimenticia definitiva.

PROTESTO LO NECESARIO EN DERECHO.

{{ciudad_competencia}}, a {{fecha_escrito}}.

_______________________________
{{promovente}}`,
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "demanda-ejecutiva-mercantil",
    category: "Mercantil",
    title: "Demanda ejecutiva mercantil",
    description: "Demanda en la vía ejecutiva mercantil fundada en título de crédito, conforme al Código de Comercio y LGTOC.",
    fields: [
      { id: "actor", label: "Actor (acreedor)", placeholder: "Nombre completo del acreedor", required: true },
      { id: "domicilio_actor", label: "Domicilio para notificaciones", placeholder: "Calle, número, colonia, ciudad, estado, C.P.", required: true },
      { id: "demandado", label: "Demandado (deudor)", placeholder: "Nombre completo del deudor", required: true },
      { id: "domicilio_demandado", label: "Domicilio del demandado", placeholder: "Domicilio conocido del deudor", required: true },
      { id: "titulo", label: "Tipo de título de crédito", placeholder: "Pagaré, cheque, letra de cambio", required: true },
      { id: "monto", label: "Monto del adeudo", placeholder: "Cantidad en pesos M.N.", required: true },
      { id: "fecha_suscripcion", label: "Fecha de suscripción del título", placeholder: "DD/MM/AAAA", required: true },
      { id: "fecha_vencimiento", label: "Fecha de vencimiento", placeholder: "DD/MM/AAAA", required: true },
      { id: "descripcion_titulo", label: "Descripción del título", placeholder: "Características del documento: lugar de suscripción, lugar de pago, etc.", required: true },
      { id: "tasa_interes", label: "Tasa de interés pactada", placeholder: "Porcentaje anual pactado, o 'legal' si no se pactó", required: false },
      { id: "bienes_embargo", label: "Bienes señalados para embargo", placeholder: "Descripción de bienes del deudor para garantizar el adeudo", required: false },
      { id: "personas_autorizadas", label: "Personas autorizadas", placeholder: "Nombre de abogados autorizados", required: false },
    ],
    body:
`C. JUEZ DE LO MERCANTIL EN TURNO EN {{ciudad_competencia}}
P R E S E N T E

{{actor}}, mexicano(a), mayor de edad, señalando como domicilio para oír y recibir todo tipo de notificaciones el ubicado en {{domicilio_actor}}, autorizando en los términos del artículo 1069 del Código de Comercio a {{personas_autorizadas}}, ante usted con el debido respeto comparezco y expongo:

Que por medio del presente escrito, con fundamento en los artículos 1391, 1392, 1393, 1394, 1396 y demás aplicables del Código de Comercio, así como los artículos 150, 151, 152, 167, 169, 170 y demás relativos de la Ley General de Títulos y Operaciones de Crédito, vengo a demandar en la VÍA EJECUTIVA MERCANTIL a {{demandado}}, con domicilio en {{domicilio_demandado}}, a quien reclamo las siguientes:

I. PRESTACIONES:

PRIMERA.- El pago de la cantidad de \${{monto}} ({{monto_letra}} PESOS 00/100 MONEDA NACIONAL) como suerte principal, derivada del {{titulo}} suscrito a favor del suscrito, que se anexa como documento base de la acción.

SEGUNDA.- El pago de los intereses moratorios a razón del {{tasa_interes}} anual, contados a partir de la fecha de vencimiento ({{fecha_vencimiento}}) y hasta la total liquidación del adeudo.

TERCERA.- El pago de los gastos y costas que se originen con motivo del presente juicio.

II. DOCUMENTO BASE DE LA ACCIÓN:
Exhibo como documento base de la acción el {{titulo}} con las siguientes características:
{{descripcion_titulo}}
Suscrito el {{fecha_suscripcion}}, con vencimiento el {{fecha_vencimiento}}, por la cantidad de \${{monto}}.

Dicho título de crédito reúne los requisitos que establecen los artículos 170 y 171 de la Ley General de Títulos y Operaciones de Crédito, y constituye título ejecutivo en términos del artículo 1391, fracción IV, del Código de Comercio.

III. HECHOS:

PRIMERO.- Con fecha {{fecha_suscripcion}}, el demandado {{demandado}} suscribió a favor del suscrito el {{titulo}} descrito en el apartado anterior, obligándose al pago de la cantidad de \${{monto}}.

SEGUNDO.- La fecha de vencimiento del documento fue el {{fecha_vencimiento}}, sin que a la fecha el demandado haya cubierto el pago de la cantidad adeudada, a pesar de los requerimientos extrajudiciales realizados.

TERCERO.- En virtud de lo anterior, el suscrito se ve en la necesidad de acudir ante este H. Juzgado a ejercitar la acción cambiaria directa.

IV. FUNDAMENTO DE DERECHO:
Artículos 1049, 1050, 1051, 1052, 1054, 1055, 1069, 1391, 1392, 1393, 1394, 1396 del Código de Comercio; artículos 150, 151, 152, 167, 169, 170, 171 de la Ley General de Títulos y Operaciones de Crédito.

V. PRUEBAS:

A) DOCUMENTAL BASE DE LA ACCIÓN: El {{titulo}} original que se exhibe con la demanda.

B) CONFESIONAL: A cargo del demandado {{demandado}}.

C) PRESUNCIONAL LEGAL Y HUMANA: En todo lo que favorezca al actor.

D) INSTRUMENTAL DE ACTUACIONES.

VI. SEÑALAMIENTO DE BIENES PARA EMBARGO:
Para el caso de que el demandado no haga pago llano al momento del requerimiento, señalo como bienes para embargo: {{bienes_embargo}}.

VII. PUNTOS PETITORIOS:
A usted, C. Juez, atentamente pido se sirva:

PRIMERO.- Tenerme por presentado con la demanda en la vía ejecutiva mercantil.
SEGUNDO.- Tener como documento base de la acción el {{titulo}} que se acompaña.
TERCERO.- Dictar auto de exequendo, despachando ejecución en contra del demandado.
CUARTO.- Requerir de pago al demandado y, en caso de no hacerlo, trabar embargo sobre los bienes señalados.
QUINTO.- Emplazar al demandado para que dentro del término legal oponga las excepciones que estime procedentes.
SEXTO.- En su oportunidad dictar sentencia de remate condenando al demandado al pago de las prestaciones reclamadas.

PROTESTO LO NECESARIO EN DERECHO.

{{ciudad_competencia}}, a {{fecha_escrito}}.

_______________________________
{{actor}}`,
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "recurso-revocacion-guiado",
    category: "Administrativo/Fiscal",
    title: "Recurso de revocación fiscal",
    description: "Recurso de revocación ante autoridades fiscales conforme a los artículos 116 a 133-A del Código Fiscal de la Federación.",
    fields: [
      { id: "recurrente", label: "Recurrente (contribuyente)", placeholder: "Nombre completo o razón social", required: true },
      { id: "rfc", label: "RFC", placeholder: "RFC del contribuyente", required: true },
      { id: "domicilio_fiscal", label: "Domicilio fiscal", placeholder: "Domicilio fiscal del contribuyente", required: true },
      { id: "autoridad", label: "Autoridad emisora", placeholder: "Administración Desconcentrada que emitió la resolución", required: true },
      { id: "resolucion", label: "Número y fecha de resolución impugnada", placeholder: "Número de oficio y fecha de la resolución", required: true },
      { id: "fecha_notificacion", label: "Fecha de notificación de la resolución", placeholder: "DD/MM/AAAA", required: true },
      { id: "monto_credito", label: "Monto del crédito fiscal", placeholder: "Monto determinado en la resolución impugnada", required: true },
      { id: "agravios", label: "Agravios (motivos de inconformidad)", placeholder: "Exposición detallada de cada agravio: violaciones formales y de fondo", required: true },
      { id: "garantia", label: "Garantía del interés fiscal", placeholder: "Forma de garantía: depósito, fianza, embargo en la vía administrativa, o suspensión si se solicita", required: false },
      { id: "personas_autorizadas", label: "Representante legal o autorizado", placeholder: "Nombre del representante legal y datos del poder notarial", required: false },
    ],
    body:
`ADMINISTRACIÓN DESCONCENTRADA JURÍDICA DE {{jurisdiccion_sat}}
DEL SERVICIO DE ADMINISTRACIÓN TRIBUTARIA
P R E S E N T E

{{recurrente}}, con Registro Federal de Contribuyentes {{rfc}}, con domicilio fiscal en {{domicilio_fiscal}}, por conducto de {{personas_autorizadas}}, ante esa H. Autoridad con el debido respeto comparezco y expongo:

Que por medio del presente escrito, con fundamento en los artículos 116, 117, fracción I, inciso a), 118, 120, 121, 122, 123, 130, 131, 132 y 133 del Código Fiscal de la Federación, dentro del plazo de 30 días hábiles contados a partir del día siguiente al en que surtió efectos la notificación de la resolución que se impugna (notificada el {{fecha_notificacion}}), vengo a interponer RECURSO DE REVOCACIÓN en contra de la resolución contenida en el oficio número {{resolucion}}, emitida por {{autoridad}}.

I. RESOLUCIÓN IMPUGNADA:
La contenida en el oficio número {{resolucion}}, emitida por {{autoridad}}, mediante la cual se determina un crédito fiscal por la cantidad de \${{monto_credito}}.

II. HECHOS:

PRIMERO.- Con fecha indicada en la resolución impugnada, la autoridad {{autoridad}} emitió la resolución número {{resolucion}}, misma que fue notificada al contribuyente el día {{fecha_notificacion}}.

SEGUNDO.- En dicha resolución se determinó un crédito fiscal por la cantidad de \${{monto_credito}}, el cual se impugna por las razones que se expresan en los agravios.

TERCERO.- El presente recurso se interpone dentro del plazo legal de 30 días hábiles establecido en el artículo 121 del Código Fiscal de la Federación.

III. AGRAVIOS:

{{agravios}}

IV. FUNDAMENTO DE DERECHO:
Artículos 116 al 133-A del Código Fiscal de la Federación; artículos 1°, 14, 16, 22 y 31, fracción IV, de la Constitución Política de los Estados Unidos Mexicanos; y demás aplicables.

V. PRUEBAS:

A) DOCUMENTALES PÚBLICAS:
1. Copia certificada de la resolución impugnada (oficio {{resolucion}}).
2. Constancia de notificación de la resolución.
3. Acuse de recibo del presente recurso.

B) DOCUMENTALES PRIVADAS:
1. Declaraciones fiscales del ejercicio(s) objeto de la resolución.
2. Comprobantes fiscales digitales (CFDI) relacionados.
3. Papeles de trabajo y demás documentación contable.

C) PERICIAL CONTABLE: Se reserva el derecho de ofrecerla en caso necesario.

D) PRESUNCIONAL LEGAL Y HUMANA: En todo lo que favorezca al recurrente.

E) INSTRUMENTAL DE ACTUACIONES.

VI. GARANTÍA DEL INTERÉS FISCAL:
{{garantia}}

VII. PUNTOS PETITORIOS:

PRIMERO.- Tener por interpuesto en tiempo y forma el presente recurso de revocación.
SEGUNDO.- Admitir las pruebas ofrecidas.
TERCERO.- En su oportunidad dictar resolución en la que se REVOQUE la resolución impugnada.
CUARTO.- Declarar la nulidad del crédito fiscal determinado.

PROTESTO LO NECESARIO EN DERECHO.

{{ciudad_competencia}}, a {{fecha_escrito}}.

_______________________________
{{recurrente}}`,
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "promocion-general",
    category: "General",
    title: "Promoción general / solicitud al juzgado",
    description: "Formato de promoción para solicitar copias, autorizar personas, señalar domicilio, desahogar requerimientos u ofrecer pruebas.",
    fields: [
      { id: "promovente", label: "Promovente", placeholder: "Nombre completo de quien promueve", required: true },
      { id: "expediente", label: "Número de expediente", placeholder: "Número de expediente o toca", required: true },
      { id: "autoridad", label: "Autoridad o juzgado", placeholder: "Denominación del juzgado o tribunal", required: true },
      { id: "caracter", label: "Carácter en el juicio", placeholder: "Actor, demandado, tercero, etc.", required: true },
      { id: "peticion", label: "Objeto de la promoción", placeholder: "Qué se solicita: copias, autorización, desahogo de requerimiento, etc.", required: true },
      { id: "fundamento", label: "Fundamento legal", placeholder: "Artículos aplicables", required: false },
      { id: "anexos", label: "Anexos", placeholder: "Documentos que se acompañan a la promoción", required: false },
      { id: "personas_autorizadas", label: "Personas autorizadas", placeholder: "Nombre de abogados autorizados, si se desea agregar o cambiar", required: false },
    ],
    body:
`EXPEDIENTE: {{expediente}}

C. {{autoridad}}
P R E S E N T E

{{promovente}}, en mi carácter de parte {{caracter}} dentro del expediente número {{expediente}}, señalando el domicilio que obra en autos para oír y recibir notificaciones, ante usted con el debido respeto comparezco para:

SOLICITAR: {{peticion}}.

HECHOS:
PRIMERO.- Con fecha que obra en autos, el suscrito fue notificado del auto o resolución correspondiente en el expediente de referencia.

SEGUNDO.- En alcance a lo anterior y dentro del término legal, comparezco a presentar la promoción descrita.

FUNDAMENTO LEGAL:
Lo dispuesto en los artículos {{fundamento}} y demás aplicables.

ANEXOS:
{{anexos}}

AUTORIZACIÓN DE PERSONAS:
En términos del artículo 1069 del Código de Comercio y/o artículo equivalente del Código de Procedimientos Civiles aplicable, autorizo a {{personas_autorizadas}} para oír y recibir notificaciones, imponerse de autos, y realizar cualquier trámite necesario en el presente asunto.

PUNTOS PETITORIOS:
ÚNICO.- Se sirva tener por presentada la presente promoción y acordar de conformidad lo solicitado.

PROTESTO LO NECESARIO EN DERECHO.

{{ciudad_competencia}}, a {{fecha_escrito}}.

_______________________________
{{promovente}}`,
    exportFormats: ["word", "pdf", "text"],
    disclaimer: PROFESSIONAL_REVIEW,
  },
  {
    id: "contestacion-demanda",
    category: "Civil",
    title: "Contestación de demanda civil",
    description: "Escrito de contestación de demanda en materia civil con excepciones, defensas, contestación a hechos y ofrecimiento de pruebas.",
    fields: [
      { id: "demandado", label: "Demandado", placeholder: "Nombre completo del demandado", required: true },
      { id: "domicilio_demandado", label: "Domicilio para notificaciones", placeholder: "Calle, número, colonia, ciudad, estado, C.P.", required: true },
      { id: "expediente", label: "Número de expediente", placeholder: "Número de expediente", required: true },
      { id: "actor", label: "Nombre del actor", placeholder: "Nombre del demandante", required: true },
      { id: "excepciones_dilatorias", label: "Excepciones dilatorias (procesales)", placeholder: "Incompetencia, falta de personalidad, litispendencia, conexidad, oscuridad de demanda, etc.", required: true },
      { id: "excepciones_perentorias", label: "Excepciones perentorias (de fondo)", placeholder: "Pago, prescripción, compensación, novación, cosa juzgada, etc.", required: true },
      { id: "contestacion_hechos", label: "Contestación a los hechos", placeholder: "Respuesta numerada a cada hecho de la demanda: cierto, falso, o lo que a derecho convenga", required: true },
      { id: "hechos_propios", label: "Hechos propios del demandado", placeholder: "Hechos que el demandado quiera hacer valer en su defensa", required: false },
      { id: "reconvencion", label: "Reconvención (contrademanda)", placeholder: "Prestaciones que el demandado reclama al actor, si aplica", required: false },
      { id: "personas_autorizadas", label: "Personas autorizadas", placeholder: "Nombre de abogados autorizados", required: false },
    ],
    body:
`EXPEDIENTE: {{expediente}}

C. JUEZ DE LO CIVIL
P R E S E N T E

{{demandado}}, mexicano(a), mayor de edad, señalando como domicilio para oír y recibir todo tipo de notificaciones el ubicado en {{domicilio_demandado}}, autorizando en términos de ley a {{personas_autorizadas}}, en los autos del juicio ordinario civil promovido por {{actor}} en mi contra, dentro del expediente número {{expediente}}, ante usted con el debido respeto comparezco para dar CONTESTACIÓN A LA DEMANDA en los siguientes términos:

I. EXCEPCIONES DILATORIAS (PROCESALES):
Opongo las siguientes excepciones procesales:

{{excepciones_dilatorias}}

II. EXCEPCIONES PERENTORIAS (DE FONDO):
Opongo las siguientes excepciones de fondo:

{{excepciones_perentorias}}

III. CONTESTACIÓN A LOS HECHOS DE LA DEMANDA:

{{contestacion_hechos}}

IV. HECHOS PROPIOS DEL DEMANDADO:

{{hechos_propios}}

V. FUNDAMENTO DE DERECHO:
Son aplicables los artículos 35, 36, 260, 266, 271, 272 y demás relativos del Código de Procedimientos Civiles aplicable; artículos del Código Civil aplicables a las excepciones y defensas opuestas; así como la jurisprudencia y tesis aisladas invocadas.

VI. PRUEBAS:

A) CONFESIONAL: A cargo del actor {{actor}}, quien deberá ser citado a absolver posiciones bajo apercibimiento legal.

B) DOCUMENTALES PÚBLICAS:
Las que se acompañan al presente escrito.

C) DOCUMENTALES PRIVADAS:
Las que se exhiben y las que se ofrezcan durante el juicio.

D) TESTIMONIAL: A cargo de testigos que se nombrarán oportunamente.

E) PERICIAL: En la materia que resulte necesaria.

F) PRESUNCIONAL LEGAL Y HUMANA: En todo lo que favorezca al demandado.

G) INSTRUMENTAL DE ACTUACIONES.

VII. RECONVENCIÓN:
{{reconvencion}}

VIII. PUNTOS PETITORIOS:

PRIMERO.- Tenerme por presentado dando contestación a la demanda en tiempo y forma.
SEGUNDO.- Tener por opuestas las excepciones dilatorias y perentorias señaladas.
TERCERO.- Admitir las pruebas ofrecidas.
CUARTO.- En su oportunidad dictar sentencia absolutoria a favor del demandado.

PROTESTO LO NECESARIO EN DERECHO.

{{ciudad_competencia}}, a {{fecha_escrito}}.

_______________________________
{{demandado}}`,
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
