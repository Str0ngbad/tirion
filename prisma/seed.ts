import { prisma } from "../lib/db/client";

// ─── ProcurementCategories ───────────────────────────────────────────────────

async function seedProcurementCategories() {
  const procurementCategories = [
    { categoryCode: "CTL", categoryName: "Cut to Length", description: "Material cut to length by a vendor specifically for this Part", displayOrder: 1, isActive: true },
    { categoryCode: "PO",  categoryName: "Part Off",      description: "Material cut in-house from stocked material", displayOrder: 2, isActive: true },
    { categoryCode: "P",   categoryName: "Purchased",     description: "Finished purchased component", displayOrder: 3, isActive: true },
    { categoryCode: "SM",  categoryName: "Sheet Metal",   description: "Sheet metal stock", displayOrder: 4, isActive: true },
    { categoryCode: "HW",  categoryName: "Hardware",      description: "Fasteners, fittings, off-the-shelf components", displayOrder: 5, isActive: true },
  ];

  for (const cat of procurementCategories) {
    await prisma.procurementCategory.upsert({
      where: { categoryCode: cat.categoryCode },
      update: {},
      create: cat,
    });
  }

  console.log(`  ProcurementCategories: ${procurementCategories.length} records`);
}

// ─── ProcessTypes ────────────────────────────────────────────────────────────

async function seedProcessTypes() {
  const processTypes = [
    { processCode: "PURCHASE", processName: "Purchase", description: "Material or part procurement" },
    { processCode: "RECEIVE", processName: "Receive", description: "Receipt of purchased material" },
    { processCode: "MACHINE", processName: "Machine", description: "Machining operations" },
    { processCode: "WELD", processName: "Weld", description: "Welding operations" },
    { processCode: "BLACKEN", processName: "Blacken", description: "Outside-vendor chemical blackening" },
    { processCode: "PAINT", processName: "Paint", description: "Painting and coating operations" },
    { processCode: "PRINT_3D", processName: "3D Print", description: "Additive manufacturing" },
    { processCode: "ASSEMBLE", processName: "Assemble", description: "Assembly of components" },
    { processCode: "DISTRIBUTION", processName: "Distribution", description: "Final routing to project / stock" },
  ];

  for (const pt of processTypes) {
    await prisma.processType.upsert({
      where: { processCode: pt.processCode },
      update: {},
      create: { ...pt, isActive: true },
    });
  }

  console.log(`  ProcessTypes: ${processTypes.length} records`);
}

// ─── ProcessTypeSubStatuses ───────────────────────────────────────────────────

async function seedSubStatuses() {
  const purchase = await prisma.processType.findUniqueOrThrow({ where: { processCode: "PURCHASE" } });
  const receive = await prisma.processType.findUniqueOrThrow({ where: { processCode: "RECEIVE" } });
  const machine = await prisma.processType.findUniqueOrThrow({ where: { processCode: "MACHINE" } });
  const assemble = await prisma.processType.findUniqueOrThrow({ where: { processCode: "ASSEMBLE" } });

  const subStatuses = [
    // Purchase (4)
    { processTypeId: purchase.processTypeId, subStatusName: "Material checked", description: "Material verification (Rev 1 — material handling not yet separated)", displayOrder: 10 },
    { processTypeId: purchase.processTypeId, subStatusName: "RFQ Pending", description: "Quote requested from vendor; awaiting response", displayOrder: 20 },
    { processTypeId: purchase.processTypeId, subStatusName: "Quote Received", description: "Vendor responded; buyer evaluating", displayOrder: 30 },
    { processTypeId: purchase.processTypeId, subStatusName: "Ordered", description: "Supply Order submitted to vendor", displayOrder: 40 },
    // Receive (3)
    { processTypeId: receive.processTypeId, subStatusName: "Partial", description: "Partial shipment received; awaiting remainder", displayOrder: 10 },
    { processTypeId: receive.processTypeId, subStatusName: "Requested Update", description: "Vendor contacted for shipment status update", displayOrder: 20 },
    { processTypeId: receive.processTypeId, subStatusName: "Delayed", description: "Vendor confirmed shipment delay", displayOrder: 30 },
    // Machine (5)
    { processTypeId: machine.processTypeId, subStatusName: "Setup", description: "Machine setup in progress", displayOrder: 10 },
    { processTypeId: machine.processTypeId, subStatusName: "Running", description: "Machining operation actively running", displayOrder: 20 },
    { processTypeId: machine.processTypeId, subStatusName: "Complete", description: "Machining complete; awaiting next step or QA", displayOrder: 30 },
    { processTypeId: machine.processTypeId, subStatusName: "Hold for QA", description: "Held pending quality inspection", displayOrder: 40 },
    { processTypeId: machine.processTypeId, subStatusName: "Hold for Next Setup", description: "Machinist finished portion; awaiting next station availability", displayOrder: 50 },
    // Assemble (4)
    { processTypeId: assemble.processTypeId, subStatusName: "Staging", description: "Components being staged for assembly", displayOrder: 10 },
    { processTypeId: assemble.processTypeId, subStatusName: "Validate Fit", description: "Trial assembly to validate component fit", displayOrder: 20 },
    { processTypeId: assemble.processTypeId, subStatusName: "In Assembly", description: "Active assembly in progress", displayOrder: 30 },
    { processTypeId: assemble.processTypeId, subStatusName: "QA Review", description: "Held for assembler review or quality check", displayOrder: 40 },
  ];

  for (const ss of subStatuses) {
    await prisma.processTypeSubStatus.upsert({
      where: { processTypeId_subStatusName: { processTypeId: ss.processTypeId, subStatusName: ss.subStatusName } },
      update: {},
      create: { ...ss, isActive: true },
    });
  }

  console.log(`  ProcessTypeSubStatuses: ${subStatuses.length} records`);
}

// ─── AuditActions ─────────────────────────────────────────────────────────────

async function seedAuditActions() {
  const auditActions = [
    // Step (3)
    { actionName: "StepStateChanged", category: "Step", description: "Generic step state transition (with before/after in payload)" },
    { actionName: "StepSkipped", category: "Step", description: "Step transitioned to Skipped" },
    { actionName: "InferredStepSkip", category: "Step", description: "Step marked Skipped by inference (out-of-sequence completion)" },

    // WO (17)
    { actionName: "WOStateChanged", category: "WO", description: "WOStatus transition (Unreleased → Open, Open → Complete, etc.)" },
    { actionName: "WOCompleted", category: "WO", description: "WO status transition to Complete via standard execution" },
    { actionName: "WOStockFulfillmentReleased", category: "WO", description: "Stock Fulfillment Release event — sets stockFulfillmentReviewedAt. WOStatus unchanged for Pass-Through WOs" },
    { actionName: "WOBatchingConfirmed", category: "WO", description: "Batching Confirm event — transitions WOStatus from Unreleased to Open" },
    { actionName: "ManagerSkipAndFulfill", category: "WO", description: "Project View recovery action — skip remaining steps and complete from stock" },
    { actionName: "ReturnToStock", category: "WO", description: "Primitive 3 — Complete WO returned to start with stock increment" },
    { actionName: "AssemblyCascadeSkip", category: "WO", description: "Descendant WO Skip-Completed via Assembly stock fulfillment cascade" },
    { actionName: "AssemblyCascadeReverse", category: "WO", description: "Descendants un-Skip when Primitive 3 fires on a Stock-Fulfilled Assembly" },
    { actionName: "WOSplit", category: "WO", description: "WO Split primitive applied — original adjusted, new WO created" },
    { actionName: "WOCreatedViaSplit", category: "WO", description: "New WO created as a result of WO Split (distinguishes from compile-generated WOs)" },
    { actionName: "WOQuantityAdjusted", category: "WO", description: "WO quantity field updated (used for split commits and other quantity edits)" },
    { actionName: "WOCancelled", category: "WO", description: "Cancel primitive applied to leaf WO" },
    { actionName: "WOReceiptSatisfied", category: "WO", description: "WO's Supply Order allocation marked satisfied via Receiving Lens grid (manual allocation during partial receipt)" },
    { actionName: "WOEtaUpdated", category: "WO", description: "Per-WO ETA edited (independent of Supply Order Line ETA propagation)" },
    { actionName: "RoutingResetByFlagResolution", category: "WO", description: "All WO steps regenerated from current routing template via Accept Change resolution" },
    { actionName: "WOAttributeUpdatedByFlagResolution", category: "WO", description: "WO field updated to current Library value via Accept Change resolution" },
    { actionName: "BOMComponentAddedViaFlagResolution", category: "WO", description: "New child WO subtree generated under parent Assembly via Component Added Accept Change resolution" },

    // Batch (4)
    { actionName: "BatchCreated", category: "Batch", description: "Production Batch created via Batching Lens" },
    { actionName: "BatchDissolved", category: "Batch", description: "Batch dissolved (only one member remained)" },
    { actionName: "BatchAdjustment", category: "Batch", description: "WO membership reshaped via Batch Adjustment Workspace" },
    { actionName: "BatchMemberRemovedForFlagResolution", category: "Batch", description: "WO removed from batch to enable per-member flag resolution" },

    // Blocker (3)
    { actionName: "BlockerCreated", category: "Blocker", description: "Blocker created on a WO or Batch" },
    { actionName: "BlockerPending", category: "Blocker", description: "Blocker transitioned to Pending Resolution" },
    { actionName: "BlockerResolved", category: "Blocker", description: "Blocker resolved with type (Cleared, BatchAdjustment, RoutingRollback, WOSplit)" },

    // Project (7)
    { actionName: "ProjectCreated", category: "Project", description: "Draft Project created" },
    { actionName: "ProjectCompiled", category: "Project", description: "Draft → Active via successful compilation" },
    { actionName: "ProjectMetadataEdit", category: "Project", description: "Project Name, Customer Name, or Notes edited on Active Project" },
    { actionName: "ProjectDueDateChanged", category: "Project", description: "Project Due Date edited (with cascade summary to N WOs)" },
    { actionName: "ProjectTopLevelAdded", category: "Project", description: "New Top-Level Item added to Active Project" },
    { actionName: "ProjectArchived", category: "Project", description: "Project transitioned to Archived (Active or Complete origin)" },
    { actionName: "ProjectDraftDeleted", category: "Project", description: "Draft Project hard-deleted" },

    // Stock (7)
    { actionName: "StockFulfilled", category: "Stock", description: "WO completed via Fulfill from Stock" },
    { actionName: "StockPassThrough", category: "Stock", description: "WO explicitly passed through in Stock Fulfillment" },
    { actionName: "StockAutoPassThrough", category: "Stock", description: "WO auto-passed-through (lost candidacy or implicit at release)" },
    { actionName: "StockReconciliation", category: "Stock", description: "Stock count adjusted via Reconcile Stock modal" },
    { actionName: "StockFulfillmentReleased", category: "Stock", description: "Aggregate Release event (count of WOs released, scope)" },
    { actionName: "StockAllocation", category: "Stock", description: "From-stock attribution on a Project View edit (combined WO state + stock decrement)" },
    { actionName: "InventoryAdjusted", category: "Stock", description: "Direct inventory adjustment (Distribution Lens, Parts Master)" },

    // SupplyOrder (5)
    { actionName: "SupplyOrderLineFulfilled", category: "SupplyOrder", description: "Supply Order Line marked Fulfilled — satisfies all unsatisfied WOs allocated to it" },
    { actionName: "SupplyOrderLinePartialReceipt", category: "SupplyOrder", description: "Partial qty received recorded on a Supply Order Line (does not satisfy WOs)" },
    { actionName: "SupplyOrderLineExceptionSet", category: "SupplyOrder", description: "Exception flagged on a Supply Order Line by receiver" },
    { actionName: "SupplyOrderLineExceptionCleared", category: "SupplyOrder", description: "Exception cleared on a Supply Order Line (typically by Purchasing after vendor resolution)" },
    { actionName: "SupplyOrderLineETAUpdated", category: "SupplyOrder", description: "Supply Order Line ETA edited — propagates to all member WO ETAs in same transaction" },

    // Definition (9)
    { actionName: "PartCreated", category: "Definition", description: "New Part record created" },
    { actionName: "PartUpdated", category: "Definition", description: "Part definition field edited" },
    { actionName: "PartDeactivated", category: "Definition", description: "Part isActive set to false" },
    { actionName: "BOMRowAdded", category: "Definition", description: "Component added to an assembly's BOM" },
    { actionName: "BOMRowRemoved", category: "Definition", description: "Component removed from an assembly's BOM" },
    { actionName: "BOMRowEdited", category: "Definition", description: "BOM quantity or displayOrder edited" },
    { actionName: "RoutingTemplateCreated", category: "Definition", description: "New Routing Template Definition created" },
    { actionName: "RoutingTemplateEdited", category: "Definition", description: "Existing template edited (steps added/removed/reordered)" },
    { actionName: "RoutingTemplateRetired", category: "Definition", description: "Template isActive set to false" },

    // Flag (4)
    { actionName: "DefinitionChangeFlagCreated", category: "Flag", description: "New definition change flag created (one entry per affected entity)" },
    { actionName: "DefinitionChangeFlagResolved", category: "Flag", description: "Flag resolved (Dismiss or AcceptChange)" },
    { actionName: "DefinitionChangeFlagInheritedViaWOSplit", category: "Flag", description: "Original flag auto-resolved when flagged WO was split; new flags created on resulting WOs" },
    { actionName: "DefinitionChangeFlagAutoResolvedViaBatchDissolution", category: "Flag", description: "Batch flag auto-resolved when batch was dissolved while flag was open" },

    // Configuration (4)
    { actionName: "VendorCreated", category: "Configuration", description: "New Vendor record created" },
    { actionName: "VendorUpdated", category: "Configuration", description: "Vendor attribute fields edited" },
    { actionName: "VendorDeactivated", category: "Configuration", description: "Vendor isActive set to false" },
    { actionName: "VendorReactivated", category: "Configuration", description: "Vendor isActive restored to true" },
    { actionName: "ProcurementCategoryCreated", category: "Configuration", description: "New ProcurementCategory record created" },
    { actionName: "ProcurementCategoryUpdated", category: "Configuration", description: "ProcurementCategory attribute fields edited" },
    { actionName: "ProcurementCategoryDeactivated", category: "Configuration", description: "ProcurementCategory isActive set to false" },
    { actionName: "ProcurementCategoryReactivated", category: "Configuration", description: "ProcurementCategory isActive restored to true" },
    { actionName: "MaterialSpecCreated", category: "Configuration", description: "New MaterialSpec record created" },
    { actionName: "MaterialSpecUpdated", category: "Configuration", description: "MaterialSpec attribute fields edited" },
    { actionName: "MaterialSpecDeactivated", category: "Configuration", description: "MaterialSpec isActive set to false" },
    { actionName: "MaterialSpecReactivated", category: "Configuration", description: "MaterialSpec isActive restored to true" },
    { actionName: "UserCreated", category: "Configuration", description: "New User record created" },
    { actionName: "UserUpdated", category: "Configuration", description: "User attribute fields or role edited" },
    { actionName: "UserDeactivated", category: "Configuration", description: "User isActive set to false" },
    { actionName: "UserReactivated", category: "Configuration", description: "User isActive restored to true" },
    { actionName: "ProcessTypeSubStatusCreated", category: "Configuration", description: "New ProcessTypeSubStatus record created" },
    { actionName: "ProcessTypeSubStatusUpdated", category: "Configuration", description: "ProcessTypeSubStatus attribute fields edited" },
    { actionName: "ProcessTypeSubStatusDeactivated", category: "Configuration", description: "ProcessTypeSubStatus isActive set to false" },
    { actionName: "ProcessTypeSubStatusReactivated", category: "Configuration", description: "ProcessTypeSubStatus isActive restored to true" },
  ];

  for (const aa of auditActions) {
    await prisma.auditAction.upsert({
      where: { actionName: aa.actionName },
      update: {},
      create: { ...aa, isActive: true },
    });
  }

  console.log(`  AuditActions: ${auditActions.length} records`);
}

// ─── Admin User ───────────────────────────────────────────────────────────────

async function seedAdminUser() {
  await prisma.user.upsert({
    where: { userName: "admin" },
    update: {},
    create: {
      userName: "admin",
      displayName: "Admin",
      role: "Admin",
      isActive: true,
      defaultStation: null,
    },
  });

  console.log("  Users: 1 record (bootstrap admin)");
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verify() {
  const [processTypeCount, subStatusCount, auditActionCount, procurementCategoryCount, userCount] = await Promise.all([
    prisma.processType.count(),
    prisma.processTypeSubStatus.count(),
    prisma.auditAction.count(),
    prisma.procurementCategory.count(),
    prisma.user.count({ where: { userName: "admin" } }),
  ]);

  console.log("\nVerification:");
  console.log(`  ProcessTypes:           ${processTypeCount} (expected = 9)`);
  console.log(`  ProcessTypeSubStatuses: ${subStatusCount} (expected = 16)`);
  console.log(`  AuditActions:           ${auditActionCount} (expected = 79)`);
  console.log(`  ProcurementCategories:  ${procurementCategoryCount} (expected = 5)`);
  console.log(`  Admin user present:     ${userCount === 1 ? "yes" : "NO — check seed"}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Tirion database…\n");

  await seedProcurementCategories();
  await seedProcessTypes();
  await seedSubStatuses();
  await seedAuditActions();
  await seedAdminUser();

  await verify();

  console.log("\nSeed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
