import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sources = await prisma.officialSource.findMany({
    orderBy: { createdAt: "desc" }
  });
  console.log(JSON.stringify(sources, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
