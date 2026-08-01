import { PrismaClient } from "@prisma/client";
import { classifyItem } from "../lib/classifier";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando reclasificación masiva de todos los Items existentes en la BD...");

  const items = await prisma.item.findMany({
    select: { id: true, title: true, summary: true, tema: true },
  });

  console.log(`Se encontraron ${items.length} items para procesar con la nueva lógica multi-tema.`);

  let updatedCount = 0;

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

    updatedCount++;
    if (updatedCount % 25 === 0 || updatedCount === items.length) {
      console.log(`[Reclasificación] Procesados ${updatedCount}/${items.length} items`);
    }
  }

  console.log(`✅ Reclasificación masiva completada exitosamente. Total items actualizados: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error("Error durante la reclasificación:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
