import { PrismaClient } from "@prisma/client";
import { classifyItem } from "../lib/classifier";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando items sin clasificar...");

  const itemsToClassify = await prisma.item.findMany({
    where: {
      impacto: null,
    },
  });

  console.log(`📦 Encontrados ${itemsToClassify.length} items para clasificar`);

  let processed = 0;

  for (const item of itemsToClassify) {
    const classification = classifyItem(item.title, item.summary ?? "");

    await prisma.item.update({
      where: { id: item.id },
      data: {
        impacto: classification.impacto,
        tipo: classification.tipo,
        tema: classification.tema,
      },
    });

    processed++;

    if (processed % 10 === 0) {
      console.log(`✅ Procesados ${processed}/${itemsToClassify.length}`);
    }
  }

  console.log(`🎉 Backfill completado: ${processed} items clasificados`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
