-- AddUniqueConstraint
CREATE UNIQUE INDEX "BOM_parentPartId_childPartId_key" ON "BOM"("parentPartId", "childPartId");

-- CreateIndex
CREATE INDEX "BOM_parentPartId_idx" ON "BOM"("parentPartId");

-- CreateIndex
CREATE INDEX "BOM_childPartId_idx" ON "BOM"("childPartId");
