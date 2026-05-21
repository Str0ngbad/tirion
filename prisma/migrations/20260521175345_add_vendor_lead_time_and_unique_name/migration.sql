-- AlterTable: add leadTimeDays column to Vendor
ALTER TABLE "Vendor" ADD COLUMN "leadTimeDays" INTEGER;

-- CreateIndex: unique constraint on vendorName
CREATE UNIQUE INDEX "Vendor_vendorName_key" ON "Vendor"("vendorName");
