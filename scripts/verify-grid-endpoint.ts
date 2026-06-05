/**
 * Verification script for queryPartsGrid.
 * Run with: npx tsx scripts/verify-grid-endpoint.ts
 *
 * Creates its own fixture Parts (and one fixture routing template) at the
 * start and deletes them in a finally block. Relies only on seed Users
 * and ProcessTypes.
 *
 * Calls the service layer directly. The route handler is verified separately
 * via the manual smoke commands at the bottom of this file.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  createPart,
  deactivatePart,
  updateStockCount,
  queryPartsGrid,
} from "../lib/parts/service";
import { createRoutingTemplate } from "../lib/routing-templates/service";
import { ViewNotFoundError } from "../lib/errors/index";
import type { PartRow } from "../lib/parts/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function assertThrows(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: never[]) => Error,
  label: string
) {
  try {
    await fn();
    console.error(`  ✗ ${label} — expected ${ErrorClass.name} but no error thrown`);
    failed++;
  } catch (err) {
    if (err instanceof ErrorClass) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label} — wrong error type: ${String(err)}`);
      failed++;
    }
  }
}

async function main() {
  // ── Seed lookups ─────────────────────────────────────────────────────────────

  const seedUser = await prisma.user.findFirst({ where: { isActive: true } });
  if (!seedUser) throw new Error("No active User found — run prisma db seed first");

  const seedProcessType = await prisma.processType.findFirst();
  if (!seedProcessType) throw new Error("No ProcessType found — run prisma db seed first");

  const userId = seedUser.userId;

  // Resolve view IDs from names so the script is seed-order-independent.
  const views = await prisma.view.findMany({
    select: { viewId: true, name: true },
  });
  const viewId = (name: string) => {
    const v = views.find((r) => r.name === name);
    if (!v) throw new Error(`Seed view "${name}" not found — run prisma db seed first`);
    return v.viewId;
  };

  // ── Idempotent pre-run cleanup ───────────────────────────────────────────────
  // Remove any fixture residuals left by a prior aborted run so this run starts
  // from a known-clean state. Errors here are suppressed — missing records are fine.
  const staleTemplate = await prisma.routingTemplateDefinition.findFirst({
    where: { templateName: "__VGRID_TEST_TEMPLATE__" },
  });
  if (staleTemplate) {
    await prisma.routingTemplateStep.deleteMany({
      where: { routingTemplateDefinitionId: staleTemplate.routingTemplateDefinitionId },
    });
    await prisma.routingTemplateDefinition.delete({
      where: { routingTemplateDefinitionId: staleTemplate.routingTemplateDefinitionId },
    });
  }
  await prisma.part.deleteMany({
    where: { partNumber: { in: ["VGRID-TEST-001", "VGRID-TEST-002", "VGRID-TEST-003", "VGRID-TEST-004"] } },
  });

  // ── Fixture setup ─────────────────────────────────────────────────────────────
  // One routing template + four Parts owned by this script.
  //   p1: active, with routing template, stockCount=10
  //   p2: active, no routing template, stockCount=5
  //   p3: active, with routing template, stockCount=0
  //   p4: inactive, stockCount=100
  //
  // Cleanup order in finally: Parts first (FK dep on template), then template.

  let fixtureTemplateId: number | null = null;
  const fixtures: PartRow[] = [];

  try {
    const templateResult = await createRoutingTemplate(
      {
        templateName: "__VGRID_TEST_TEMPLATE__",
        steps: [{ stepIndex: 1, processTypeId: seedProcessType.processTypeId }],
      },
      userId
    );
    fixtureTemplateId = templateResult.template.routingTemplateDefinitionId;

    const p1 = await createPart(
      {
        partNumber: "VGRID-TEST-001",
        partName: "Grid Verify Part 1",
        partType: "Part",
        routingTemplateDefinitionId: fixtureTemplateId,
      },
      userId
    );
    await updateStockCount(p1.partId, { stockCount: 10 }, userId);
    fixtures.push(p1);

    const p2 = await createPart(
      { partNumber: "VGRID-TEST-002", partName: "Grid Verify Part 2", partType: "Part" },
      userId
    );
    await updateStockCount(p2.partId, { stockCount: 5 }, userId);
    fixtures.push(p2);

    const p3 = await createPart(
      {
        partNumber: "VGRID-TEST-003",
        partName: "Grid Verify Part 3",
        partType: "Part",
        routingTemplateDefinitionId: fixtureTemplateId,
      },
      userId
    );
    await updateStockCount(p3.partId, { stockCount: 0 }, userId);
    fixtures.push(p3);

    const p4Raw = await createPart(
      { partNumber: "VGRID-TEST-004", partName: "Grid Verify Part 4 Inactive", partType: "Part" },
      userId
    );
    await updateStockCount(p4Raw.partId, { stockCount: 100 }, userId);
    await deactivatePart(p4Raw.partId, userId);
    fixtures.push(p4Raw);

    // ── viewId-driven queries ─────────────────────────────────────────────────

    console.log("\n── viewId-driven queries ────────────────────────────────────────\n");

    // 1. Master View — no filters, default sort (partNumber asc); returns all active parts.
    const masterRows = await queryPartsGrid({ viewId: viewId("Master View") });
    assert(masterRows.length >= 3, "Master View: returns at least 3 active fixture rows");
    assert(
      masterRows.every((r) => r.isActive),
      "Master View: default activeFilter hides inactive parts"
    );
    assert(
      masterRows.length < 2 || masterRows[0]!.partNumber <= masterRows[1]!.partNumber,
      "Master View: sorted by partNumber asc (default)"
    );

    // 2. Inventory Check — isActive=true filter, sort by stockCount asc.
    const inventoryRows = await queryPartsGrid({ viewId: viewId("Inventory Check") });
    assert(inventoryRows.every((r) => r.isActive), "Inventory Check: isActive filter applied");
    // Fixture stock counts: VGRID-TEST-003=0, VGRID-TEST-002=5, VGRID-TEST-001=10.
    // Filter to fixture rows only and verify ascending order.
    const fixtureInventory = inventoryRows.filter((r) =>
      [p1.partId, p2.partId, p3.partId].includes(r.partId)
    );
    assert(
      fixtureInventory.length === 3 &&
        (fixtureInventory[0]!.stockCount ?? 0) <= (fixtureInventory[1]!.stockCount ?? 0) &&
        (fixtureInventory[1]!.stockCount ?? 0) <= (fixtureInventory[2]!.stockCount ?? 0),
      "Inventory Check: fixture rows sorted by stockCount asc (0, 5, 10)"
    );

    // 3. No Routing Flagged — parts with null routingTemplateDefinitionId.
    //    p2 (no template) must be present; p1 and p3 (have template) must be absent.
    const noRoutingRows = await queryPartsGrid({ viewId: viewId("No Routing Flagged") });
    assert(
      noRoutingRows.every((r) => r.routingTemplateDefinitionId === null),
      "No Routing Flagged: all returned rows have null routing template"
    );
    assert(
      noRoutingRows.some((r) => r.partId === p2.partId) &&
        !noRoutingRows.some((r) => r.partId === p1.partId) &&
        !noRoutingRows.some((r) => r.partId === p3.partId),
      "No Routing Flagged: p2 present, p1 and p3 absent"
    );

    // 4. Material Audit — isActive filter applied.
    const materialRows = await queryPartsGrid({ viewId: viewId("Material Audit") });
    assert(materialRows.every((r) => r.isActive), "Material Audit: isActive filter applied");

    // 5. Part Identification — no additional filters beyond activeFilter default.
    const identRows = await queryPartsGrid({ viewId: viewId("Part Identification") });
    assert(identRows.length >= 3, "Part Identification: returns fixture rows");

    console.log("\n── Ad-hoc filter and sort queries ──────────────────────────────\n");

    // 6. Ad-hoc filter: partNumber contains "VGRID-TEST" → exactly 3 active rows
    //    (the 3 active fixtures; p4 inactive is hidden by default activeFilter=true).
    const filteredRows = await queryPartsGrid({
      filters: [{ column: "partNumber", operator: "contains", value: "VGRID-TEST" }],
      sort: [],
    });
    assert(
      filteredRows.length === 3 && filteredRows.every((r) => r.partNumber.includes("VGRID-TEST")),
      `Ad-hoc filter: partNumber contains "VGRID-TEST" → exactly 3 active rows`
    );

    // 7. Ad-hoc multi-column sort: partType asc, partNumber desc.
    const sortedRows = await queryPartsGrid({
      filters: [],
      sort: [
        { column: "partType", direction: "asc" },
        { column: "partNumber", direction: "desc" },
      ],
    });
    assert(sortedRows.length >= 3, "Ad-hoc multi-column sort: query executes and returns rows");

    // 8. activeFilter overlay: "all" returns both active and inactive parts.
    const allActiveFilter = await queryPartsGrid({
      viewId: viewId("Master View"),
      activeFilter: "all",
    });
    const defaultActiveFilter = await queryPartsGrid({ viewId: viewId("Master View") });
    assert(
      allActiveFilter.length >= defaultActiveFilter.length,
      "activeFilter=all returns >= rows vs default (true)"
    );

    // 9. activeFilter overlay: "false" returns only inactive parts (includes p4).
    const inactiveRows = await queryPartsGrid({
      filters: [],
      sort: [],
      activeFilter: "false",
    });
    assert(
      inactiveRows.every((r) => !r.isActive) &&
        inactiveRows.some((r) => r.partId === p4Raw.partId),
      "activeFilter=false: only inactive parts; fixture p4 present"
    );

    // 10. Unknown viewId → ViewNotFoundError.
    await assertThrows(
      () => queryPartsGrid({ viewId: 99999 }),
      ViewNotFoundError,
      "Unknown viewId → ViewNotFoundError"
    );

    console.log("\n── buildableCount field tests ──────────────────────────────────\n");

    // 11. Every PartRow has a buildableCount field (number | null)
    const allForBuildable = await queryPartsGrid({ filters: [], sort: [] });
    assert(
      allForBuildable.every((r) => "buildableCount" in r),
      "11. Every PartRow has buildableCount field"
    );

    // 12. Part fixture rows have buildableCount = null (Parts, not Assemblies)
    const partFixtureRows = allForBuildable.filter((r) =>
      [p1.partId, p2.partId, p3.partId].includes(r.partId)
    );
    assert(
      partFixtureRows.length === 3 && partFixtureRows.every((r) => r.buildableCount === null),
      "12. Part-type fixture rows have buildableCount = null"
    );

    // 13. Filter buildableCount num_is_empty returns only Part-type rows (not Assemblies)
    // (Parts have null buildableCount; filtering num_is_empty should exclude Assemblies)
    const emptyBuildableRows = await queryPartsGrid({
      filters: [{ column: "buildableCount", operator: "num_is_empty" }],
      sort: [],
    });
    assert(
      emptyBuildableRows.every((r) => r.buildableCount === null),
      "13. buildableCount num_is_empty returns only rows with null buildableCount"
    );

    // 14. Filter buildableCount num_is_not_empty returns only Assembly rows
    const nonEmptyBuildableRows = await queryPartsGrid({
      filters: [{ column: "buildableCount", operator: "num_is_not_empty" }],
      sort: [],
    });
    assert(
      nonEmptyBuildableRows.every((r) => r.buildableCount !== null),
      "14. buildableCount num_is_not_empty returns only rows with numeric buildableCount"
    );

    // 15. Sort by buildableCount desc: Assemblies sort before Parts (Parts have null → -1 in sort)
    // This test only checks that the sort doesn't error; correctness verified in verify-buildable-helpers.ts
    const sortedByBuildable = await queryPartsGrid({
      filters: [],
      sort: [{ column: "buildableCount", direction: "desc" }],
    });
    assert(
      Array.isArray(sortedByBuildable) && sortedByBuildable.length > 0,
      "15. Sort by buildableCount desc executes without error"
    );

    console.log("\n── materialForm and assembliesUsedInCount fields ───────────────\n");

    // 16. Every PartRow has a materialForm field (string | null)
    const allForNewFields = await queryPartsGrid({ filters: [], sort: [] });
    assert(
      allForNewFields.every((r) => "materialForm" in r),
      "16. Every PartRow has materialForm field"
    );

    // 17. Part fixtures (no materialSpec) have materialForm = null
    const partFixturesForForm = allForNewFields.filter((r) =>
      [p1.partId, p2.partId, p3.partId].includes(r.partId)
    );
    assert(
      partFixturesForForm.every((r) => r.materialForm === null),
      "17. Fixture rows with no materialSpec have materialForm = null"
    );

    // 18. Every PartRow has an assembliesUsedInCount field (number >= 0)
    assert(
      allForNewFields.every((r) => "assembliesUsedInCount" in r && typeof r.assembliesUsedInCount === "number" && r.assembliesUsedInCount >= 0),
      "18. Every PartRow has assembliesUsedInCount (number >= 0)"
    );

    // 19. Fixture Parts not used in any BOM have assembliesUsedInCount = 0
    assert(
      partFixturesForForm.every((r) => r.assembliesUsedInCount === 0),
      "19. Fixture Parts with no parent BOM edges have assembliesUsedInCount = 0"
    );

    // 20. Every PartRow has a processTypes field (string[])
    assert(
      allForNewFields.every((r) => "processTypes" in r && Array.isArray(r.processTypes)),
      "20. Every PartRow has processTypes field (string[])"
    );

    // 21. Part fixtures with routing template have processTypes.length >= 1
    const fixturesWithRouting = allForNewFields.filter((r) =>
      [p1.partId, p3.partId].includes(r.partId)
    );
    assert(
      fixturesWithRouting.every((r) => r.processTypes.length >= 1),
      "21. Fixture rows with routing template have processTypes.length >= 1"
    );

    // 22. Part fixture with no routing template has processTypes = []
    const fixtureWithoutRouting = allForNewFields.find((r) => r.partId === p2.partId);
    assert(
      fixtureWithoutRouting?.processTypes.length === 0,
      "22. Fixture row with no routing template has processTypes = []"
    );

    console.log("\n── Master View completeness ────────────────────────────────────\n");

    // 23. Master View seed includes all non-excluded columns.
    const masterView = await prisma.view.findFirst({
      where: { name: "Master View", isLocked: true },
    });
    assert(masterView !== null, "23. Master View exists and is locked");
    if (masterView) {
      const visibleCols = masterView.visibleColumns as string[];
      const expectedCols = [
        "partNumber", "partName", "partType", "procurementCategory",
        "material", "materialForm", "vendor", "vendorPartNumber",
        "routing", "buildableCount", "stockCount", "inventoryLocation",
        "stockSize", "blankLength", "partCost", "partCostUpdatedAt",
        "assembliesUsedInCount", "machineCycleTime", "numberOfSetups",
        "isActive",
      ];
      assert(
        visibleCols.length === expectedCols.length,
        `23a. Master View has ${expectedCols.length} columns (has ${visibleCols.length})`
      );
      for (const col of expectedCols) {
        assert(
          visibleCols.includes(col),
          `23b. Master View includes column: ${col}`
        );
      }
    }

    console.log("\n── Regression: prior verification scripts ──────────────────────\n");
    console.log("  Run the following to confirm no regressions:");
    console.log("  npx tsx scripts/verify-sort-builder.ts");
    console.log("  npx tsx scripts/verify-filter-builder.ts");
    console.log("  npx tsx scripts/verify-part-service.ts");

    console.log(`\n── Results: ${passed} passed, ${failed} failed ─────────────────────\n`);

    console.log("── Manual smoke (dev server must be running) ───────────────────\n");
    console.log(`  POST /api/v1/parts/grid  { "viewId": ${viewId("Master View")} }  → 200 PartRow[]`);
    console.log(`  POST /api/v1/parts/grid  { "viewId": ${viewId("Inventory Check")} }  → 200 sorted by stockCount`);
    console.log(`  POST /api/v1/parts/grid  { "viewId": 9999 }  → 404 VIEW_NOT_FOUND`);
    console.log(`  POST /api/v1/parts/grid  {}  → 400 VALIDATION_ERROR`);
    console.log(`  POST /api/v1/parts/grid  { "filters": [], "sort": [] }  → 200 active parts`);

    if (failed > 0) process.exit(1);
  } finally {
    // Delete Parts before template (FK dependency). Log but do not re-throw so
    // a partial cleanup doesn't mask the original failure.
    for (const part of [...fixtures].reverse()) {
      try {
        await prisma.part.delete({ where: { partId: part.partId } });
      } catch (err) {
        console.error(`Failed to clean up fixture ${part.partNumber}:`, err);
      }
    }
    if (fixtureTemplateId !== null) {
      try {
        await prisma.routingTemplateStep.deleteMany({
          where: { routingTemplateDefinitionId: fixtureTemplateId },
        });
        await prisma.routingTemplateDefinition.delete({
          where: { routingTemplateDefinitionId: fixtureTemplateId },
        });
      } catch (err) {
        console.error("Failed to clean up fixture routing template:", err);
      }
    }
    console.log(`\nCleanup: deleted ${fixtures.length} fixture part(s) and routing template`);
  }
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
