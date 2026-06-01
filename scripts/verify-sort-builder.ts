/**
 * Verification script for buildPartSortOrder.
 * Run with: npx tsx scripts/verify-sort-builder.ts
 *
 * Tests the pure function behavior then validates that each generated
 * orderBy shape is accepted by Prisma against the real database.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import { buildPartSortOrder } from "../lib/grids/sort-builder";

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

function assertThrows(fn: () => unknown, label: string) {
  try {
    fn();
    console.error(`  ✗ ${label} — expected throw but did not throw`);
    failed++;
  } catch {
    console.log(`  ✓ ${label}`);
    passed++;
  }
}

async function assertPrismaAccepts(
  orderBy: ReturnType<typeof buildPartSortOrder>,
  label: string
) {
  try {
    await prisma.part.findMany({ orderBy, take: 5 });
    console.log(`  ✓ Prisma accepts: ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ Prisma rejected: ${label} — ${String(err)}`);
    failed++;
  }
}

async function main() {
  console.log("\n── Pure function tests ─────────────────────────────────────────\n");

  // 1. Empty input → default sort
  const defaultSort = buildPartSortOrder([]);
  assert(
    JSON.stringify(defaultSort) === JSON.stringify([{ partNumber: "asc" }]),
    "Empty input → [{ partNumber: 'asc' }]"
  );

  // 2. Single scalar sort (partNumber desc)
  const scalarDesc = buildPartSortOrder([{ column: "partNumber", direction: "desc" }]);
  assert(
    JSON.stringify(scalarDesc) === JSON.stringify([{ partNumber: "desc" }]),
    "Single scalar sort: partNumber desc"
  );

  // 3. Single relation sort (materialName asc)
  const relAsc = buildPartSortOrder([{ column: "materialName", direction: "asc" }]);
  assert(
    JSON.stringify(relAsc) === JSON.stringify([{ materialSpec: { materialName: "asc" } }]),
    "Single relation sort: materialName asc"
  );

  // 4. Multi-column sort — mix of scalar and relation
  const multi = buildPartSortOrder([
    { column: "defaultVendorName", direction: "asc" },
    { column: "stockCount", direction: "desc" },
  ]);
  assert(
    JSON.stringify(multi) === JSON.stringify([
      { defaultVendor: { vendorName: "asc" } },
      { stockCount: "desc" },
    ]),
    "Multi-column sort: relation then scalar"
  );

  // 5. Multi-column sort preserves order (primary sort is first)
  const ordered = buildPartSortOrder([
    { column: "partName", direction: "asc" },
    { column: "partNumber", direction: "asc" },
  ]);
  assert(
    JSON.stringify(ordered[0]) === JSON.stringify({ partName: "asc" }) &&
      JSON.stringify(ordered[1]) === JSON.stringify({ partNumber: "asc" }),
    "Multi-column sort preserves input order"
  );

  // 6. procurementCategory alias maps correctly
  const catAlias = buildPartSortOrder([{ column: "procurementCategory", direction: "asc" }]);
  assert(
    JSON.stringify(catAlias) === JSON.stringify([{ procurementCategory: { categoryName: "asc" } }]),
    "procurementCategory column alias maps to relation"
  );

  // 7. Unknown column ID throws
  assertThrows(
    () => buildPartSortOrder([{ column: "unknownColumn", direction: "asc" }]),
    "Unknown column ID throws"
  );

  // 8. processTypes (unsortable) throws
  assertThrows(
    () => buildPartSortOrder([{ column: "processTypes", direction: "asc" }]),
    "processTypes (unsortable) throws"
  );

  console.log("\n── Prisma shape validation ─────────────────────────────────────\n");

  await assertPrismaAccepts([{ partNumber: "asc" }], "default sort");
  await assertPrismaAccepts(
    buildPartSortOrder([{ column: "partNumber", direction: "desc" }]),
    "partNumber desc"
  );
  await assertPrismaAccepts(
    buildPartSortOrder([{ column: "materialName", direction: "asc" }]),
    "materialName asc (relation)"
  );
  await assertPrismaAccepts(
    buildPartSortOrder([{ column: "defaultVendorName", direction: "asc" }]),
    "defaultVendorName asc (relation)"
  );
  await assertPrismaAccepts(
    buildPartSortOrder([{ column: "procurementCategoryName", direction: "asc" }]),
    "procurementCategoryName asc (relation)"
  );
  await assertPrismaAccepts(
    buildPartSortOrder([{ column: "routingTemplateName", direction: "desc" }]),
    "routingTemplateName desc (relation)"
  );
  await assertPrismaAccepts(
    buildPartSortOrder([{ column: "materialForm", direction: "asc" }]),
    "materialForm asc (relation)"
  );
  await assertPrismaAccepts(
    buildPartSortOrder([
      { column: "defaultVendorName", direction: "asc" },
      { column: "stockCount", direction: "desc" },
    ]),
    "multi-column: defaultVendorName asc, stockCount desc"
  );

  console.log(`\n── Results: ${passed} passed, ${failed} failed ─────────────────────\n`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
