/**
 * Task Taxonomy for Juridico Radar
 * Maps legal tasks to matters, keywords, entities and sectors.
 * 
 * Valid matters: fiscal | laboral | salud | ambiental | energia | financiero |
 *                administrativo | comercio_exterior | proteccion_datos | otro
 */

export type TaskDefinition = {
  id: string;
  label: string;
  description: string;
  matter: string;
  keywords: string[];
  entities: string[];
  sectors: string[];
};

export const TASK_TAXONOMY: TaskDefinition[] = [
  {
    id: "cumplimiento-fiscal",
    label: "Cumplimiento fiscal",
    description: "Resoluciones y obligaciones relacionadas con el pago de impuestos y contribuciones.",
    matter: "fiscal",
    entities: ["SAT", "SHCP"],
    sectors: ["empresas", "contribuyentes"],
    keywords: ["ISR", "IVA", "obligaciones fiscales", "RMF", "miscelánea", "CFDI", "RFC"]
  },
  {
    id: "nomina-laboral",
    label: "Nómina y laboral",
    description: "Obligaciones patronales, salario mínimo y seguridad social.",
    matter: "laboral",
    entities: ["IMSS", "INFONAVIT", "STPS", "CONASAMI"],
    sectors: ["recursos humanos", "empleadores"],
    keywords: ["salario", "seguridad social", "cuotas", "vacaciones", "PTU", "nómina"]
  },
  {
    id: "salud-regulatoria",
    label: "Salud y regulación sanitaria",
    description: "Normas de etiquetado, avisos sanitarios y regulación de medicamentos/alimentos.",
    matter: "salud",
    entities: ["COFEPRIS", "Secretaría de Salud"],
    sectors: ["farmacéutico", "alimentos", "hospitales"],
    keywords: ["NOM", "etiquetado", "sanitario", "registro", "insumos", "COFEPRIS"]
  },
  {
    id: "energia",
    label: "Energía y regulación eléctrica",
    description: "Regulaciones de la industria eléctrica y de hidrocarburos.",
    matter: "energia",
    entities: ["CRE", "CENACE", "SENER", "PEMEX", "CFE"],
    sectors: ["energía", "petrolero", "eléctrico"],
    keywords: ["tarifas", "permisos", "hidrocarburos", "mercado eléctrico", "gasolina"]
  },
  {
    id: "ambiental",
    label: "Medio ambiente y sustentabilidad",
    description: "Normas ambientales, impacto ambiental y cambio climático.",
    matter: "ambiental",
    entities: ["SEMARNAT", "PROFEPA", "CONAGUA"],
    sectors: ["industria", "minería", "construcción"],
    keywords: ["impacto ambiental", "emisiones", "residuos", "agua", "NOM ambiental"]
  },
  {
    id: "financiero",
    label: "Regulación financiera",
    description: "Normas del sistema financiero, bancario y bursátil.",
    matter: "financiero",
    entities: ["CNBV", "BANXICO", "CONDUSEF", "CONSAR"],
    sectors: ["bancos", "seguros", "fintech"],
    keywords: ["crédito", "tasas", "regulación bancaria", "lavado de dinero", "fintech"]
  },
  {
    id: "proteccion-datos",
    label: "Protección de datos personales",
    description: "Obligaciones sobre tratamiento de datos personales.",
    matter: "proteccion_datos",
    entities: ["INAI"],
    sectors: ["tecnología", "comercio", "todas"],
    keywords: ["datos personales", "ARCO", "privacidad", "aviso de privacidad", "INAI"]
  },
  {
    id: "comercio-exterior",
    label: "Comercio exterior y aduanas",
    description: "Regulaciones de importación, exportación, aranceles y aduanas.",
    matter: "comercio_exterior",
    entities: ["SAT", "SE", "ANAM"],
    sectors: ["importadores", "exportadores", "maquiladoras"],
    keywords: ["arancel", "importación", "exportación", "aduana", "TMEC", "comercio exterior"]
  }
];

export const VALID_MATTERS = [
  "fiscal", "laboral", "salud", "ambiental", "energia",
  "financiero", "administrativo", "comercio_exterior",
  "proteccion_datos", "otro"
];

export function getTaskById(taskId: string): TaskDefinition | undefined {
  return TASK_TAXONOMY.find(t => t.id === taskId);
}

export function getTasksByMatter(matter: string): TaskDefinition[] {
  return TASK_TAXONOMY.filter(t => t.matter === matter);
}
