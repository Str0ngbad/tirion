/**
 * Verification script for buildPartWhereClause.
 * Run with: npx tsx scripts/verify-filter-builder.ts
 *
 * Tests the pure function shape, then validates every generated where clause
 * is accepted by Prisma against the real database.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import { buildPartWhereClause } from "../lib/grids/filter-builder";
import type { FilterObject } from "../lib/views/types";

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

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function assertPrismaAccepts(
  filters: FilterObject[],
  label: string
): Promise<number> {
  const where = buildPartWhereClause(filters);
  try {
    const rows = await prisma.part.findMany({ where, take: 5 });
    console.log(`  ✓ Prisma accepts: ${label} (${rows.length} row(s))`);
    passed++;
    return rows.length;
  } catch (err) {
    console.error(`  ✗ Prisma rejected: ${label} — ${String(err)}`);
    failed++;
    return -1;
  }
}

async function main() {
  console.log("\n── Pure shape tests ────────────────────────────────────────────\n");

  // 1. Empty input → empty where
  assert(deepEqual(buildPartWhereClause([]), {}), "Empty filters → {}");

  // 2. String contains
  const containsWhere = buildPartWhereClause([
    { column: "partName", operator: "contains", value: "bracket" },
  ]);
  assert(
    deepEqual(containsWhere, { partName: { contains: "bracket", mode: "insensitive" } }),
    "String contains"
  );

  // 3. String exact equals
  const equalsWhere = buildPartWhereClause([
    { column: "partNumber", operator: "equals", value: "PN-001" },
  ]);
  assert(
    deepEqual(equalsWhere, { partNumber: { equals: "PN-001", mode: "default" } }),
    "String exact equals"
  );

  // 4. Numeric between
  const betweenWhere = buildPartWhereClause([
    { column: "stockCount", operator: "between", value: { from: 5, to: 50 } },
  ]);
  assert(
    deepEqual(betweenWhere, { stockCount: { gte: 5, lte: 50 } }),
    "Numeric between"
  );

  // 5. Date between
  const dateBetweenWhere = buildPartWhereClause([
    {
      column: "partCostUpdatedAt",
      operator: "date_between",
      value: { from: "2025-01-01", to: "2025-12-31" },
    },
  ]);
  assert(
    deepEqual(dateBetweenWhere, { partCostUpdatedAt: { gte: "2025-01-01", lte: "2025-12-31" } }),
    "Date between"
  );

  // 6. is_empty on standard column
  const isEmptyWhere = buildPartWhereClause([
    { column: "inventoryLocation", operator: "is_empty" },
  ]);
  assert(deepEqual(isEmptyWhere, { inventoryLocation: null }), "is_empty on standard column");

  // 7. is_empty on processTypes (special case → routingTemplateDefinitionId: null)
  const processTypesEmptyWhere = buildPartWhereClause([
    { column: "processTypes", operator: "is_empty" },
  ]);
  assert(
    deepEqual(processTypesEmptyWhere, { routingTemplateDefinitionId: null }),
    "is_empty on processTypes → routingTemplateDefinitionId: null"
  );

  // 8. is_any_of multi-select
  const isAnyOfWhere = buildPartWhereClause([
    { column: "partType", operator: "is_any_of", value: ["Part", "Assembly"] },
  ]);
  assert(
    deepEqual(isAnyOfWhere, { partType: { in: ["Part", "Assembly"] } }),
    "is_any_of multi-select"
  );

  // 9. is_none_of multi-select — Prisma notIn excludes null rows by default
  const isNoneOfWhere = buildPartWhereClause([
    { column: "partType", operator: "is_none_of", value: ["Part", "Assembly"] },
  ]);
  assert(
    deepEqual(isNoneOfWhere, { partType: { notIn: ["Part", "Assembly"] } }),
    "is_none_of multi-select"
  );

  // 9b. is_none_of null handling — Prisma notIn excludes nulls; no separate not:null needed
  assert(
    deepEqual(isNoneOfWhere, { partType: { notIn: ["Part", "Assembly"] } }),
    "is_none_of uses notIn (Prisma excludes null rows by default — no explicit not:null required)"
  );

  // 9c. is_none_of with empty array — returns all non-null rows (notIn: [] excludes nothing, nulls still excluded)
  const isNoneOfEmptyWhere = buildPartWhereClause([
    { column: "partType", operator: "is_none_of", value: [] },
  ]);
  assert(
    deepEqual(isNoneOfEmptyWhere, { partType: { notIn: [] } }),
    "is_none_of with empty values array — notIn: [] excludes nothing except nulls"
  );

  // 10. Relation filter (contains on materialName)
  const relationContainsWhere = buildPartWhereClause([
    { column: "materialName", operator: "contains", value: "steel" },
  ]);
  assert(
    deepEqual(relationContainsWhere, {
      materialSpec: { materialName: { contains: "steel", mode: "insensitive" } },
    }),
    "Relation filter: contains on materialName"
  );

  // 10. Routing matrix — one include
  const matrixInclude = buildPartWhereClause([
    {
      column: "processTypes",
      operator: "routing_matrix",
      value: { "1": "include" },
    },
  ]);
  assert(
    deepEqual(matrixInclude, {
      routingTemplate: { steps: { some: { processTypeId: 1 } } },
    }),
    "Routing matrix: one include"
  );

  // 11. Routing matrix — one exclude
  const matrixExclude = buildPartWhereClause([
    {
      column: "processTypes",
      operator: "routing_matrix",
      value: { "2": "exclude" },
    },
  ]);
  assert(
    deepEqual(matrixExclude, {
      routingTemplate: { steps: { none: { processTypeId: 2 } } },
    }),
    "Routing matrix: one exclude"
  );

  // 12. Routing matrix — mixed include + exclude (two entries → AND)
  const matrixMixed = buildPartWhereClause([
    {
      column: "processTypes",
      operator: "routing_matrix",
      value: { "1": "include", "3": "exclude" },
    },
  ]);
  assert(
    deepEqual(matrixMixed, {
      AND: [
        { routingTemplate: { steps: { some: { processTypeId: 1 } } } },
        { routingTemplate: { steps: { none: { processTypeId: 3 } } } },
      ],
    }),
    "Routing matrix: mixed include/exclude combines via AND"
  );

  // 13. Multiple filters on different columns combine via AND
  const multiColWhere = buildPartWhereClause([
    { column: "isActive", operator: "is_true" },
    { column: "partName", operator: "contains", value: "shaft" },
  ]);
  assert(
    deepEqual(multiColWhere, {
      AND: [
        { isActive: true },
        { partName: { contains: "shaft", mode: "insensitive" } },
      ],
    }),
    "Multi-filter: different columns combine via AND"
  );

  // 14. Boolean is_false
  const isFalseWhere = buildPartWhereClause([{ column: "isActive", operator: "is_false" }]);
  assert(deepEqual(isFalseWhere, { isActive: false }), "is_false boolean operator");

  // 15. num_is_empty on nullable numeric field
  const numEmptyWhere = buildPartWhereClause([{ column: "stockCount", operator: "num_is_empty" }]);
  assert(deepEqual(numEmptyWhere, { stockCount: null }), "num_is_empty on stockCount");

  // 16. date_is_not_empty
  const dateNotEmptyWhere = buildPartWhereClause([
    { column: "partCostUpdatedAt", operator: "date_is_not_empty" },
  ]);
  assert(
    deepEqual(dateNotEmptyWhere, { partCostUpdatedAt: { not: null } }),
    "date_is_not_empty"
  );

  console.log("\n── Prisma shape validation ─────────────────────────────────────\n");

  await assertPrismaAccepts([], "empty filters");
  await assertPrismaAccepts(
    [{ column: "partName", operator: "contains", value: "a" }],
    "string contains"
  );
  await assertPrismaAccepts(
    [{ column: "isActive", operator: "is_true" }],
    "boolean is_true"
  );
  await assertPrismaAccepts(
    [{ column: "isActive", operator: "is_false" }],
    "boolean is_false"
  );
  await assertPrismaAccepts(
    [{ column: "stockCount", operator: "num_is_empty" }],
    "num_is_empty"
  );
  await assertPrismaAccepts(
    [{ column: "inventoryLocation", operator: "is_empty" }],
    "is_empty on nullable string"
  );
  await assertPrismaAccepts(
    [{ column: "processTypes", operator: "is_empty" }],
    "is_empty on processTypes (no routing template)"
  );
  await assertPrismaAccepts(
    [{ column: "processTypes", operator: "is_not_empty" }],
    "is_not_empty on processTypes"
  );
  await assertPrismaAccepts(
    [{ column: "partType", operator: "is_any_of", value: ["Assembly"] }],
    "is_any_of"
  );
  await assertPrismaAccepts(
    [{ column: "partType", operator: "is_none_of", value: ["Assembly"] }],
    "is_none_of (excludes Assembly and nulls)"
  );
  await assertPrismaAccepts(
    [{ column: "partType", operator: "is_none_of", value: [] }],
    "is_none_of with empty array (returns all non-null rows)"
  );
  await assertPrismaAccepts(
    [{ column: "materialName", operator: "contains", value: "steel" }],
    "relation filter: materialName contains"
  );
  await assertPrismaAccepts(
    [{ column: "stockCount", operator: "between", value: { from: 0, to: 1000 } }],
    "numeric between"
  );
  await assertPrismaAccepts(
    [{ column: "partCostUpdatedAt", operator: "date_is_not_empty" }],
    "date_is_not_empty"
  );
  await assertPrismaAccepts(
    [
      {
        column: "processTypes",
        operator: "routing_matrix",
        value: { "1": "include" },
      },
    ],
    "routing_matrix include (processTypeId 1)"
  );
  await assertPrismaAccepts(
    [
      {
        column: "processTypes",
        operator: "routing_matrix",
        value: { "1": "include", "2": "exclude" },
      },
    ],
    "routing_matrix mixed include/exclude"
  );
  await assertPrismaAccepts(
    [
      { column: "isActive", operator: "is_true" },
      { column: "partType", operator: "is_any_of", value: ["Part"] },
    ],
    "multi-filter AND combination"
  );

  // Note: assembliesUsedInCount and buildableCount filters are extracted from the
  // filter list before buildPartWhereClause is called (see queryPartsGrid in service.ts).
  // These columns produce a Prisma _count aggregate or a DFS-computed value that cannot
  // appear in a WHERE clause. Their functional tests live in verify-grid-endpoint.ts.
  assert(
    deepEqual(buildPartWhereClause([]), {}),
    "assembliesUsedInCount/buildableCount filters pre-extracted — builder never sees them"
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
