import { prisma } from "../lib/prisma";
import { assessDiputadosTitle } from "../lib/sources/diputados";
import { runSourceIngest } from "../lib/ingest/runIngest";

const args = new Set(process.argv.slice(2));
const reprocess = args.has("--reprocess");
const markQuarantined = args.has("--quarantine");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Math.min(200, Number(limitArg?.split("=")[1] || 100)));
const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const days = Math.max(1, Math.min(60, Number(daysArg?.split("=")[1] || 30)));

async function main() {
  const items = await prisma.item.findMany({
    where: { source: "DIPUTADOS" },
    orderBy: { retrievedAt: "desc" },
    take: limit,
    select: { id: true, source: true, title: true, url: true, published: true, raw: true },
  });

  const suspects = items
    .map((item) => ({
      ...item,
      assessment: assessDiputadosTitle(item.title, item.url.split("/").pop() || ""),
    }))
    .filter((item) => item.assessment.status === "suspicious");

  console.log(JSON.stringify({
    mode: reprocess ? "reprocess" : "inspect",
    source: "DIPUTADOS",
    scanned: items.length,
    suspicious: suspects.length,
    items: suspects.map((item) => ({
      id: item.id,
      source: item.source,
      title: item.title,
      url: item.url,
      published: item.published.toISOString(),
      reasons: item.assessment.reasons,
    })),
  }, null, 2));

  if (markQuarantined) {
    for (const item of suspects) {
      const raw = item.raw && typeof item.raw === "object" && !Array.isArray(item.raw) ? item.raw as Record<string, unknown> : {};
      await prisma.item.update({ where: { id: item.id }, data: { raw: { ...raw, qualityStatus: "quarantined", qualityReasons: item.assessment.reasons } } });
    }
    console.log(`Marcados como quarantined: ${suspects.length}. No se eliminó ningún registro.`);
  }

  if (!reprocess) {
    console.log("Modo inspección: no se modificó ningún registro. Usa --quarantine para marcar sospechosos o --reprocess para volver a ejecutar el adaptador.");
    return;
  }

  // Reprocesar sólo vuelve a ejecutar el adaptador y actualiza por URL/hash;
  // nunca elimina Items ni registros de cuarentena.
  const result = await runSourceIngest("DIPUTADOS", { days, limit });
  console.log(JSON.stringify({ reprocessResult: result }, null, 2));
}

main()
  .catch((error) => {
    console.error("[inspect-diputados-quality] failed", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
