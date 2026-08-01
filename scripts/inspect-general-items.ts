import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const generalItems = await prisma.item.findMany({
    where: {
      OR: [
        { tema: { equals: ["general"] } },
        { tema: { isEmpty: true } },
      ],
    },
    take: 10,
    select: { title: true, tipo: true, summary: true },
  });

  console.log("=== 10 MUESTRAS REALES DE ITEMS CON TEMA 'GENERAL' ===");
  generalItems.forEach((item, index) => {
    console.log(`\n${index + 1}. [${item.tipo || "SIN_TIPO"}] "${item.title}"`);
    if (item.summary) {
      console.log(`   Resumen: ${item.summary.slice(0, 150)}...`);
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
