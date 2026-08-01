-- Migrate Item.tema from VARCHAR/TEXT to TEXT[] preserving existing values
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "tema_new" text[] DEFAULT ARRAY[]::text[];

-- Convert existing single string tema values to single-element arrays
UPDATE "Item"
SET "tema_new" = CASE
  WHEN "tema" IS NOT NULL AND "tema" <> '' THEN ARRAY["tema"]
  ELSE ARRAY[]::text[]
END;

ALTER TABLE "Item" DROP COLUMN "tema";
ALTER TABLE "Item" RENAME COLUMN "tema_new" TO "tema";

-- Add AI summary fields to NormaDiff
ALTER TABLE "NormaDiff" ADD COLUMN IF NOT EXISTS "executiveSummary" text;
ALTER TABLE "NormaDiff" ADD COLUMN IF NOT EXISTS "practicalImpact" text;
ALTER TABLE "NormaDiff" ADD COLUMN IF NOT EXISTS "recommendedAction" text;
