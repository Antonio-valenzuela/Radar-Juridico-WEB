const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seed() {
    console.log("Seeding sources...");
    try {
        const sidof = await prisma.source.upsert({
            where: { url: "https://sidof.segob.gob.mx/dof/sidof" },
            update: {
                nombre: "Diario Oficial (SIDOF)",
                tipo: "federal",
                metodo_extraccion: "api",
                activo: true,
            },
            create: {
                nombre: "Diario Oficial (SIDOF)",
                url: "https://sidof.segob.gob.mx/dof/sidof",
                tipo: "federal",
                metodo_extraccion: "api",
                activo: true,
                frecuencia_minutos: 60,
            },
        });
        console.log("Seeded:", sidof.nombre);

        const scjn = await prisma.source.upsert({
            where: { url: "https://www.scjn.gob.mx/comunicados" },
            update: {
                nombre: "SCJN Comunicados",
                tipo: "tribunal",
                metodo_extraccion: "html",
                activo: true,
            },
            create: {
                nombre: "SCJN Comunicados",
                url: "https://www.scjn.gob.mx/comunicados",
                tipo: "tribunal",
                metodo_extraccion: "html",
                activo: true,
                frecuencia_minutos: 1440,
            },
        });
        console.log("Seeded:", scjn.nombre);

    } catch (e) {
        console.error("Seed error:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
