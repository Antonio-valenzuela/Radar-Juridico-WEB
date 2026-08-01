UPDATE "OfficialSource"
SET
  "slug" = 'PERIODICO_OFICIAL_JALISCO',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'jalisco_gazette'
  AND NOT EXISTS (
    SELECT 1
    FROM "OfficialSource"
    WHERE "slug" = 'PERIODICO_OFICIAL_JALISCO'
  );

INSERT INTO "OfficialSource" (
  "id",
  "name",
  "slug",
  "baseUrl",
  "adapter",
  "healthUrl",
  "requiresBrowser",
  "type",
  "jurisdiction",
  "country",
  "state",
  "matter",
  "description",
  "isActive",
  "isOfficial",
  "trustLevel",
  "crawlMode",
  "refreshFrequency",
  "createdAt",
  "updatedAt"
)
VALUES (
  'official-source-periodico-jalisco',
  'Periódico Oficial del Estado de Jalisco',
  'PERIODICO_OFICIAL_JALISCO',
  'https://periodicooficial.jalisco.gob.mx',
  'PERIODICO_OFICIAL_JALISCO',
  'https://apiperiodico.jalisco.gob.mx/api/newspaper/public?fecha=&search=&page=1&perPage=1',
  false,
  'state_gazette',
  'Jalisco',
  'MX',
  'Jalisco',
  'estatal',
  'Periódico Oficial El Estado de Jalisco; índice público por fecha y ejemplares electrónicos en PDF.',
  true,
  true,
  'official',
  'api',
  'daily',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "baseUrl" = EXCLUDED."baseUrl",
  "adapter" = EXCLUDED."adapter",
  "healthUrl" = EXCLUDED."healthUrl",
  "requiresBrowser" = EXCLUDED."requiresBrowser",
  "type" = EXCLUDED."type",
  "jurisdiction" = EXCLUDED."jurisdiction",
  "country" = EXCLUDED."country",
  "state" = EXCLUDED."state",
  "matter" = EXCLUDED."matter",
  "description" = EXCLUDED."description",
  "isActive" = EXCLUDED."isActive",
  "isOfficial" = EXCLUDED."isOfficial",
  "trustLevel" = EXCLUDED."trustLevel",
  "crawlMode" = EXCLUDED."crawlMode",
  "refreshFrequency" = EXCLUDED."refreshFrequency",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "OfficialSource"
SET
  "isActive" = false,
  "description" = 'Registro legado sustituido por PERIODICO_OFICIAL_JALISCO.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'jalisco_gazette';
