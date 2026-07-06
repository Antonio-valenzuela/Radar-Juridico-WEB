export interface ThesaurusEntry {
  canonical: string;
  materias: string[];
  aliases: string[];
  relatedTerms: string[];
  negativeTerms: string[];
  weight: number;
}

export const LEGAL_THESAURUS: Record<string, ThesaurusEntry> = {
  familiar: {
    canonical: "derecho familiar",
    materias: ["Civil", "Familiar", "Constitucional", "Derechos Humanos"],
    aliases: [
      "derecho familiar",
      "derecho de familia",
      "familia",
      "materia familiar",
      "juicio familiar",
      "procedimiento familiar",
      "controversia familiar"
    ],
    relatedTerms: [
      "alimentos",
      "pensión alimenticia",
      "obligación alimentaria",
      "guarda y custodia",
      "custodia",
      "patria potestad",
      "régimen de convivencia",
      "convivencia familiar",
      "visitas",
      "divorcio",
      "divorcio incausado",
      "concubinato",
      "matrimonio",
      "sociedad conyugal",
      "filiación",
      "reconocimiento de hijos",
      "paternidad",
      "maternidad",
      "adopción",
      "tutela",
      "interés superior de la niñez",
      "niñas niños y adolescentes",
      "violencia familiar",
      "violencia vicaria",
      "alienación parental",
      "medidas de protección",
      "Código Civil Federal",
      "Código Nacional de Procedimientos Civiles y Familiares",
      "Ley General de los Derechos de Niñas Niños y Adolescentes"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  cnpcf: {
    canonical: "Código Nacional de Procedimientos Civiles y Familiares",
    materias: ["Civil", "Familiar", "Procesal", "Derechos Humanos"],
    aliases: [
      "Código Nacional de Procedimientos Civiles y Familiares",
      "Codigo Nacional de Procedimientos Civiles y Familiares",
      "CNPCF",
      "codigo nacional civil y familiar",
      "procedimiento civil y familiar",
      "procedimientos civiles y familiares",
      "nuevo codigo procesal civil y familiar"
    ],
    relatedTerms: [
      "Código Nacional de Procedimientos Civiles y Familiares",
      "justicia digital",
      "oralidad civil",
      "oralidad familiar",
      "audiencia preliminar",
      "audiencia de juicio",
      "expediente electrónico",
      "notificación electrónica",
      "juicio oral civil",
      "procedimiento familiar",
      "procedimiento civil",
      "medidas cautelares",
      "prueba anticipada",
      "ejecución de sentencia",
      "transitorios CNPCF",
      "declaratoria de vigencia",
      "implementación gradual"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  civil: {
    canonical: "derecho civil",
    materias: ["Civil", "Obligaciones", "Contratos"],
    aliases: [
      "derecho civil",
      "materia civil",
      "juicio civil",
      "procedimiento civil",
      "codigo civil"
    ],
    relatedTerms: [
      "obligaciones",
      "contrato",
      "convenio",
      "arrendamiento",
      "compraventa",
      "hipoteca",
      "usufructo",
      "servidumbre",
      "copropiedad",
      "prescripción adquisitiva",
      "usucapión",
      "posesión",
      "propiedad",
      "daño moral",
      "responsabilidad civil",
      "daños y perjuicios",
      "herencia",
      "testamento",
      "sucesión",
      "sucesorio",
      "albacea",
      "personalidad jurídica",
      "capacidad legal"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  penal: {
    canonical: "derecho penal",
    materias: ["Penal", "Seguridad", "Justicia", "Constitucional"],
    aliases: [
      "derecho penal",
      "materia penal",
      "delitos",
      "proceso penal",
      "procedimiento penal",
      "sistema penal",
      "justicia penal",
      "codigo penal"
    ],
    relatedTerms: [
      "Código Penal Federal",
      "Código Nacional de Procedimientos Penales",
      "delito",
      "pena",
      "prisión",
      "medidas cautelares",
      "carpeta de investigación",
      "ministerio público",
      "imputado",
      "víctima",
      "sentencia penal",
      "delincuencia organizada",
      "homicidio",
      "lesiones",
      "robo",
      "fraude",
      "extorsión",
      "secuestro",
      "feminicidio",
      "violencia de género",
      "portación de arma",
      "narcomenudeo",
      "lavado de dinero",
      "aseguramiento",
      "decomiso",
      "reparación del daño",
      "vinculación a proceso",
      "prisión preventiva"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  fiscal: {
    canonical: "derecho fiscal",
    materias: ["Fiscal", "Tributario", "Finanzas"],
    aliases: [
      "derecho fiscal",
      "materia fiscal",
      "derecho tributario",
      "impuestos",
      "contribuciones"
    ],
    relatedTerms: [
      "Código Fiscal de la Federación",
      "SAT",
      "impuesto sobre la renta",
      "ISR",
      "impuesto al valor agregado",
      "IVA",
      "IEPS",
      "crédito fiscal",
      "multa fiscal",
      "facultades de comprobación",
      "visita domiciliaria",
      "revisión de gabinete",
      "defensa fiscal",
      "recurso de revocación",
      "juicio de nulidad",
      "Tribunal Federal de Justicia Administrativa",
      "TFJA",
      "procedimiento administrativo de ejecución",
      "PAE",
      "buzón tributario",
      "facturación electrónica",
      "CFDI",
      "doble tributación"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  laboral: {
    canonical: "derecho laboral",
    materias: ["Laboral", "Trabajo", "Seguridad Social"],
    aliases: [
      "derecho laboral",
      "materia laboral",
      "derecho del trabajo",
      "relaciones laborales"
    ],
    relatedTerms: [
      "Ley Federal del Trabajo",
      "patrón",
      "trabajador",
      "contrato individual de trabajo",
      "contrato colectivo",
      "salario",
      "jornada de trabajo",
      "horas extras",
      "despido injustificado",
      "indemnización constitucional",
      "salarios caídos",
      "reinstalación",
      "sindicato",
      "huelga",
      "reparto de utilidades",
      "PTU",
      "aguinaldo",
      "vacaciones",
      "prima vacacional",
      "Centro Federal de Conciliación y Registro Laboral",
      "tribunales laborales",
      "outsourcing",
      "subcontratación"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  mercantil: {
    canonical: "derecho mercantil",
    materias: ["Mercantil", "Corporativo", "Comercio"],
    aliases: [
      "derecho mercantil",
      "materia mercantil",
      "comercio",
      "comercial"
    ],
    relatedTerms: [
      "Código de Comercio",
      "sociedad mercantil",
      "sociedad anónima",
      "S.A.",
      "sociedad de responsabilidad limitada",
      "S. de R.L.",
      "títulos de crédito",
      "pagaré",
      "letra de cambio",
      "cheque",
      "fideicomiso",
      "concurso mercantil",
      "quiebra",
      "título valor",
      "fusión",
      "escisión",
      "asamblea de accionistas",
      "acta constitutiva",
      "contrato mercantil",
      "franquicia",
      "comisión mercantil"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  administrativo: {
    canonical: "derecho administrativo",
    materias: ["Administrativo", "Público"],
    aliases: [
      "derecho administrativo",
      "materia administrativa",
      "administración pública"
    ],
    relatedTerms: [
      "Ley Federal de Procedimiento Administrativo",
      "acto administrativo",
      "concesión",
      "licencia",
      "permiso",
      "licitación pública",
      "adjudicación directa",
      "responsabilidad administrativa",
      "servidores públicos",
      "silencio administrativo",
      "afirmativa ficta",
      "negativa ficta",
      "clausura",
      "multa administrativa",
      "expropiación",
      "utilidad pública",
      "recurso de revisión"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  constitucional: {
    canonical: "derecho constitucional",
    materias: ["Constitucional", "Derechos Humanos"],
    aliases: [
      "derecho constitucional",
      "materia constitucional",
      "constitucionalidad"
    ],
    relatedTerms: [
      "Constitución Política de los Estados Unidos Mexicanos",
      "CPEUM",
      "derechos humanos",
      "garantías individuales",
      "controversia constitucional",
      "acción de inconstitucionalidad",
      "juicio de amparo",
      "supremacía constitucional",
      "bloque de constitucionalidad",
      "control de convencionalidad",
      "interpretación conforme",
      "pro persona",
      "tratados internacionales"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  amparo: {
    canonical: "juicio de amparo",
    materias: ["Constitucional", "Procesal"],
    aliases: [
      "amparo",
      "juicio de amparo",
      "amparo indirecto",
      "amparo directo",
      "juicio de garantías"
    ],
    relatedTerms: [
      "Ley de Amparo",
      "suspensión del acto reclamado",
      "acto reclamado",
      "autoridad responsable",
      "quejoso",
      "tercero interesado",
      "conceptos de violación",
      "sentencia de amparo",
      "recurso de revisión",
      "recurso de queja",
      "recurso de reclamación",
      "interés jurídico",
      "interés legítimo",
      "principio de definitividad",
      "fórmula Otero",
      "declaratoria general de inconstitucionalidad"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  seguridad_social: {
    canonical: "seguridad social",
    materias: ["Laboral", "Seguridad Social", "Salud"],
    aliases: [
      "seguridad social",
      "imss",
      "issste",
      "infonavit",
      "pensiones"
    ],
    relatedTerms: [
      "Ley del Seguro Social",
      "Ley del ISSSTE",
      "pensión por cesantía",
      "pensión por vejez",
      "pensión por invalidez",
      "riesgo de trabajo",
      "enfermedad profesional",
      "incapacidad temporal",
      "incapacidad permanente",
      "cuotas obrero-patronales",
      "régimen obligatorio",
      "régimen voluntario",
      "guarderías",
      "afore",
      "SAR",
      "subcuenta de vivienda"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  salud: {
    canonical: "derecho a la salud",
    materias: ["Administrativo", "Salud", "Derechos Humanos"],
    aliases: [
      "derecho a la salud",
      "salud pública",
      "materia sanitaria",
      "sanitario"
    ],
    relatedTerms: [
      "Ley General de Salud",
      "COFEPRIS",
      "autorización sanitaria",
      "registro sanitario",
      "medicamento",
      "dispositivo médico",
      "establecimiento de salud",
      "atención médica",
      "expediente clínico",
      "consentimiento informado",
      "negligencia médica",
      "responsabilidad médica",
      "salud reproductiva",
      "vacunas"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  energia: {
    canonical: "derecho energético",
    materias: ["Administrativo", "Energía", "Regulatorio"],
    aliases: [
      "derecho energetico",
      "energia",
      "hidrocarburos",
      "electricidad",
      "materia energetica"
    ],
    relatedTerms: [
      "Ley de Hidrocarburos",
      "Ley de la Industria Eléctrica",
      "CRE",
      "Comisión Reguladora de Energía",
      "CNH",
      "Comisión Nacional de Hidrocarburos",
      "CFE",
      "PEMEX",
      "SENER",
      "transición energética",
      "energías limpias",
      "permiso de generación",
      "transporte de gas",
      "gasolinera",
      "tarifas eléctricas",
      "contrato de cobertura eléctrica"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  ambiental: {
    canonical: "derecho ambiental",
    materias: ["Administrativo", "Ambiental", "Constitucional"],
    aliases: [
      "derecho ambiental",
      "materia ambiental",
      "medio ambiente",
      "ecología"
    ],
    relatedTerms: [
      "LGEEPA",
      "Ley General del Equilibrio Ecológico y la Protección al Ambiente",
      "PROFEPA",
      "SEMARNAT",
      "manifestación de impacto ambiental",
      "MIA",
      "daño ambiental",
      "responsabilidad ambiental",
      "áreas naturales protegidas",
      "residuos peligrosos",
      "emisiones contaminantes",
      "cambio climático",
      "recursos forestales",
      "aguas nacionales",
      "CONAGUA",
      "evaluación de impacto social"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  financiero: {
    canonical: "derecho financiero",
    materias: ["Financiero", "Bancario", "Mercantil"],
    aliases: [
      "derecho financiero",
      "bancario",
      "mercado de valores",
      "sistema financiero"
    ],
    relatedTerms: [
      "Ley de Instituciones de Crédito",
      "CNBV",
      "Comisión Nacional Bancaria y de Valores",
      "BANXICO",
      "Banco de México",
      "SHCP",
      "CONDUSEF",
      "operación bancaria",
      "crédito",
      "captación de recursos",
      "lavado de dinero",
      "PLD/FT",
      "prevención de lavado de dinero",
      "casas de bolsa",
      "fondos de inversión",
      "tecnología financiera",
      "fintech",
      "secreto bancario"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  electoral: {
    canonical: "derecho electoral",
    materias: ["Electoral", "Constitucional", "Público"],
    aliases: [
      "derecho electoral",
      "materia electoral",
      "elecciones",
      "voto"
    ],
    relatedTerms: [
      "LEGIPE",
      "Ley General de Instituciones y Procedimientos Electorales",
      "INE",
      "Instituto Nacional Electoral",
      "TEPJF",
      "Tribunal Electoral del Poder Judicial de la Federación",
      "partidos políticos",
      "campaña electoral",
      "propaganda política",
      "financiamiento público",
      "casilla electoral",
      "candidatura independiente",
      "delito electoral",
      "FEPADE",
      "justicia electoral"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  transparencia: {
    canonical: "transparencia y acceso a la información",
    materias: ["Administrativo", "Transparencia", "Constitucional"],
    aliases: [
      "transparencia",
      "acceso a la informacion",
      "informacion publica",
      "rendicion de cuentas"
    ],
    relatedTerms: [
      "Ley General de Transparencia",
      "INAI",
      "organismo garante",
      "solicitud de información",
      "recurso de revisión",
      "información reservada",
      "información confidencial",
      "versión pública",
      "comité de transparencia",
      "plataforma nacional de transparencia",
      "PNT",
      "datos abiertos"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  derechos_humanos: {
    canonical: "derechos humanos",
    materias: ["Constitucional", "Derechos Humanos", "Internacional"],
    aliases: [
      "derechos humanos",
      "ddhh",
      "garantias constitucionales",
      "derechos fundamentales"
    ],
    relatedTerms: [
      "Corte Interamericana de Derechos Humanos",
      "CoIDH",
      "Comisión Nacional de los Derechos Humanos",
      "CNDH",
      "reforma constitucional de derechos humanos",
      "pro persona",
      "control de convencionalidad",
      "tortura",
      "desaparición forzada",
      "discriminación",
      "igualdad de género",
      "debido proceso",
      "libre desarrollo de la personalidad",
      "derechos económicos sociales y culturales",
      "DESC"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  migratorio: {
    canonical: "derecho migratorio",
    materias: ["Administrativo", "Migratorio", "Internacional"],
    aliases: [
      "derecho migratorio",
      "migracion",
      "extranjeria",
      "estatus migratorio"
    ],
    relatedTerms: [
      "Ley de Migración",
      "INM",
      "Instituto Nacional de Migración",
      "visa",
      "residencia temporal",
      "residencia permanente",
      "estancia legal",
      "deportación",
      "estación migratoria",
      "refugiado",
      "asilo político",
      "COMAR",
      "repatriación",
      "regularización migratoria",
      "pasaporte"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  propiedad_intelectual: {
    canonical: "propiedad intelectual",
    materias: ["Mercantil", "Propiedad Intelectual", "Civil"],
    aliases: [
      "propiedad intelectual",
      "derechos de autor",
      "propiedad industrial",
      "marcas",
      "patentes"
    ],
    relatedTerms: [
      "LFPPI",
      "Ley Federal de Protección a la Propiedad Industrial",
      "Ley Federal del Derecho de Autor",
      "IMPI",
      "Instituto Mexicano de la Propiedad Industrial",
      "INDAUTOR",
      "patente",
      "marca registrada",
      "diseño industrial",
      "secreto industrial",
      "franquicia",
      "infracción en materia de comercio",
      "obra literaria",
      "software",
      "regalías",
      "licencia de uso",
      "piratería"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  consumidor: {
    canonical: "derecho del consumidor",
    materias: ["Civil", "Consumidor", "Mercantil"],
    aliases: [
      "derecho del consumidor",
      "proteccion al consumidor",
      "consumidores",
      "profeco"
    ],
    relatedTerms: [
      "Ley Federal de Protección al Consumidor",
      "PROFECO",
      "queja PROFECO",
      "contrato de adhesión",
      "garantía de producto",
      "publicidad engañosa",
      "derechos del consumidor",
      "conciliación",
      "reclamación",
      "cláusula abusiva",
      "devolución",
      "profeco telecomunicaciones"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  proteccion_datos: {
    canonical: "protección de datos personales",
    materias: ["Transparencia", "Protección de Datos", "Constitucional"],
    aliases: [
      "proteccion de datos",
      "datos personales",
      "privacidad",
      "aviso de privacidad"
    ],
    relatedTerms: [
      "LFPDPPP",
      "Ley Federal de Protección de Datos Personales en Posesión de los Particulares",
      "derechos ARCO",
      "acceso rectificación cancelación y oposición",
      "aviso de privacidad",
      "datos personales sensibles",
      "INAI",
      "transferencia de datos",
      "medidas de seguridad de la información",
      "consentimiento tácito",
      "consentimiento expreso",
      "vulneración de seguridad"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  embargo: {
    canonical: "embargo",
    materias: ["Civil", "Mercantil", "Fiscal", "Laboral", "Administrativo"],
    aliases: [
      "embargo",
      "embargos",
      "embargar",
      "bien embargado",
      "retención de bienes",
      "aseguramiento de bienes"
    ],
    relatedTerms: [
      "ejecución",
      "procedimiento de ejecución",
      "mandamiento de ejecución",
      "remate",
      "adjudicación",
      "crédito fiscal",
      "procedimiento administrativo de ejecución",
      "PAE",
      "garantía del interés fiscal",
      "medida cautelar",
      "providencia precautoria",
      "secuestro de bienes",
      "depositario",
      "bienes muebles",
      "bienes inmuebles",
      "cuentas bancarias",
      "salario",
      "deuda",
      "cobro coactivo"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  aduanal: {
    canonical: "materia aduanal",
    materias: ["Aduanal", "Fiscal", "Comercio exterior"],
    aliases: [
      "aduana",
      "aduanal",
      "aduanero",
      "ley aduanera",
      "materia aduanera",
      "despacho aduanero",
      "pedimento"
    ],
    relatedTerms: [
      "ANAM",
      "Agencia Nacional de Aduanas",
      "SAT comercio exterior",
      "arancel",
      "fracción arancelaria",
      "agente aduanal",
      "pedimento",
      "despacho aduanero",
      "recinto fiscalizado",
      "importación",
      "exportación",
      "Ley Aduanera",
      "T-MEC"
    ],
    negativeTerms: [],
    weight: 1.0
  },

  comercio_exterior: {
    canonical: "comercio exterior",
    materias: ["Comercio exterior", "Aduanal", "Financiero"],
    aliases: [
      "comercio exterior",
      "comercio internacional",
      "exportaciones",
      "importaciones"
    ],
    relatedTerms: [
      "T-MEC",
      "arancel",
      "fracción arancelaria",
      "reglas de origen",
      "ANAM",
      "SAT comercio exterior",
      "Secretaría de Economía",
      "dumping",
      "cuotas compensatorias",
      "importación",
      "exportación",
      "certificación de origen"
    ],
    negativeTerms: [],
    weight: 1.0
  }
};
