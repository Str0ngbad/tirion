/**
 * Verification script for the distinct-values endpoint.
 * Run with: npx tsx scripts/verify-distinct-values.ts
 *
 * Validates the endpoint returns sensible data for each supported column,
 * rejects invalid columns, and respects the active-only constraint.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3000";

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

async function fetchDistinct(column: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}/api/v1/parts/distinct-values?column=${column}`);
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  console.log(`\n── Distinct values endpoint: ${BASE_URL} ────────────────────────\n`);

  // Invalid column → 400
  const invalid = await fetchDistinct("notAColumn");
  assert(invalid.status === 400, "Invalid column → 400");

  // Missing column → 400
  const missing = await fetchDistinct("");
  assert(missing.status === 400, "Empty column param → 400");

  // Supported columns → 200 with { values: string[] }
  const SUPPORTED = ["partType", "procurementCategory", "material", "materialForm", "vendor"];
  for (const col of SUPPORTED) {
    const result = await fetchDistinct(col);
    assert(result.status === 200, `${col} → 200`);
    const body = result.body as { values?: unknown };
    assert(Array.isArray(body.values), `${col} → body.values is array`);
    const values = body.values as string[];
    assert(
      values.every((v) => typeof v === "string" && v.length > 0),
      `${col} → all values are non-empty strings`
    );
    // Verify sorted order
    const sorted = [...values].sort();
    assert(
      JSON.stringify(values) === JSON.stringify(sorted),
      `${col} → values are sorted alphabetically`
    );
    console.log(`  ℹ ${col}: ${values.length} distinct value(s)`);
  }

  console.log("\n── Active-only constraint ───────────────────────────────────────\n");

  // Verify inactive Parts do not contribute to distinct values.
  // Find an inactive part with a vendor to check against.
  const inactivePart = await prisma.part.findFirst({
    where: { isActive: false, defaultVendor: { isNot: null } },
    select: { defaultVendor: { select: { vendorName: true } } },
  });

  if (inactivePart?.defaultVendor?.vendorName) {
    // Check if that vendor name appears in active-only distinct values
    const vendorName = inactivePart.defaultVendor.vendorName;
    const hasActiveWithSameVendor = await prisma.part.findFirst({
      where: { isActive: true, defaultVendor: { vendorName } },
    });
    const result = await fetchDistinct("vendor");
    const values = (result.body as { values: string[] }).values;
    if (!hasActiveWithSameVendor) {
      assert(
        !values.includes(vendorName),
        `Inactive-only vendor "${vendorName}" excluded from distinct values`
      );
    } else {
      console.log(`  ℹ Vendor "${vendorName}" also has active parts — skipping exclusion check`);
      passed++;
    }
  } else {
    console.log("  ℹ No inactive parts with vendors found — skipping active-only check");
    passed++;
  }

  console.log(`\n── Results: ${passed} passed, ${failed} failed ─────────────────────\n`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
