import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Cleanup: remove the incorrectly-configured dof_jalisco record
  await prisma.officialSourceFetchLog.deleteMany({
    where: { source: { slug: 'dof_jalisco' } }
  });
  await prisma.officialSource.deleteMany({
    where: { slug: 'dof_jalisco' }
  });

  const sources = [
    {
      name: "Diario Oficial de la Federación (SIDOF)",
      slug: "SIDOF",
      baseUrl: "https://sidof.segob.gob.mx",
      healthUrl: "https://sidof.segob.gob.mx/apiStatus",
      adapter: "SIDOF",
      requiresBrowser: false,
      type: "sidof",
      jurisdiction: "Federal",
      country: "MX",
      description: "Ediciones matutinas, vespertinas y extraordinarias del DOF a través del API oficial de SIDOF.",
      isActive: true,
      isOfficial: true,
      trustLevel: "official",
      crawlMode: "api",
      refreshFrequency: "daily",
    },
    {
      name: "Cámara de Diputados - Leyes Federales",
      slug: "DIPUTADOS",
      baseUrl: "https://www.diputados.gob.mx",
      healthUrl: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
      adapter: "DIPUTADOS",
      requiresBrowser: false,
      type: "diputados",
      jurisdiction: "Federal",
      country: "MX",
      description: "Portal oficial de la Cámara de Diputados de México que contiene el compendio actualizado de leyes federales vigentes.",
      isActive: true,
      isOfficial: true,
      trustLevel: "official",
      crawlMode: "html",
      refreshFrequency: "weekly",
    },
    {
      name: "SCJN - Semanario Judicial de la Federación",
      slug: "SCJN_SJF",
      baseUrl: "https://sjf2.scjn.gob.mx",
      healthUrl: "https://sjf2.scjn.gob.mx/",
      adapter: "SJF",
      requiresBrowser: true,
      type: "sjf",
      jurisdiction: "Federal",
      country: "MX",
      description: "Tesis, jurisprudencias y sentencias del Semanario Judicial de la Federación (SCJN).",
      isActive: true,
      isOfficial: true,
      trustLevel: "official",
      crawlMode: "api",
      refreshFrequency: "daily",
    },
    {
      name: "SCJN - Legislación de la Suprema Corte",
      slug: "SCJN_LEG",
      baseUrl: "https://legislacion.scjn.gob.mx",
      healthUrl: "https://legislacion.scjn.gob.mx/buscador/paginas/buscar.aspx",
      adapter: "SCJN_LEG",
      requiresBrowser: true,
      type: "scjn",
      jurisdiction: "Federal",
      country: "MX",
      description: "Compendio legal, reformas y normativas integradas en el portal de legislación de la Suprema Corte.",
      isActive: true,
      isOfficial: true,
      trustLevel: "official",
      crawlMode: "api",
      refreshFrequency: "weekly",
    },
    {
      name: "Diario Oficial de la Federación (Web)",
      slug: "DOF_WEB",
      baseUrl: "https://www.dof.gob.mx",
      healthUrl: "https://www.dof.gob.mx",
      adapter: "DOF",
      requiresBrowser: false,
      type: "dof",
      jurisdiction: "Federal",
      country: "MX",
      description: "Página web principal del Diario Oficial de la Federación (DOF) para crawling HTML alternativo.",
      isActive: true,
      isOfficial: true,
      trustLevel: "official",
      crawlMode: "html",
      refreshFrequency: "daily",
    },
    {
      name: "Periódico Oficial del Estado de Jalisco",
      slug: "jalisco_gazette",
      baseUrl: "https://periodicooficial.jalisco.gob.mx",
      type: "state_gazette",
      jurisdiction: "State",
      country: "MX",
      state: "Jalisco",
      description: "Periódico oficial del Estado de Jalisco para publicaciones estatales.",
      isActive: true,
      isOfficial: true,
      trustLevel: "official",
      crawlMode: "search_only",
      refreshFrequency: "weekly",
    }
  ];

  console.log("Seeding official sources...");

  for (const src of sources) {
    const existing = await prisma.officialSource.findFirst({
      where: { slug: { equals: src.slug, mode: "insensitive" } },
    });

    if (existing) {
      await prisma.officialSource.update({ where: { id: existing.id }, data: src });
    } else {
      await prisma.officialSource.create({ data: src });
    }
  }

  console.log("Seeding complete! 6 official sources registered.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
