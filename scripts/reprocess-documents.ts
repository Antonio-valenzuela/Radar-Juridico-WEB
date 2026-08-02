import { prisma } from "../lib/prisma";
import { filterNoise, resolveTaxonomy } from "../lib/ingest/normalize";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || !args.includes("--apply");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 100;
  const sourceArg = args.find((a) => a.startsWith("--source="));
  const source = sourceArg ? sourceArg.split("=")[1] : undefined;

  console.log(`[Reprocess] Starting document reprocessing (dryRun=${dryRun}, limit=${limit}, source=${source || "all"})...`);

  const items = await prisma.item.findMany({
    where: source ? { source } : undefined,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  console.log(`[Reprocess] Found ${items.length} items to inspect.`);

  let updatedCount = 0;
  let reclassifiedCount = 0;

  for (const item of items) {
    const cleanedTitle = filterNoise(item.title);
    const cleanedSummary = item.summary ? filterNoise(item.summary) : null;
    const proposedTipo = resolveTaxonomy(item.tipo, false, cleanedTitle);

    const titleChanged = cleanedTitle !== item.title;
    const summaryChanged = cleanedSummary !== item.summary;
    const tipoChanged = proposedTipo !== item.tipo;

    if (titleChanged || summaryChanged || tipoChanged) {
      console.log(`\nItem ID: ${item.id} (${item.source})`);
      if (titleChanged) console.log(`  Title: "${item.title}" -> "${cleanedTitle}"`);
      if (tipoChanged) {
        console.log(`  Tipo: "${item.tipo || "N/A"}" -> "${proposedTipo}"`);
        reclassifiedCount++;
      }

      if (!dryRun) {
        await prisma.item.update({
          where: { id: item.id },
          data: {
            title: cleanedTitle,
            summary: cleanedSummary,
            tipo: proposedTipo,
          },
        });
        updatedCount++;
      }
    }
  }

  console.log(`\n[Reprocess] Complete. Items inspected: ${items.length}, Reclassified: ${reclassifiedCount}, Updated DB: ${dryRun ? 0 : updatedCount} (dryRun=${dryRun}).`);
}

main().catch((err) => {
  console.error("[Reprocess] Error:", err);
  process.exit(1);
});
