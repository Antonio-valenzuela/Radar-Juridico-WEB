import { PrismaClient } from '@prisma/client';
import { CURRENT_LEGAL_LAWS } from '../lib/legalOperations';

const prisma = new PrismaClient();

async function main() {
  console.log('Registrando catálogo inicial como pendiente de verificación...');
  for (const law of CURRENT_LEGAL_LAWS) {
    await prisma.norma.upsert({
      where: {
        fuente_nombre: {
          fuente: law.sourceName,
          nombre: law.officialName,
        },
      },
      update: {
        sigla: law.title,
        urlBase: law.officialUrl,
        jurisdiction: law.jurisdiction,
        matter: law.matter,
        practicalUse: law.practicalUse,
      },
      create: {
        nombre: law.officialName,
        sigla: law.title,
        fuente: law.sourceName,
        urlBase: law.officialUrl,
        jurisdiction: law.jurisdiction,
        matter: law.matter,
        practicalUse: law.practicalUse,
        verificationStatus: 'pending',
        monitoringStatus: 'pending',
      },
    });
    console.log(`Registrada como pendiente: ${law.title}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
