-- DropForeignKey
ALTER TABLE "ProjectTopLevelItem" DROP CONSTRAINT "ProjectTopLevelItem_projectId_fkey";

-- AddForeignKey
ALTER TABLE "ProjectTopLevelItem" ADD CONSTRAINT "ProjectTopLevelItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
