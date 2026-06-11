-- AlterTable
ALTER TABLE "WorkOrder" ALTER COLUMN "dueDate" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProjectTopLevelItem" (
    "topLevelItemId" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "topLevelIndex" INTEGER NOT NULL,

    CONSTRAINT "ProjectTopLevelItem_pkey" PRIMARY KEY ("topLevelItemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTopLevelItem_projectId_topLevelIndex_key" ON "ProjectTopLevelItem"("projectId", "topLevelIndex");

-- AddForeignKey
ALTER TABLE "ProjectTopLevelItem" ADD CONSTRAINT "ProjectTopLevelItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTopLevelItem" ADD CONSTRAINT "ProjectTopLevelItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("partId") ON DELETE RESTRICT ON UPDATE CASCADE;
