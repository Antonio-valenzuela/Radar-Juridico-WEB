import { resolveSourceAdapter } from "@/lib/sources/sourceHealth";

type IngestSourceConfig = {
  adapter?: string | null;
  slug?: string | null;
  type?: string | null;
  requiresBrowser?: boolean;
};

export type IngestPolicy =
  | { handler: "registry"; registryKey: "SIDOF" | "DIPUTADOS" | "SCJN_SJF" | "SCJN_LEG" }
  | { handler: "dof-web" }
  | { handler: "warning"; warningCode: "BROWSER_REQUIRED" | "BLOCKED_BY_PROVIDER"; message: string }
  | { handler: "legacy" };

export function resolveIngestPolicy(source: IngestSourceConfig): IngestPolicy {
  const adapter = resolveSourceAdapter(source);

  if (adapter === "SIDOF") return { handler: "registry", registryKey: "SIDOF" };
  if (adapter === "DIPUTADOS") return { handler: "registry", registryKey: "DIPUTADOS" };
  if (adapter === "DOF") return { handler: "dof-web" };

  if (adapter === "SJF" && source.requiresBrowser) {
    return {
      handler: "warning",
      warningCode: "BROWSER_REQUIRED",
      message: "SCJN SJF requiere navegador/Playwright; se omitió la ingesta HTML simple.",
    };
  }

  if (adapter === "SCJN_LEG" && source.requiresBrowser) {
    return {
      handler: "warning",
      warningCode: "BLOCKED_BY_PROVIDER",
      message: "SCJN Legislación está bloqueada por el proveedor para fetch simple; requiere navegador/Playwright.",
    };
  }

  if (adapter === "SJF") return { handler: "registry", registryKey: "SCJN_SJF" };
  if (adapter === "SCJN_LEG") return { handler: "registry", registryKey: "SCJN_LEG" };
  return { handler: "legacy" };
}
