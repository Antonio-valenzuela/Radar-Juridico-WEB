const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const connection = await prisma.$queryRawUnsafe(`
    SELECT
      current_database() AS database_name,
      current_schema() AS schema_name,
      current_user AS database_user,
      inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port
  `);

  const expectedTables = await prisma.$queryRawUnsafe(`
    SELECT
      to_regclass('public."BulletinSubscription"')::text AS bulletin_subscription,
      to_regclass('public."BulletinCheckRun"')::text AS bulletin_check_run,
      to_regclass('public."BulletinMatch"')::text AS bulletin_match
  `);

  const actualBulletinTables = await prisma.$queryRawUnsafe(`
    SELECT
      table_schema,
      table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name ILIKE '%bulletin%'
    ORDER BY table_name
  `);

  const migrations = await prisma.$queryRawUnsafe(`
    SELECT
      migration_name,
      started_at,
      finished_at,
      rolled_back_at,
      applied_steps_count,
      logs
    FROM "_prisma_migrations"
    WHERE migration_name ILIKE '%bulletin%'
    ORDER BY started_at
  `);

  console.log("\n=== CONEXIÓN REAL ===");
  console.table(connection);

  console.log("\n=== TABLAS ESPERADAS ===");
  console.table(expectedTables);

  console.log("\n=== TABLAS BULLETIN EXISTENTES ===");
  console.table(actualBulletinTables);

  console.log("\n=== MIGRACIONES BULLETIN REGISTRADAS ===");
  console.table(migrations);

  const tables = expectedTables[0] ?? {};

  const allExist =
    tables.bulletin_subscription &&
    tables.bulletin_check_run &&
    tables.bulletin_match;

  console.log(
    "\nRESULTADO_FINAL=" +
      (allExist ? "TODAS_LAS_TABLAS_EXISTEN" : "FALTAN_TABLAS")
  );
}

main()
  .catch((error) => {
    console.error("\nERROR_DE_COMPROBACION:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
