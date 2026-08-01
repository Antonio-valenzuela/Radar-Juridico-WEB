import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const isDryRun = !process.argv.includes("--execute");
  console.log(`Starting quarantine script for SENADO_WEB documents... [Dry Run: ${isDryRun}]`);

  const contaminatedItems = await prisma.item.findMany({
    where: {
      source: "SENADO_WEB",
      url: {
        contains: "diputados.gob.mx",
      },
    },
  });

  const contaminatedDocuments = await prisma.document.findMany({
    where: {
      source: "SENADO_WEB",
      canonicalUrl: {
        contains: "diputados.gob.mx",
      },
    },
  });

  console.log(`Found ${contaminatedItems.length} contaminated Items.`);
  console.log(`Found ${contaminatedDocuments.length} contaminated Documents.`);

  if (isDryRun) {
    console.log("Run with --execute to apply changes.");
    for (const doc of contaminatedDocuments) {
      console.log(`- [Dry-Run] Would quarantine document: ${doc.id} - ${doc.canonicalUrl}`);
    }
    for (const item of contaminatedItems) {
      console.log(`- [Dry-Run] Would quarantine item: ${item.id} - ${item.url}`);
    }
  } else {
    let quarantinedDocs = 0;
    for (const doc of contaminatedDocuments) {
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: "QUARANTINED", // or REVIEW_REQUIRED based on instruction
          monitoringStatus: "REVIEW_REQUIRED",
        },
      });
      quarantinedDocs++;
    }

    let quarantinedItems = 0;
    for (const item of contaminatedItems) {
      const rawObj = item.raw ? (typeof item.raw === 'object' ? item.raw : JSON.parse(item.raw as string)) : {};
      await prisma.item.update({
        where: { id: item.id },
        data: {
          category: "quarantined",
          raw: {
            ...rawObj,
            indexingStatus: "failed",
            quality: { status: "noise", reasons: ["Domain mismatch (diputados.gob.mx)"] }
          }
        },
      });
      quarantinedItems++;
    }

    console.log(`Quarantined ${quarantinedDocs} documents and ${quarantinedItems} items.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
