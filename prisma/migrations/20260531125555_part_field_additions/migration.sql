-- Add nine new Part columns
ALTER TABLE "Part" ADD COLUMN "vendorPartNumber" TEXT;
ALTER TABLE "Part" ADD COLUMN "binMin" INTEGER;
ALTER TABLE "Part" ADD COLUMN "binMax" INTEGER;
ALTER TABLE "Part" ADD COLUMN "modelLink" TEXT;
ALTER TABLE "Part" ADD COLUMN "drawingLink" TEXT;
ALTER TABLE "Part" ADD COLUMN "partCost" DECIMAL(10,2);
ALTER TABLE "Part" ADD COLUMN "partCostUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Part" ADD COLUMN "machineCycleTime" INTEGER;
ALTER TABLE "Part" ADD COLUMN "numberOfSetups" INTEGER;
