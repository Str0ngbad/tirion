-- MaterialSpec reconciliation: simplify to alloy + form; move stockSize to Part

-- Drop the old MaterialSpec columns
ALTER TABLE "MaterialSpec" DROP COLUMN IF EXISTS "stockSize";
ALTER TABLE "MaterialSpec" DROP COLUMN IF EXISTS "unitOfMeasure";

-- Add the composite unique constraint
CREATE UNIQUE INDEX "MaterialSpec_materialName_form_key"
  ON "MaterialSpec"("materialName", "form");

-- Add stockSize to Part
ALTER TABLE "Part" ADD COLUMN "stockSize" TEXT;
