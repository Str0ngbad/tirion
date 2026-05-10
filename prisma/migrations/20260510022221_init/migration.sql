-- CreateEnum
CREATE TYPE "PartType" AS ENUM ('Part', 'Assembly');

-- CreateEnum
CREATE TYPE "ProcurementType" AS ENUM ('Make', 'Buy', 'MakeBuy');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('Draft', 'Active', 'Complete', 'Archived');

-- CreateEnum
CREATE TYPE "WOStatus" AS ENUM ('Unreleased', 'Open', 'Complete', 'Cancelled');

-- CreateEnum
CREATE TYPE "StepState" AS ENUM ('Waiting', 'Ready', 'Started', 'Complete', 'Blocked', 'Skipped');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('Planned', 'Active', 'Complete', 'Blocked');

-- CreateEnum
CREATE TYPE "BlockerEntityType" AS ENUM ('WorkOrder', 'Batch');

-- CreateEnum
CREATE TYPE "BlockerCategory" AS ENUM ('Local', 'Escalated');

-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('Cleared', 'BatchAdjustment', 'RoutingRollback', 'WOSplit');

-- CreateEnum
CREATE TYPE "DefinitionChangeType" AS ENUM ('PartFieldChanged', 'PartRoutingChanged', 'RoutingTemplateEdited', 'BOMQuantityChanged', 'BOMComponentAdded', 'BOMComponentRemoved');

-- CreateEnum
CREATE TYPE "FlagResolution" AS ENUM ('Dismiss', 'AcceptChange');

-- CreateEnum
CREATE TYPE "SupplyOrderStatus" AS ENUM ('Draft', 'RFQSent', 'Ordered', 'PartialReceived', 'Closed');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Operator', 'Lead', 'Manager', 'Admin');

-- CreateTable
CREATE TABLE "Part" (
    "partId" SERIAL NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "partType" "PartType" NOT NULL,
    "description" TEXT,
    "defaultVendorId" INTEGER,
    "materialSpecId" INTEGER,
    "routingTemplateDefinitionId" INTEGER,
    "blankLength" DECIMAL(65,30),
    "procurementType" "ProcurementType" NOT NULL,
    "inventoryLocation" TEXT,
    "stockCount" DECIMAL(65,30) DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("partId")
);

-- CreateTable
CREATE TABLE "BOM" (
    "bomId" SERIAL NOT NULL,
    "parentPartId" INTEGER NOT NULL,
    "childPartId" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "BOM_pkey" PRIMARY KEY ("bomId")
);

-- CreateTable
CREATE TABLE "RoutingTemplateDefinition" (
    "routingTemplateDefinitionId" SERIAL NOT NULL,
    "templateName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoutingTemplateDefinition_pkey" PRIMARY KEY ("routingTemplateDefinitionId")
);

-- CreateTable
CREATE TABLE "RoutingTemplateStep" (
    "routingTemplateStepId" SERIAL NOT NULL,
    "routingTemplateDefinitionId" INTEGER NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "processTypeId" INTEGER NOT NULL,

    CONSTRAINT "RoutingTemplateStep_pkey" PRIMARY KEY ("routingTemplateStepId")
);

-- CreateTable
CREATE TABLE "MaterialSpec" (
    "materialSpecId" SERIAL NOT NULL,
    "materialName" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "stockSize" TEXT NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MaterialSpec_pkey" PRIMARY KEY ("materialSpecId")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "vendorId" SERIAL NOT NULL,
    "vendorName" TEXT NOT NULL,
    "contactInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("vendorId")
);

-- CreateTable
CREATE TABLE "ProcessType" (
    "processTypeId" SERIAL NOT NULL,
    "processCode" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProcessType_pkey" PRIMARY KEY ("processTypeId")
);

-- CreateTable
CREATE TABLE "ProcessTypeSubStatus" (
    "processTypeSubStatusId" SERIAL NOT NULL,
    "processTypeId" INTEGER NOT NULL,
    "subStatusName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProcessTypeSubStatus_pkey" PRIMARY KEY ("processTypeSubStatusId")
);

-- CreateTable
CREATE TABLE "Project" (
    "projectId" SERIAL NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "customerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorUserId" INTEGER NOT NULL,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEditedUserId" INTEGER NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "workOrderId" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL,
    "parentWoId" INTEGER,
    "routingTemplateDefinitionId" INTEGER NOT NULL,
    "topLevelIndex" INTEGER,
    "quantity" DECIMAL(65,30) NOT NULL,
    "priority" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "eta" TIMESTAMP(3),
    "status" "WOStatus" NOT NULL DEFAULT 'Unreleased',
    "batchId" INTEGER,
    "stockFulfillmentReviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("workOrderId")
);

-- CreateTable
CREATE TABLE "WorkOrderStep" (
    "workOrderStepId" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "processTypeId" INTEGER NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "state" "StepState" NOT NULL DEFAULT 'Waiting',
    "subStatusId" INTEGER,
    "subStatusNote" TEXT,
    "assignedUserId" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedQty" DECIMAL(65,30),
    "scrapQty" DECIMAL(65,30),
    "notes" TEXT,

    CONSTRAINT "WorkOrderStep_pkey" PRIMARY KEY ("workOrderStepId")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "batchId" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "totalQuantity" DECIMAL(65,30) NOT NULL,
    "plannedQuantity" DECIMAL(65,30),
    "priority" INTEGER,
    "dueDate" TIMESTAMP(3),
    "currentStepIndex" INTEGER NOT NULL DEFAULT 1,
    "status" "BatchStatus" NOT NULL DEFAULT 'Planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("batchId")
);

-- CreateTable
CREATE TABLE "Blocker" (
    "blockerId" SERIAL NOT NULL,
    "entityType" "BlockerEntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "processTypeId" INTEGER NOT NULL,
    "category" "BlockerCategory" NOT NULL DEFAULT 'Local',
    "preBlockerState" "StepState" NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingAt" TIMESTAMP(3),
    "pendingByUserId" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" INTEGER,
    "resolutionType" "ResolutionType",
    "resolutionNote" TEXT,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("blockerId")
);

-- CreateTable
CREATE TABLE "DefinitionChangeFlag" (
    "flagId" SERIAL NOT NULL,
    "changeType" "DefinitionChangeType" NOT NULL,
    "changedEntityType" TEXT NOT NULL,
    "changedEntityId" INTEGER NOT NULL,
    "affectedEntityType" TEXT NOT NULL,
    "affectedEntityId" INTEGER NOT NULL,
    "parentFlagId" INTEGER,
    "changeDescription" TEXT NOT NULL,
    "changeAuditLogId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" INTEGER NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" INTEGER,
    "resolutionAction" "FlagResolution",
    "resolutionNote" TEXT,

    CONSTRAINT "DefinitionChangeFlag_pkey" PRIMARY KEY ("flagId")
);

-- CreateTable
CREATE TABLE "SupplyOrder" (
    "supplyOrderId" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "status" "SupplyOrderStatus" NOT NULL DEFAULT 'Draft',
    "orderDate" TIMESTAMP(3),
    "expectedEta" TIMESTAMP(3),
    "trackingRef" TEXT,
    "notes" TEXT,

    CONSTRAINT "SupplyOrder_pkey" PRIMARY KEY ("supplyOrderId")
);

-- CreateTable
CREATE TABLE "SupplyOrderLine" (
    "supplyOrderLineId" SERIAL NOT NULL,
    "supplyOrderId" INTEGER NOT NULL,
    "partId" INTEGER,
    "materialSpecId" INTEGER,
    "orderedQty" DECIMAL(65,30) NOT NULL,
    "receivedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(65,30),
    "notes" TEXT,
    "eta" TIMESTAMP(3),
    "hasException" BOOLEAN NOT NULL DEFAULT false,
    "exceptionNote" TEXT,
    "exceptionCreatedByUserId" INTEGER,
    "exceptionCreatedAt" TIMESTAMP(3),
    "exceptionResolvedNote" TEXT,
    "exceptionResolvedByUserId" INTEGER,
    "exceptionResolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupplyOrderLine_pkey" PRIMARY KEY ("supplyOrderLineId")
);

-- CreateTable
CREATE TABLE "SupplyOrderLineAllocation" (
    "supplyOrderLineAllocationId" SERIAL NOT NULL,
    "supplyOrderLineId" INTEGER NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "allocatedQty" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SupplyOrderLineAllocation_pkey" PRIMARY KEY ("supplyOrderLineAllocationId")
);

-- CreateTable
CREATE TABLE "User" (
    "userId" SERIAL NOT NULL,
    "userName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'Operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultStation" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserProcessTypeAssignment" (
    "userId" INTEGER NOT NULL,
    "processTypeId" INTEGER NOT NULL,

    CONSTRAINT "UserProcessTypeAssignment_pkey" PRIMARY KEY ("userId","processTypeId")
);

-- CreateTable
CREATE TABLE "AuditAction" (
    "auditActionId" SERIAL NOT NULL,
    "actionName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AuditAction_pkey" PRIMARY KEY ("auditActionId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "auditLogId" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "auditActionId" INTEGER NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousValue" JSONB,
    "newValue" JSONB,
    "note" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("auditLogId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Part_inventoryLocation_key" ON "Part"("inventoryLocation");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingTemplateDefinition_templateName_key" ON "RoutingTemplateDefinition"("templateName");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessType_processCode_key" ON "ProcessType"("processCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessType_processName_key" ON "ProcessType"("processName");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessTypeSubStatus_processTypeId_subStatusName_key" ON "ProcessTypeSubStatus"("processTypeId", "subStatusName");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectNumber_key" ON "Project"("projectNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "AuditAction_actionName_key" ON "AuditAction"("actionName");

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_defaultVendorId_fkey" FOREIGN KEY ("defaultVendorId") REFERENCES "Vendor"("vendorId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_materialSpecId_fkey" FOREIGN KEY ("materialSpecId") REFERENCES "MaterialSpec"("materialSpecId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_routingTemplateDefinitionId_fkey" FOREIGN KEY ("routingTemplateDefinitionId") REFERENCES "RoutingTemplateDefinition"("routingTemplateDefinitionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOM" ADD CONSTRAINT "BOM_parentPartId_fkey" FOREIGN KEY ("parentPartId") REFERENCES "Part"("partId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOM" ADD CONSTRAINT "BOM_childPartId_fkey" FOREIGN KEY ("childPartId") REFERENCES "Part"("partId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingTemplateStep" ADD CONSTRAINT "RoutingTemplateStep_routingTemplateDefinitionId_fkey" FOREIGN KEY ("routingTemplateDefinitionId") REFERENCES "RoutingTemplateDefinition"("routingTemplateDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingTemplateStep" ADD CONSTRAINT "RoutingTemplateStep_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "ProcessType"("processTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTypeSubStatus" ADD CONSTRAINT "ProcessTypeSubStatus_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "ProcessType"("processTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_lastEditedUserId_fkey" FOREIGN KEY ("lastEditedUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("partId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_parentWoId_fkey" FOREIGN KEY ("parentWoId") REFERENCES "WorkOrder"("workOrderId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_routingTemplateDefinitionId_fkey" FOREIGN KEY ("routingTemplateDefinitionId") REFERENCES "RoutingTemplateDefinition"("routingTemplateDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("batchId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("workOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "ProcessType"("processTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_subStatusId_fkey" FOREIGN KEY ("subStatusId") REFERENCES "ProcessTypeSubStatus"("processTypeSubStatusId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("partId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "ProcessType"("processTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_pendingByUserId_fkey" FOREIGN KEY ("pendingByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefinitionChangeFlag" ADD CONSTRAINT "DefinitionChangeFlag_parentFlagId_fkey" FOREIGN KEY ("parentFlagId") REFERENCES "DefinitionChangeFlag"("flagId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefinitionChangeFlag" ADD CONSTRAINT "DefinitionChangeFlag_changeAuditLogId_fkey" FOREIGN KEY ("changeAuditLogId") REFERENCES "AuditLog"("auditLogId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefinitionChangeFlag" ADD CONSTRAINT "DefinitionChangeFlag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefinitionChangeFlag" ADD CONSTRAINT "DefinitionChangeFlag_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLine" ADD CONSTRAINT "SupplyOrderLine_supplyOrderId_fkey" FOREIGN KEY ("supplyOrderId") REFERENCES "SupplyOrder"("supplyOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLine" ADD CONSTRAINT "SupplyOrderLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("partId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLine" ADD CONSTRAINT "SupplyOrderLine_materialSpecId_fkey" FOREIGN KEY ("materialSpecId") REFERENCES "MaterialSpec"("materialSpecId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLineAllocation" ADD CONSTRAINT "SupplyOrderLineAllocation_supplyOrderLineId_fkey" FOREIGN KEY ("supplyOrderLineId") REFERENCES "SupplyOrderLine"("supplyOrderLineId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLineAllocation" ADD CONSTRAINT "SupplyOrderLineAllocation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("workOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProcessTypeAssignment" ADD CONSTRAINT "UserProcessTypeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProcessTypeAssignment" ADD CONSTRAINT "UserProcessTypeAssignment_processTypeId_fkey" FOREIGN KEY ("processTypeId") REFERENCES "ProcessType"("processTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_auditActionId_fkey" FOREIGN KEY ("auditActionId") REFERENCES "AuditAction"("auditActionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
