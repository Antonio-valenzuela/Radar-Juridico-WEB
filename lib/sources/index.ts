import type { SourceModule, SourceName } from "@/lib/sources/types";
import { sidofSource } from "@/lib/sources/sidof";
import { diputadosSource } from "@/lib/sources/diputados";
import { scjnSjfSource } from "@/lib/sources/scjn_sjf";
import { scjnLegislacionSource } from "@/lib/sources/scjn_legislacion";

export const sourceRegistry: Record<SourceName, SourceModule> = {
  SIDOF: sidofSource,
  DIPUTADOS: diputadosSource,
  SCJN_SJF: scjnSjfSource,
  SCJN_LEG: scjnLegislacionSource,
  SENADO_GACETA: {
    name: "SENADO_GACETA",
    priority: 2,
    async fetchItems() {
      return {
        source: "SENADO_GACETA",
        ok: true,
        found: 0,
        items: [],
        errors: ["Fuente prioridad 2 no habilitada: requiere selector estable para reducir ruido."],
      };
    },
  },
};

export function parseSources(value?: string | null, includePriority2 = false): SourceName[] {
  if (value) {
    return value
      .split(",")
      .map((s) => s.trim().toUpperCase().replace(/-/g, "_"))
      .filter((s): s is SourceName => s in sourceRegistry);
  }

  return Object.values(sourceRegistry)
    .filter((source) => includePriority2 || source.priority === 1)
    .map((source) => source.name);
}
