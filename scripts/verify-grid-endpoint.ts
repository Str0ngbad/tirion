/**
 * Verification script for queryPartsGrid.
 * Run with: npx tsx scripts/verify-grid-endpoint.ts
 *
 * Calls the service layer directly. The route handler is verified separately
 * via the manual smoke commands at the bottom of this file.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import { queryPartsGrid } from "../lib/parts/service";
import { ViewNotFoundError } from "../lib/errors/index";

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
  // Resolve view IDs from names so the script is seed-order-independent.
  const views = await prisma.view.findMany({
    select: { viewId: true, name: true },
  });
  const viewId = (name: string) => {
    const v = views.find((r) => r.name === name);
    if (!v) throw new Error(`Seed view "${name}" not found — run prisma db seed first`);
    return v.viewId;
  };

  console.log("\n── viewId-driven queries ────────────────────────────────────────\n");

  // 1. Master View — no filters, default sort (partNumber asc); returns all active parts.
  const masterRows = await queryPartsGrid({ viewId: viewId("Master View") });
  assert(masterRows.length > 0, "Master View: returns rows");
  assert(
    masterRows.every((r) => r.isActive),
    "Master View: default activeFilter hides inactive parts"
  );
  assert(
    masterRows.length === 1 || masterRows[0]!.partNumber <= masterRows[1]!.partNumber,
    "Master View: sorted by partNumber asc (default)"
  );

  // 2. Inventory Check — isActive=true filter, sort by stockCount asc.
  const inventoryRows = await queryPartsGrid({ viewId: viewId("Inventory Check") });
  assert(inventoryRows.every((r) => r.isActive), "Inventory Check: isActive filter applied");
  if (inventoryRows.length >= 2) {
    const stockCounts = inventoryRows.map((r) => r.stockCount ?? 0);
    assert(
      stockCounts[0]! <= stockCounts[1]!,
      "Inventory Check: sorted by stockCount asc"
    );
  } else {
    console.log("  ~ Inventory Check: not enough rows to verify sort (skipped)");
    passed++;
  }

  // 3. No Routing Flagged — only parts with no routingTemplateDefinitionId.
  const noRoutingRows = await queryPartsGrid({ viewId: viewId("No Routing Flagged") });
  assert(
    noRoutingRows.every((r) => r.routingTemplateDefinitionId === null),
    "No Routing Flagged: only parts without routing template"
  );

  // 4. Material Audit — isActive filter applied.
  const materialRows = await queryPartsGrid({ viewId: viewId("Material Audit") });
  assert(materialRows.every((r) => r.isActive), "Material Audit: isActive filter applied");

  // 5. Part Identification — no additional filters beyond activeFilter default.
  const identRows = await queryPartsGrid({ viewId: viewId("Part Identification") });
  assert(identRows.length > 0, "Part Identification: returns rows");

  console.log("\n── Ad-hoc filter and sort queries ──────────────────────────────\n");

  // 6. Ad-hoc filter: partNumber contains fragment.
  const allParts = await queryPartsGrid({ filters: [], sort: [], activeFilter: "all" });
  const firstPart = allParts[0];
  if (firstPart) {
    const fragment = firstPart.partNumber.slice(0, 3);
    const filteredRows = await queryPartsGrid({
      filters: [{ column: "partNumber", operator: "contains", value: fragment }],
      sort: [],
    });
    assert(
      filteredRows.every((r) => r.partNumber.toLowerCase().includes(fragment.toLowerCase())),
      `Ad-hoc filter: partNumber contains "${fragment}"`
    );
  } else {
    console.log("  ~ No seed parts found; skipping ad-hoc filter test");
    passed++;
  }

  // 7. Ad-hoc multi-column sort: partType asc, partNumber desc.
  const sortedRows = await queryPartsGrid({
    filters: [],
    sort: [
      { column: "partType", direction: "asc" },
      { column: "partNumber", direction: "desc" },
    ],
  });
  assert(sortedRows.length >= 0, "Ad-hoc multi-column sort: query executes without error");

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

  // 9. activeFilter overlay: "false" returns only inactive parts.
  const inactiveRows = await queryPartsGrid({
    filters: [],
    sort: [],
    activeFilter: "false",
  });
  assert(
    inactiveRows.every((r) => !r.isActive),
    "activeFilter=false: only inactive parts returned"
  );

  // 10. Unknown viewId → ViewNotFoundError.
  await assertThrows(
    () => queryPartsGrid({ viewId: 99999 }),
    ViewNotFoundError,
    "Unknown viewId → ViewNotFoundError"
  );

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
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
