import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allItems = await prisma.item.findMany({
    select: { id: true, title: true, tema: true },
  });

  const total = allItems.length;
  const emptyOrGeneral = allItems.filter(
    (i) => !i.tema || i.tema.length === 0 || (i.tema.length === 1 && i.tema[0] === "general")
  ).length;

  const multiTemaItems = allItems.filter((i) => i.tema && i.tema.length > 1);
  const familiarItems = allItems.filter((i) => i.tema && i.tema.includes("familiar"));

  console.log("=== ESTADÍSTICAS REALES DE LA BASE DE DATOS RECLASIFICADA ===");
  console.log(`Total de Items procesados: ${total}`);
  console.log(`Items con tema vacío/general: ${emptyOrGeneral}`);
  console.log(`Items con múltiples temas (multi-materia): ${multiTemaItems.length}`);
  console.log(`Items clasificados con la nueva materia 'familiar': ${familiarItems.length}`);
  console.log("\n=== EJEMPLOS REALES DE ITEMS RECLASIFICADOS EN BD ===");

  const sampleFamiliar = familiarItems.slice(0, 5);
  sampleFamiliar.forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.tema.join(", ")}] — "${item.title.slice(0, 100)}"`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
