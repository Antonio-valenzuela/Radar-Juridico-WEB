import {
  runLegalDocumentMonitor,
  serializeMonitorResult,
  type LegalDocumentMonitorSummary,
  type MonitorResultStatus,
} from "../lib/monitoring/legalDocumentMonitor";

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run"),
    useCatalogWhenEmpty: !argv.includes("--no-catalog-fallback"),
  };
}

function statusLabel(status: MonitorResultStatus) {
  switch (status) {
    case "baseline":
      return "linea base";
    case "unchanged":
      return "sin cambios";
    case "changed":
      return "cambio detectado";
    case "blocked":
      return "bloqueado";
    case "error":
      return "error";
  }
}

function printSummary(summary: LegalDocumentMonitorSummary) {
  console.log(summary.dryRun ? "Modo prueba: no se escribio nada en base de datos." : "Modo escritura: resultados guardados.");
  console.log(`Documentos revisados: ${summary.reviewed}`);
  console.log(`Sin cambios: ${summary.unchanged}`);
  console.log(`Lineas base pendientes: ${summary.baselines}`);
  console.log(`Cambios detectados: ${summary.changed}`);
  console.log(`Errores: ${summary.errors}`);
  console.log(`Bloqueados: ${summary.blocked}`);

  for (const result of summary.results) {
    const serialized = serializeMonitorResult(result);
    const size = serialized.fileSize ? `${serialized.fileSize} bytes` : "tamano no informado";
    const date = serialized.lastModified ? `ultima modificacion ${serialized.lastModified}` : "sin fecha de modificacion";

    console.log(
      `- ${statusLabel(result.status)} | ${result.shortCode || "sin clave"} | ${result.title} | ${size} | ${date} | ${result.message}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const summary = await runLegalDocumentMonitor({
    dryRun: args.dryRun,
    useCatalogWhenEmpty: args.useCatalogWhenEmpty,
  });

  printSummary(summary);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "No fue posible ejecutar el monitor de documentos legales.";
  console.error(message);
  process.exitCode = 1;
});
