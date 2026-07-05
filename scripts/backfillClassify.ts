import { PrismaClient } from "@prisma/client";
import { classifyItem } from "../lib/classifier";

const prisma = new PrismaClient();

async function main() {
  console.log("Buscando items sin clasificar...");

  const items = await prisma.item.findMany({
    where: { impacto: null },
  });

  console.log(`Encontrados ${items.length} items para clasificar`);

  let processed = 0;

  for (const item of items) {
    const { impacto, tipo, tema, keywordsHit } = classifyItem(item.title, item.summary ?? "");

    await prisma.item.update({
      where: { id: item.id },
      data: {
        impacto,
        tipo,
        tema,
        keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
      },
    });

    processed++;
    if (processed % 10 === 0) {
      console.log(`Procesados ${processed}/${items.length}`);
    }
  }

  console.log(`Backfill completado: ${processed} items clasificados`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
