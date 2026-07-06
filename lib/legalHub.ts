export type LegalHubTabId =
  | "materias"
  | "leyes"
  | "jurisprudencia"
  | "boletines"
  | "sise"
  | "machotes";

export type LegalHubTab = {
  id: LegalHubTabId;
  label: string;
  description: string;
};

export type LegalSourceShortcut = {
  id: string;
  tabId: LegalHubTabId;
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  sourceHref?: string;
  tags: string[];
  status: "listo" | "busqueda" | "requiere_navegador";
};

export type LegalTemplate = {
  id: string;
  title: string;
  matter: string;
  description: string;
  useCase: string;
  body: string;
};

export const LEGAL_HUB_TABS: LegalHubTab[] = [
  {
    id: "materias",
    label: "Materias",
    description: "Accesos rapidos para civil, mercantil, familiar, amparo y revocacion.",
  },
  {
    id: "leyes",
    label: "Leyes actuales",
    description: "Consulta leyes federales, reformas y el Codigo Nacional de Procedimientos Civiles y Familiares.",
  },
  {
    id: "jurisprudencia",
    label: "Jurisprudencia SCJN",
    description: "Busca tesis y jurisprudencias nuevas de la Suprema Corte y el Semanario Judicial.",
  },
  {
    id: "boletines",
    label: "Boletines",
    description: "Atajos al boletin judicial federal, boletines estatales y boletin general del CJF.",
  },
  {
    id: "sise",
    label: "SISE/CJF",
    description: "Entrada organizada a fuentes del Consejo de la Judicatura Federal y busqueda relacionada con SISe.",
  },
  {
    id: "machotes",
    label: "Machotes",
    description: "Formatos base para escritos frecuentes: amparo, revocacion, solicitudes y promociones.",
  },
];

export const LEGAL_SOURCE_SHORTCUTS: LegalSourceShortcut[] = [
  {
    id: "civil",
    tabId: "materias",
    title: "Derecho civil",
    eyebrow: "Materia",
    description: "Contratos, obligaciones, sucesiones, responsabilidad civil, propiedad y procedimientos civiles.",
    href: "/search?matter=civil&query=derecho%20civil&auto=1",
    tags: ["Civil", "Contratos", "Sucesiones"],
    status: "listo",
  },
  {
    id: "mercantil",
    tabId: "materias",
    title: "Derecho mercantil",
    eyebrow: "Materia",
    description: "Codigo de Comercio, sociedades, titulos de credito, concurso mercantil y actos de comercio.",
    href: "/search?matter=mercantil&query=derecho%20mercantil&auto=1",
    tags: ["Mercantil", "Sociedades", "Titulos de credito"],
    status: "listo",
  },
  {
    id: "familiar",
    tabId: "materias",
    title: "Derecho familiar",
    eyebrow: "Materia",
    description: "Alimentos, guarda y custodia, convivencia, divorcio, patria potestad y proteccion de menores.",
    href: "/search?matter=familiar&query=derecho%20familiar&auto=1",
    tags: ["Familiar", "Alimentos", "Custodia"],
    status: "listo",
  },
  {
    id: "amparo",
    tabId: "materias",
    title: "Amparo y medios de defensa",
    eyebrow: "Materia",
    description: "Juicio de amparo, suspension, revision, queja, reclamacion y conceptos de violacion.",
    href: "/search?matter=amparo&query=juicio%20de%20amparo&auto=1",
    tags: ["Amparo", "Revision", "Suspension"],
    status: "listo",
  },
  {
    id: "cnpcf",
    tabId: "leyes",
    title: "Codigo Nacional de Procedimientos Civiles y Familiares",
    eyebrow: "Ley clave",
    description: "Atajo para revisar publicaciones, reformas y criterios relacionados con el CNPCF.",
    href: "/search?matter=cnpcf&query=Codigo%20Nacional%20de%20Procedimientos%20Civiles%20y%20Familiares&auto=1",
    sourceHref: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPCF.pdf",
    tags: ["CNPCF", "Civil", "Familiar", "Procesal"],
    status: "busqueda",
  },
  {
    id: "leyes-vigentes-operativo",
    tabId: "leyes",
    title: "Modulo de leyes vigentes",
    eyebrow: "Catalogo operativo",
    description: "Panel por materia con Codigo Civil Federal, Codigo Civil de Jalisco, Codigo de Comercio, CNPCF, Amparo, CNPP y leyes mercantiles.",
    href: "/legal-hub/leyes-vigentes",
    sourceHref: "/legal-hub/leyes-vigentes",
    tags: ["Civil", "Mercantil", "CNPCF", "Jalisco"],
    status: "listo",
  },
  {
    id: "leyes-federales",
    tabId: "leyes",
    title: "Leyes federales vigentes",
    eyebrow: "Camara de Diputados",
    description: "Consulta leyes actuales desde el compendio federal y cruza resultados con DOF/SIDOF.",
    href: "/search?source=DIPUTADOS&query=leyes%20federales%20vigentes&auto=1",
    sourceHref: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
    tags: ["Diputados", "Leyes", "Reformas"],
    status: "busqueda",
  },
  {
    id: "dof-actualizaciones",
    tabId: "leyes",
    title: "Actualizaciones del DOF/SIDOF",
    eyebrow: "Diario Oficial",
    description: "Revisa decretos, acuerdos y reformas publicados recientemente en fuentes federales.",
    href: "/search?source=SIDOF&query=reforma%20decreto%20acuerdo&dateRange=this_week&auto=1",
    sourceHref: "https://sidof.segob.gob.mx",
    tags: ["DOF", "SIDOF", "Reformas"],
    status: "listo",
  },
  {
    id: "scjn-jurisprudencia",
    tabId: "jurisprudencia",
    title: "Jurisprudencias y tesis SCJN/SJF",
    eyebrow: "SCJN",
    description: "Busqueda enfocada en nuevas tesis, jurisprudencias y criterios relevantes de la Suprema Corte.",
    href: "/search?source=SJF&query=jurisprudencia%20tesis%20SCJN&auto=1",
    sourceHref: "https://sjf2.scjn.gob.mx",
    tags: ["SCJN", "SJF", "Jurisprudencia"],
    status: "requiere_navegador",
  },
  {
    id: "jurisprudencia-avanzada",
    tabId: "jurisprudencia",
    title: "Busqueda guiada de jurisprudencia",
    eyebrow: "Formulario juridico",
    description: "Busca por palabra clave, materia, registro digital, organo emisor, epoca, tipo de criterio, fecha y tema juridico.",
    href: "/legal-hub/jurisprudencia",
    sourceHref: "https://sjf2.scjn.gob.mx",
    tags: ["Registro digital", "Tipo de criterio", "SJF"],
    status: "listo",
  },
  {
    id: "scjn-civil-mercantil",
    tabId: "jurisprudencia",
    title: "Criterios civil, familiar y mercantil",
    eyebrow: "SCJN",
    description: "Consulta criterios por materia para detectar cambios aplicables a litigios civiles y mercantiles.",
    href: "/search?query=jurisprudencia%20civil%20familiar%20mercantil&auto=1",
    tags: ["Civil", "Familiar", "Mercantil"],
    status: "busqueda",
  },
  {
    id: "boletin-federal",
    tabId: "boletines",
    title: "Boletin judicial federal",
    eyebrow: "Federal",
    description: "Atajo para buscar acuerdos, listas y publicaciones judiciales federales disponibles en fuentes oficiales.",
    href: "/search?query=boletin%20judicial%20federal&auto=1",
    sourceHref: "/admin/sources",
    tags: ["Boletin", "Federal", "Judicial"],
    status: "busqueda",
  },
  {
    id: "boletin-general-cjf",
    tabId: "boletines",
    title: "Boletin general del CJF",
    eyebrow: "Consejo de la Judicatura Federal",
    description: "Busqueda preparada para avisos y comunicaciones del Consejo de la Judicatura Federal.",
    href: "/search?query=boletin%20general%20Consejo%20de%20la%20Judicatura%20Federal&auto=1",
    sourceHref: "https://www.cjf.gob.mx/consultas.htm",
    tags: ["CJF", "Boletin", "Acuerdos"],
    status: "busqueda",
  },
  {
    id: "boletin-estatal-jalisco",
    tabId: "boletines",
    title: "Boletin judicial del estado",
    eyebrow: "Jalisco",
    description: "Punto de partida estatal para publicaciones judiciales y periodico oficial local.",
    href: "/search?query=boletin%20judicial%20Jalisco&auto=1",
    sourceHref: "https://ciudadano.cjj.gob.mx/boletin_judicial/consultar",
    tags: ["Estado", "Jalisco", "Boletin"],
    status: "busqueda",
  },
  {
    id: "cjf-sise",
    tabId: "sise",
    title: "SISE y consulta CJF",
    eyebrow: "CJF",
    description: "Acceso de busqueda para SISe, listas, acuerdos y expedientes publicados por el Poder Judicial Federal.",
    href: "/search?query=SISE%20Consejo%20de%20la%20Judicatura%20Federal&auto=1",
    sourceHref: "https://sise.cjf.gob.mx/SiseInternet/default.aspx",
    tags: ["SISE", "CJF", "Expedientes"],
    status: "requiere_navegador",
  },
  {
    id: "seguimiento-expedientes",
    tabId: "sise",
    title: "Seguimiento de expedientes y actuaciones",
    eyebrow: "Control interno",
    description: "Guarda parametros de SISE, CJF y boletines estatales, registra actuaciones y abre la fuente oficial autorizada.",
    href: "/legal-hub/expedientes",
    sourceHref: "https://sise.cjf.gob.mx/SiseInternet/default.aspx",
    tags: ["Actuaciones", "Expedientes", "Boletines"],
    status: "listo",
  },
];

export const LEGAL_TEMPLATES: LegalTemplate[] = [
  {
    id: "amparo-indirecto",
    title: "Machote de demanda de amparo indirecto",
    matter: "Amparo",
    description: "Base para ordenar quejoso, autoridad responsable, acto reclamado, antecedentes y conceptos de violacion.",
    useCase: "Cuando se necesita iniciar un amparo indirecto y el abogado quiere una estructura inicial editable.",
    body: `C. JUEZ DE DISTRITO EN TURNO

[NOMBRE DEL QUEJOSO], por mi propio derecho, senalando como domicilio para oir y recibir notificaciones el ubicado en [DOMICILIO], autorizando a [AUTORIZADOS], comparezco para exponer:

Con fundamento en los articulos 103 y 107 constitucionales y en la Ley de Amparo, solicito el amparo y proteccion de la Justicia Federal en contra de los actos y autoridades siguientes:

I. NOMBRE Y DOMICILIO DEL QUEJOSO.
II. AUTORIDADES RESPONSABLES.
III. ACTO RECLAMADO.
IV. TERCERO INTERESADO, EN SU CASO.
V. ANTECEDENTES.
VI. CONCEPTOS DE VIOLACION.
VII. SUSPENSION DEL ACTO RECLAMADO.

Por lo expuesto, solicito se admita la demanda y se conceda la suspension cuando proceda.`,
  },
  {
    id: "recurso-revocacion",
    title: "Machote de recurso de revocacion",
    matter: "Fiscal / Administrativo",
    description: "Formato base para impugnar una resolucion administrativa o fiscal ante la autoridad competente.",
    useCase: "Cuando se requiere armar un recurso con agravios, pruebas y puntos petitorios claros.",
    body: `C. AUTORIDAD COMPETENTE

[NOMBRE DEL RECURRENTE], personalidad que acredito con [DOCUMENTO], senalando domicilio para oir notificaciones en [DOMICILIO], comparezco para interponer RECURSO DE REVOCACION en contra de la resolucion identificada como [RESOLUCION].

I. AUTORIDAD EMISORA.
II. RESOLUCION IMPUGNADA.
III. FECHA DE NOTIFICACION.
IV. ANTECEDENTES.
V. AGRAVIOS.
VI. PRUEBAS.
VII. PUNTOS PETITORIOS.

Solicito se admita el presente recurso y, en su oportunidad, se revoque la resolucion impugnada.`,
  },
  {
    id: "solicitud-simple",
    title: "Machote de solicitud o promocion simple",
    matter: "General",
    description: "Escrito breve para pedir copias, autorizaciones, informes, agregados o impulso procesal.",
    useCase: "Cuando hace falta una promocion rapida ante juzgado, autoridad administrativa o area de tramite.",
    body: `C. [AUTORIDAD O JUZGADO]

[NOMBRE], con la personalidad reconocida en el expediente [NUMERO], comparezco respetuosamente para exponer:

Por medio del presente escrito solicito [PETICION CONCRETA], en virtud de [RAZON BREVE].

Por lo anterior, pido:

PRIMERO. Tenerme por presentado con este escrito.
SEGUNDO. Acordar de conformidad lo solicitado.

PROTESTO LO NECESARIO.`,
  },
  {
    id: "promocion-civil-mercantil",
    title: "Machote de promocion civil o mercantil",
    matter: "Civil / Mercantil",
    description: "Base para promociones en procedimientos civiles o mercantiles con numero de expediente.",
    useCase: "Cuando se necesita impulsar autos, exhibir documentos o solicitar acuerdo en juzgado.",
    body: `C. JUEZ [CIVIL/MERCANTIL] DE [LUGAR]

[NOMBRE], en mi caracter de [PARTE], dentro del expediente [NUMERO], comparezco para exponer:

Que por medio del presente escrito vengo a [SOLICITUD], con fundamento en [FUNDAMENTO], atendiendo a los siguientes:

HECHOS
1. [HECHO RELEVANTE].
2. [HECHO RELEVANTE].

PETICIONES
PRIMERA. Se tenga por hecha la manifestacion.
SEGUNDA. Se acuerde lo conducente conforme a derecho.`,
  },
];

export function getStatusLabel(status: LegalSourceShortcut["status"]) {
  if (status === "listo") return "Listo para busqueda local";
  if (status === "busqueda") return "Busqueda oficial externa";
  return "Puede requerir navegador o sesion";
}
