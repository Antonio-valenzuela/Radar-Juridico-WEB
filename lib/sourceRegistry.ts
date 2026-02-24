/**
 * Source Registry — centralized config for all legal data sources.
 * Each source has a name, parser function reference, and enabled flag.
 */

export interface SourceConfig {
    name: string;
    label: string;
    baseUrl: string;
    description: string;
    enabled: boolean;
    /** Parser identifier used by /api/ingest/run to dispatch */
    parserId: "SIDOF" | "DOF" | "SCJN";
}

export const SOURCE_REGISTRY: SourceConfig[] = [
    {
        name: "SIDOF",
        label: "DOF vía SIDOF",
        baseUrl: "https://sidof.segob.gob.mx/dof/sidof",
        description:
            "Diario Oficial de la Federación — API JSON de SEGOB. Fuente primaria más estable.",
        enabled: true,
        parserId: "SIDOF",
    },
    {
        name: "DOF",
        label: "DOF Web (dof.gob.mx)",
        baseUrl: "https://www.dof.gob.mx",
        description:
            "Scraping HTML del sitio web oficial del DOF. Puede bloquear bots.",
        enabled: true,
        parserId: "DOF",
    },
    {
        name: "SCJN",
        label: "SCJN Comunicados",
        baseUrl: "https://www.internet2.scjn.gob.mx/red2/comunicados",
        description:
            "Suprema Corte de Justicia — comunicados por iteración de IDs.",
        enabled: true,
        parserId: "SCJN",
    },
];

export function getEnabledSources(): SourceConfig[] {
    return SOURCE_REGISTRY.filter((s) => s.enabled);
}

export function getSourceByName(name: string): SourceConfig | undefined {
    return SOURCE_REGISTRY.find(
        (s) => s.name.toUpperCase() === name.toUpperCase()
    );
}
