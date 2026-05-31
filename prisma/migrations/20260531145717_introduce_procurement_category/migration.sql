-- Create the ProcurementCategory table
CREATE TABLE "ProcurementCategory" (
  "procurementCategoryId" SERIAL PRIMARY KEY,
  "categoryCode" TEXT NOT NULL UNIQUE,
  "categoryName" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0
);

-- Add procurementCategoryId to Part
ALTER TABLE "Part" ADD COLUMN "procurementCategoryId" INTEGER;
ALTER TABLE "Part" ADD CONSTRAINT "Part_procurementCategoryId_fkey"
  FOREIGN KEY ("procurementCategoryId")
  REFERENCES "ProcurementCategory"("procurementCategoryId")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the procurementType column from Part
ALTER TABLE "Part" DROP COLUMN IF EXISTS "procurementType";

-- Drop the ProcurementType enum type
DROP TYPE IF EXISTS "ProcurementType";
