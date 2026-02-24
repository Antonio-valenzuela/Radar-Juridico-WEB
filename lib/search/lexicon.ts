/**
 * Diccionario de conceptos jurídicos para expansión de búsqueda y sugerencias.
 */
export const SEARCH_LEXICON: Record<string, string[]> = {
    amparo: [
        "amparo directo",
        "amparo indirecto",
        "juicio de amparo",
        "suspensión",
        "acto reclamado",
        "autoridad responsable",
        "quejoso",
        "tercer interesado",
        "amparo soberanía",
        "amparo legalidad"
    ],
    jurisprudencia: [
        "tesis",
        "precedente",
        "criterio",
        "Semanario Judicial",
        "registro digital",
        "contradicción de criterios",
        "tesis aislada",
        "jurisprudencia obligatoria",
        "unificación de criterios",
        "SJF",
        "gaceta",
        "pleno",
        "sala"
    ],
    penal: [
        "delito",
        "sentencia",
        "vinculación a proceso",
        "medida cautelar",
        "prisión preventiva",
        "código nacional",
        "fiscalía",
        "petición punitiva",
        "presunción de inocencia"
    ],
    civil: [
        "contrato",
        "demanda",
        "propiedad",
        "arrendamiento",
        "daños y perjuicios",
        "persona moral",
        "persona física",
        "sucesión",
        "divorcio",
        "responsabilidad civil"
    ],
    fiscal: [
        "SAT",
        "impuesto",
        "IVA",
        "ISR",
        "contribuyente",
        "crédito fiscal",
        "facultades de comprobación",
        "revisión de gabinete",
        "tributario"
    ],
    constitucional: [
        "constitución",
        "derechos humanos",
        "garantías",
        "soberanía",
        "supremacía constitucional",
        "tratados internacionales",
        "recurso de revisión"
    ],
    laboral: [
        "trabajador",
        "patrón",
        "despido",
        "indemnización",
        "conciliación",
        "tribunal laboral",
        "sindicato",
        "contrato colectivo",
        "salario caídos"
    ],
    administrativo: [
        "procedimiento administrativo",
        "licitación",
        "concesión",
        "acto administrativo",
        "nulidad",
        "responsabilidad administrativa",
        "servidor público"
    ]
};

/**
 * Expande una palabra o frase corta usando el lexicón.
 */
export function expandQuery(query: string): string[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const results = new Set<string>();
    results.add(q);

    for (const [key, synonyms] of Object.entries(SEARCH_LEXICON)) {
        // Si la query incluye la clave o viceversa
        if (q.includes(key) || key.includes(q)) {
            synonyms.forEach(s => results.add(s));
        }
        // También buscar si la query está en alguno de los sinónimos
        for (const s of synonyms) {
            if (s.toLowerCase().includes(q)) {
                results.add(key); // Si busco "acto reclamado", añado "amparo"
                synonyms.forEach(sys => results.add(sys));
            }
        }
    }

    return Array.from(results);
}
