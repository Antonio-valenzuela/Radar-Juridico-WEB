export interface LegalSubcategory {
  id: string;
  name: string;
  description?: string;
}

export interface LegalMatter {
  id: string;
  name: string;
  icon?: string;
  subcategories: LegalSubcategory[];
}

export interface LegalDocumentType {
  id: string;
  matterId: string;
  subcategoryId?: string;
  name: string;
  description: string;
}

export const LEGAL_MATTERS_CATALOG: LegalMatter[] = [
  {
    id: 'laboral',
    name: 'Laboral',
    icon: '⚖️',
    subcategories: [
      { id: 'laboral_privado', name: 'Laboral Privado (LFT)' },
      { id: 'laboral_burocratico', name: 'Laboral Burocrático (LFTSE / Leyes Estatales)' },
      { id: 'seguridad_social', name: 'Seguridad Social (IMSS / ISSSTE / Pensiones)' }
    ]
  },
  {
    id: 'amparo',
    name: 'Amparo',
    icon: '📜',
    subcategories: [
      { id: 'amparo_indirecto', name: 'Amparo Indirecto' },
      { id: 'amparo_directo', name: 'Amparo Directo' },
      { id: 'amparo_directo_revision', name: 'Amparo Directo en Revisión (SCJN)' },
      { id: 'recurso_queja', name: 'Recurso de Queja' },
      { id: 'recurso_reclamacion', name: 'Recurso de Reclamación' },
      { id: 'incidente_suspension', name: 'Incidente de Suspensión' }
    ]
  },
  {
    id: 'civil',
    name: 'Civil',
    icon: '🏛️',
    subcategories: [
      { id: 'civil_ordinario', name: 'Juicio Ordinario Civil' },
      { id: 'civil_ejecutivo', name: 'Juicio Ejecutivo Civil' },
      { id: 'hipotecario', name: 'Juicio Hipotecario' }
    ]
  },
  {
    id: 'mercantil',
    name: 'Mercantil',
    icon: '💼',
    subcategories: [
      { id: 'mercantil_ejecutivo', name: 'Ejecutivo Mercantil' },
      { id: 'mercantil_oral', name: 'Oral Mercantil' },
      { id: 'concursos_mercantiles', name: 'Concursos Mercantiles' }
    ]
  },
  {
    id: 'familiar',
    name: 'Familiar',
    icon: '👨‍👩‍👧',
    subcategories: [
      { id: 'divorcio', name: 'Divorcio (Incausado / Voluntario)' },
      { id: 'alimentos', name: 'Alimentos y Custodia' },
      { id: 'sucesorio', name: 'Juicio Sucesorio (Testamentario / Intestado)' }
    ]
  },
  {
    id: 'penal',
    name: 'Penal',
    icon: '🛡️',
    subcategories: [
      { id: 'sistema_acusatorio', name: 'Sistema Penal Acusatorio (CNPP)' },
      { id: 'ejecucion_penas', name: 'Ejecución de Penas' }
    ]
  },
  {
    id: 'constitucional',
    name: 'Constitucional',
    icon: '🏛️',
    subcategories: [
      { id: 'controversia_const', name: 'Controversia Constitucional' },
      { id: 'accion_inconstitucionalidad', name: 'Acción de Inconstitucionalidad' }
    ]
  },
  {
    id: 'administrativo',
    name: 'Administrativo',
    icon: '📄',
    subcategories: [
      { id: 'juicio_nulidad', name: 'Juicio de Nulidad (TFJA / TJAS)' },
      { id: 'recurso_revocacion', name: 'Recurso de Revocación Administrativo' }
    ]
  },
  {
    id: 'fiscal',
    name: 'Fiscal',
    icon: '📊',
    subcategories: [
      { id: 'defensa_fiscal', name: 'Defensa Fiscal (Créditos Fiscales / ISR / IVA)' },
      { id: 'prodecon', name: 'Procedimiento PRODECON' }
    ]
  },
  {
    id: 'seguridad_social',
    name: 'Seguridad Social',
    icon: '🏥',
    subcategories: [
      { id: 'pensiones_imss', name: 'Pensiones y Negativas IMSS' },
      { id: 'pensiones_issste', name: 'Pensiones ISSSTE' }
    ]
  },
  {
    id: 'agrario',
    name: 'Agrario',
    icon: '🌾',
    subcategories: [
      { id: 'tribunal_agrario', name: 'Juicio Agrario (TUA / TNA)' }
    ]
  },
  {
    id: 'electoral',
    name: 'Electoral',
    icon: '🗳️',
    subcategories: [
      { id: 'jdc', name: 'Juicio de Derechos Político-Electorales (JDC)' }
    ]
  },
  {
    id: 'corporativo',
    name: 'Corporativo',
    icon: '🏢',
    subcategories: [
      { id: 'contratos_mercantiles', name: 'Contratos y Actas de Asamblea' }
    ]
  },
  {
    id: 'propiedad_intelectual',
    name: 'Propiedad Intelectual',
    icon: '💡',
    subcategories: [
      { id: 'impi', name: 'Marcas y Patentes (IMPI)' },
      { id: 'indautor', name: 'Derechos de Autor (INDAUTOR)' }
    ]
  },
  {
    id: 'inmobiliario',
    name: 'Inmobiliario',
    icon: '🏡',
    subcategories: [
      { id: 'arrendamiento', name: 'Juicio de Arrendamiento Inmobiliario' }
    ]
  },
  {
    id: 'procesal',
    name: 'Procesal General',
    icon: '📁',
    subcategories: [
      { id: 'promociones_diversas', name: 'Promociones y Peticiones Procesales' }
    ]
  },
  {
    id: 'derechos_humanos',
    name: 'Derechos Humanos',
    icon: '🕊️',
    subcategories: [
      { id: 'cndh', name: 'Quejas CNDH y Sistema Interamericano' }
    ]
  },
  {
    id: 'migratorio',
    name: 'Migratorio',
    icon: '✈️',
    subcategories: [
      { id: 'inami', name: 'Procedimientos INAMI y Visas' }
    ]
  },
  {
    id: 'ambiental',
    name: 'Ambiental',
    icon: '🌱',
    subcategories: [
      { id: 'profepa', name: 'Procedimientos PROFEPA y SEMARNAT' }
    ]
  },
  {
    id: 'aduanero',
    name: 'Aduanero',
    icon: '📦',
    subcategories: [
      { id: 'pama', name: 'Procedimiento PAMA y Comercio Exterior' }
    ]
  },
  {
    id: 'contratacion_publica',
    name: 'Contratación Pública',
    icon: '📜',
    subcategories: [
      { id: 'inconformidad_licitacion', name: 'Inconformidad en Licitaciones' }
    ]
  },
  {
    id: 'responsabilidad_patrimonial',
    name: 'Responsabilidad Patrimonial',
    icon: '🏛️',
    subcategories: [
      { id: 'patrimonial_estado', name: 'Reclamación de Responsabilidad Patrimonial del Estado' }
    ]
  },
  {
    id: 'transparencia',
    name: 'Transparencia y ARCO',
    icon: '🔒',
    subcategories: [
      { id: 'inai', name: 'Recurso de Revisión INAI / Datos Personales' }
    ]
  },
  {
    id: 'notarial',
    name: 'Notarial',
    icon: '✒️',
    subcategories: [
      { id: 'escrituracion', name: 'Jurisdicción Voluntaria y Escrituración' }
    ]
  },
  {
    id: 'otro',
    name: 'Otro',
    icon: '📌',
    subcategories: [
      { id: 'escrito_libre_general', name: 'Escrito Libre / Promoción General' }
    ]
  }
];

export function getLegalMatterById(id: string): LegalMatter {
  return LEGAL_MATTERS_CATALOG.find((m) => m.id === id) || LEGAL_MATTERS_CATALOG[LEGAL_MATTERS_CATALOG.length - 1];
}

export function getAllLegalSubcategories(): Array<{ matterId: string; subcategory: LegalSubcategory }> {
  return LEGAL_MATTERS_CATALOG.flatMap((matter) =>
    matter.subcategories.map((subcategory) => ({ matterId: matter.id, subcategory }))
  );
}
