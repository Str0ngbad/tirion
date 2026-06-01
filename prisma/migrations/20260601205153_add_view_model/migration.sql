-- CreateTable
CREATE TABLE "view" (
    "viewId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "visibleColumns" JSONB NOT NULL,
    "defaultSort" JSONB NOT NULL,
    "filters" JSONB NOT NULL,

    CONSTRAINT "view_pkey" PRIMARY KEY ("viewId")
);

-- CreateIndex
CREATE UNIQUE INDEX "view_name_key" ON "view"("name");
