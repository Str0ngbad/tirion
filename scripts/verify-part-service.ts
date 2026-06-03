/**
 * Verification script for the Part service layer.
 * Run with: npx tsx scripts/verify-part-service.ts
 *
 * Exercises each service function end-to-end against a real database.
 * Cleans up all test data in finally{} so the database is left unchanged.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  listParts,
  getPart,
  createPart,
  updatePart,
  updateStockCount,
  updateInventoryLocation,
  deactivatePart,
  reactivatePart,
} from "../lib/parts/service";
import { CreatePartSchema, UpdatePartSchema, UpdateStockCountSchema } from "../lib/parts/schemas";
import {
  PartNotFoundError,
  PartNumberCollisionError,
  PartAlreadyActiveError,
  PartAlreadyInactiveError,
  PartVendorInvalidError,
  PartMaterialSpecInvalidError,
  PartProcurementCategoryInvalidError,
  PartRoutingTemplateInvalidError,
} from "../lib/errors/index";

const USER_ID = 1;

async function assertThrows(fn: () => Promise<unknown>, ErrorClass: new (...args: never[]) => Error, label: string) {
  try {
    await fn();
    throw new Error(`Expected ${ErrorClass.name} but no error was thrown (${label})`);
  } catch (err) {
    if (err instanceof ErrorClass) {
      console.log(`${label}: ${ErrorClass.name} correctly thrown`);
    } else {
      throw err;
    }
  }
}

async function main() {
  const createdPartIds: number[] = [];
  let testVendorId: number | null = null;
  let testMaterialSpecId: number | null = null;
  let vendorDeactivatedForTest = false;
  let materialSpecDeactivatedForTest = false;

  try {
    // ── Setup: find existing seed FK targets ──────────────────────────────────

    const seedVendor = await prisma.vendor.findFirst({ where: { isActive: true } });
    const seedMaterialSpec = await prisma.materialSpec.findFirst({ where: { isActive: true } });
    const seedProcCat = await prisma.procurementCategory.findFirst({ where: { isActive: true } });
    const seedRoutingTmpl = await prisma.routingTemplateDefinition.findFirst({ where: { isActive: true } });

    // Create a throwaway vendor and material spec for FK deactivation tests
    const testVendor = await prisma.vendor.create({
      data: { vendorName: "TEST_VENDOR_FOR_PART_VERIFY_DO_NOT_USE", isActive: true },
    });
    testVendorId = testVendor.vendorId;

    const testMaterialSpec = await prisma.materialSpec.create({
      data: { materialName: "TEST_MATSPEC_FOR_PART_VERIFY_DO_NOT_USE", form: "Bar", isActive: true },
    });
    testMaterialSpecId = testMaterialSpec.materialSpecId;

    // ── a) Create a Part with all FK relations ────────────────────────────────

    const partA = await createPart(
      {
        partNumber: "TEST-A-001",
        partName: "Test Part A",
        partType: "Part",
        description: "Full FK test part",
        defaultVendorId: seedVendor?.vendorId ?? null,
        materialSpecId: seedMaterialSpec?.materialSpecId ?? null,
        procurementCategoryId: seedProcCat?.procurementCategoryId ?? null,
        routingTemplateDefinitionId: seedRoutingTmpl?.routingTemplateDefinitionId ?? null,
        stockSize: "1.5 OD",
        blankLength: 12.5,
        machineCycleTime: 45,
        numberOfSetups: 2,
        binMin: 5,
        binMax: 50,
        notes: "Verification test part",
        partCost: 12.99,
      },
      USER_ID
    );
    createdPartIds.push(partA.partId);
    console.log(`a) Created part A (partId=${partA.partId}): ${partA.partNumber} — ${partA.partName}`);
    if (partA.partType !== "Part") throw new Error("Expected partType Part");
    if (partA.defaultVendorName === null && seedVendor !== null) throw new Error("Expected defaultVendorName");

    // ── b) Create a Part with no FK relations ─────────────────────────────────

    const partB = await createPart(
      {
        partNumber: "TEST-B-001",
        partName: "Test Part B — No FKs",
        partType: "Part",
      },
      USER_ID
    );
    createdPartIds.push(partB.partId);
    console.log(`b) Created part B with no FKs (partId=${partB.partId})`);
    if (partB.defaultVendorId !== null) throw new Error("Expected no defaultVendorId");

    // ── c) Create an Assembly ─────────────────────────────────────────────────

    const assembly = await createPart(
      {
        partNumber: "TEST-ASSY-001",
        partName: "Test Assembly",
        partType: "Assembly",
      },
      USER_ID
    );
    createdPartIds.push(assembly.partId);
    console.log(`c) Created Assembly (partId=${assembly.partId}), partType=${assembly.partType}`);
    if (assembly.partType !== "Assembly") throw new Error("Expected partType Assembly");

    // ── d) PartNumberCollisionError ───────────────────────────────────────────

    await assertThrows(
      () => createPart({ partNumber: "TEST-A-001", partName: "Dupe", partType: "Part" }, USER_ID),
      PartNumberCollisionError,
      "d) Part number collision"
    );

    // ── e) PartVendorInvalidError — nonexistent vendor ────────────────────────

    await assertThrows(
      () => createPart({ partNumber: "TEST-E-001", partName: "Bad Vendor", partType: "Part", defaultVendorId: 999999 }, USER_ID),
      PartVendorInvalidError,
      "e) Invalid vendor (nonexistent)"
    );

    // ── f) PartVendorInvalidError — inactive vendor ───────────────────────────

    await prisma.vendor.update({ where: { vendorId: testVendorId }, data: { isActive: false } });
    vendorDeactivatedForTest = true;

    await assertThrows(
      () => createPart({ partNumber: "TEST-F-001", partName: "Inactive Vendor", partType: "Part", defaultVendorId: testVendorId! }, USER_ID),
      PartVendorInvalidError,
      "f) Invalid vendor (inactive)"
    );

    await prisma.vendor.update({ where: { vendorId: testVendorId }, data: { isActive: true } });
    vendorDeactivatedForTest = false;

    // ── g) PartMaterialSpecInvalidError — inactive material spec ──────────────

    await prisma.materialSpec.update({ where: { materialSpecId: testMaterialSpecId }, data: { isActive: false } });
    materialSpecDeactivatedForTest = true;

    await assertThrows(
      () => createPart({ partNumber: "TEST-G-001", partName: "Inactive Spec", partType: "Part", materialSpecId: testMaterialSpecId! }, USER_ID),
      PartMaterialSpecInvalidError,
      "g) Invalid materialSpec (inactive)"
    );

    await prisma.materialSpec.update({ where: { materialSpecId: testMaterialSpecId }, data: { isActive: true } });
    materialSpecDeactivatedForTest = false;

    // ── h) PartProcurementCategoryInvalidError ────────────────────────────────

    await assertThrows(
      () => createPart({ partNumber: "TEST-H-001", partName: "Bad ProcCat", partType: "Part", procurementCategoryId: 999999 }, USER_ID),
      PartProcurementCategoryInvalidError,
      "h) Invalid procurementCategory"
    );

    // ── i) PartRoutingTemplateInvalidError ────────────────────────────────────

    await assertThrows(
      () => createPart({ partNumber: "TEST-I-001", partName: "Bad Template", partType: "Part", routingTemplateDefinitionId: 999999 }, USER_ID),
      PartRoutingTemplateInvalidError,
      "i) Invalid routingTemplateDefinition"
    );

    // ── j) listParts active=true ──────────────────────────────────────────────

    const activeList = await listParts({ active: "true" });
    const partAInList = activeList.find((p) => p.partId === partA.partId);
    if (!partAInList) throw new Error("Part A should appear in active list");
    console.log(`j) listParts(active=true): found Part A in list (total=${activeList.length})`);

    // ── k) listParts active=all ───────────────────────────────────────────────

    const allList = await listParts({ active: "all" });
    if (allList.length < activeList.length) throw new Error("active=all should return >= active=true count");
    console.log(`k) listParts(active=all): ${allList.length} parts`);

    // ── l) getPart — Part type ────────────────────────────────────────────────

    const partADetail = await getPart(partA.partId);
    if (partADetail.bomParentCount !== 0) throw new Error("Expected bomParentCount=0 for new Part");
    if (partADetail.bomChildCount !== null) throw new Error("Expected bomChildCount=null for Part type");
    console.log(`l) getPart(partA): bomParentCount=${partADetail.bomParentCount}, bomChildCount=${partADetail.bomChildCount}`);

    // ── m) getPart — Assembly type ────────────────────────────────────────────

    const assemblyDetail = await getPart(assembly.partId);
    if (assemblyDetail.bomChildCount === null) throw new Error("Expected bomChildCount to be number for Assembly");
    console.log(`m) getPart(assembly): bomChildCount=${assemblyDetail.bomChildCount} (number, not null)`);

    // ── n) updatePart ─────────────────────────────────────────────────────────

    const updated = await updatePart(partB.partId, { partName: "Updated Part B", notes: "updated" }, USER_ID);
    if (updated.partName !== "Updated Part B") throw new Error("Expected updated partName");
    console.log(`n) updatePart: partName=${updated.partName}`);

    // ── o) updatePart rejects stockCount (Zod) ───────────────────────────────

    const stockCountParse = UpdatePartSchema.safeParse({ stockCount: 10 });
    if (stockCountParse.success) throw new Error("UpdatePartSchema should reject stockCount");
    console.log(`o) UpdatePartSchema rejects stockCount: correct (${stockCountParse.error.issues.length} issue(s))`);

    // ── p) updatePart rejects inventoryLocation (Zod) ────────────────────────

    const inventoryParse = UpdatePartSchema.safeParse({ inventoryLocation: "BIN-1" });
    if (inventoryParse.success) throw new Error("UpdatePartSchema should reject inventoryLocation");
    console.log(`p) UpdatePartSchema rejects inventoryLocation: correct`);

    // ── q) updateStockCount ───────────────────────────────────────────────────

    const stockUpdated = await updateStockCount(partA.partId, { stockCount: 25 }, USER_ID);
    if (stockUpdated.stockCount !== 25) throw new Error(`Expected stockCount=25, got ${stockUpdated.stockCount}`);

    const auditLog = await prisma.auditLog.findFirst({
      where: { entityType: "Part", entityId: partA.partId },
      include: { action: { select: { actionName: true } } },
      orderBy: { timestamp: "desc" },
    });
    if (auditLog?.action.actionName !== "StockCountUpdated") {
      throw new Error(`Expected AuditAction StockCountUpdated, got ${auditLog?.action.actionName}`);
    }
    console.log(`q) updateStockCount: stockCount=${stockUpdated.stockCount}, AuditAction=StockCountUpdated`);

    // ── r) updateInventoryLocation ────────────────────────────────────────────

    const locationUpdated = await updateInventoryLocation(partA.partId, { inventoryLocation: "BIN-TEST-001" }, USER_ID);
    if (locationUpdated.inventoryLocation !== "BIN-TEST-001") throw new Error("Expected location BIN-TEST-001");
    console.log(`r) updateInventoryLocation: inventoryLocation=${locationUpdated.inventoryLocation}`);

    // ── s) updateInventoryLocation duplicate — succeeds (no unique constraint) ──
    // The @unique constraint was removed; duplicates are allowed and surfaced via
    // UI confirmation dialog rather than rejected at the DB layer.

    await updateInventoryLocation(partB.partId, { inventoryLocation: "BIN-TEST-002" }, USER_ID);

    const dupLocation = await updateInventoryLocation(partA.partId, { inventoryLocation: "BIN-TEST-002" }, USER_ID);
    if (dupLocation.inventoryLocation !== "BIN-TEST-002") throw new Error("Expected duplicate location assignment to succeed");
    console.log(`s) updateInventoryLocation duplicate: both parts now share BIN-TEST-002 (expected — constraint removed)`);

    // ── t) deactivatePart ─────────────────────────────────────────────────────

    const deactivated = await deactivatePart(partA.partId, USER_ID);
    if (deactivated.isActive !== false) throw new Error("Expected isActive=false");
    console.log(`t) deactivatePart: isActive=${deactivated.isActive}`);

    // ── u) deactivatePart again → PartAlreadyInactiveError ───────────────────

    await assertThrows(
      () => deactivatePart(partA.partId, USER_ID),
      PartAlreadyInactiveError,
      "u) Double deactivate"
    );

    // ── v) reactivatePart ─────────────────────────────────────────────────────

    const reactivated = await reactivatePart(partA.partId, USER_ID);
    if (reactivated.isActive !== true) throw new Error("Expected isActive=true");
    console.log(`v) reactivatePart: isActive=${reactivated.isActive}`);

    console.log("\nAll verification steps passed.");
  } finally {
    // Reactivate anything left deactivated
    if (vendorDeactivatedForTest && testVendorId !== null) {
      await prisma.vendor.update({ where: { vendorId: testVendorId }, data: { isActive: true } });
    }
    if (materialSpecDeactivatedForTest && testMaterialSpecId !== null) {
      await prisma.materialSpec.update({ where: { materialSpecId: testMaterialSpecId }, data: { isActive: true } });
    }

    // Delete created Parts
    for (const partId of createdPartIds) {
      await prisma.part.delete({ where: { partId } }).catch(() => {});
    }
    console.log(`\nCleanup: deleted ${createdPartIds.length} test part(s)`);

    // Delete test vendor and material spec
    if (testVendorId !== null) {
      await prisma.vendor.delete({ where: { vendorId: testVendorId } }).catch(() => {});
    }
    if (testMaterialSpecId !== null) {
      await prisma.materialSpec.delete({ where: { materialSpecId: testMaterialSpecId } }).catch(() => {});
    }

    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
