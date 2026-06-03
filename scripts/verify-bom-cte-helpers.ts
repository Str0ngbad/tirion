/**
 * Verification script for the BOM CTE helpers and validation wrappers.
 * Run with: npx tsx scripts/verify-bom-cte-helpers.ts
 *
 * Creates its own test data (assemblies, parts, BOM edges) and cleans up
 * in a finally block. No reliance on seeded BOM data.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  detectCycle,
  getMaxAncestorDepth,
  getMaxDescendantDepth,
} from "../lib/bom/cte-helpers";
import { validateNoCycle, validateDepthLimit, BOM_DEPTH_HARD_LIMIT } from "../lib/bom/validate";
import { BomCycleError, BomDepthExceededError } from "../lib/errors/index";

const P = "__cte_";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function assertThrows<E>(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: never[]) => E,
  label: string,
): Promise<E> {
  try {
    await fn();
    throw new Error(`Expected ${ErrorClass.name} but no error was thrown — ${label}`);
  } catch (err) {
    if (err instanceof ErrorClass) return err;
    throw err;
  }
}

// Created part IDs — tracked for cleanup
const createdPartIds: number[] = [];
const createdBomIds: number[] = [];

async function mkAssembly(suffix: string) {
  const p = await prisma.part.create({
    data: { partNumber: `${P}assy_${suffix}`, partName: `CTE Assy ${suffix}`, partType: "Assembly" },
  });
  createdPartIds.push(p.partId);
  return p;
}

async function mkPart(suffix: string) {
  const p = await prisma.part.create({
    data: { partNumber: `${P}part_${suffix}`, partName: `CTE Part ${suffix}`, partType: "Part" },
  });
  createdPartIds.push(p.partId);
  return p;
}

async function mkEdge(parentPartId: number, childPartId: number, qty = 1) {
  const edge = await prisma.bOM.create({ data: { parentPartId, childPartId, quantity: qty } });
  createdBomIds.push(edge.bomId);
  return edge;
}

async function main() {
  // ── Build test fixtures ────────────────────────────────────────────────────
  //
  // Chain A→B→C (A, B are assemblies; C is a leaf part)
  // Unrelated pair: X (assembly, no edges), Y (part, no edges)
  //
  const a = await mkAssembly("a");
  const b = await mkAssembly("b");
  const c = await mkPart("c");
  const x = await mkAssembly("x");
  const y = await mkPart("y");

  await mkEdge(a.partId, b.partId);
  await mkEdge(b.partId, c.partId);

  // ── 1. Leaf Part (c, no descendants) → detectCycle(a, c) returns null ─────
  const r1 = await detectCycle(prisma, a.partId, y.partId);
  assert(r1 === null, "1: unrelated leaf should not cycle");
  console.log("1. No cycle for unrelated parts: PASS");

  // ── 2. Two unrelated assemblies → detectCycle(X, A) returns null ──────────
  const r2 = await detectCycle(prisma, x.partId, a.partId);
  assert(r2 === null, "2: unrelated assemblies should not cycle");
  console.log("2. No cycle for unrelated assemblies: PASS");

  // ── 3. Reverse of existing edge → detectCycle(b, a) detects cycle ─────────
  // A→B exists; trying to add B→A should detect cycle
  const r3 = await detectCycle(prisma, b.partId, a.partId);
  assert(r3 !== null, "3: reverse edge should cycle");
  assert(r3!.includes(a.partId), "3: cycle chain should include a");
  assert(r3!.includes(b.partId), "3: cycle chain should include b");
  console.log("3. Reverse edge cycle detected, chain:", r3, "PASS");

  // ── 4. Multi-step cycle: A→B→C; try to add C→A ───────────────────────────
  const r4 = await detectCycle(prisma, c.partId, a.partId);
  assert(r4 !== null, "4: C→A would cycle with A→B→C");
  assert(r4![0] === c.partId, "4: chain starts at parentPartId (c)");
  assert(r4![r4!.length - 1] === c.partId, "4: chain ends at parentPartId (c)");
  assert(r4!.includes(a.partId), "4: chain contains a");
  assert(r4!.includes(b.partId), "4: chain contains b");
  console.log("4. Multi-step cycle chain:", r4, "PASS");

  // ── 5. Self-reference: detectCycle(a, a) returns non-null ─────────────────
  // In the service, BomSelfReferenceError is thrown before this is called.
  // Verifying CTE behavior anyway for correctness.
  const r5 = await detectCycle(prisma, a.partId, a.partId);
  assert(r5 !== null, "5: self-reference should return non-null");
  console.log("5. Self-reference returns:", r5, "PASS");

  // ── 6. Root part → getMaxAncestorDepth returns 1 ─────────────────────────
  const d6 = await getMaxAncestorDepth(prisma, a.partId);
  assert(d6 === 1, `6: a has no ancestors, expected 1, got ${d6}`);
  console.log("6. Root ancestor depth = 1: PASS");

  // ── 7. Child with one parent → getMaxAncestorDepth returns 2 ─────────────
  const d7 = await getMaxAncestorDepth(prisma, b.partId);
  assert(d7 === 2, `7: b has one ancestor (a), expected 2, got ${d7}`);
  console.log("7. One-parent ancestor depth = 2: PASS");

  // ── 8. Depth-3 chain: add D→A edge so depth-3 ancestor chain exists ───────
  // Build: D→A→B; D is new root, A is depth 2 from D, B is depth 3 from D
  const d = await mkAssembly("d");
  await mkEdge(d.partId, a.partId);
  const d8 = await getMaxAncestorDepth(prisma, b.partId);
  assert(d8 === 3, `8: b is depth 3 from d, expected 3, got ${d8}`);
  console.log("8. 3-level ancestor depth = 3: PASS");

  // ── 9. Leaf part (c) → getMaxDescendantDepth returns 1 ───────────────────
  const d9 = await getMaxDescendantDepth(prisma, c.partId);
  assert(d9 === 1, `9: c has no descendants, expected 1, got ${d9}`);
  console.log("9. Leaf descendant depth = 1: PASS");

  // ── 10. Assembly b (b→c) → getMaxDescendantDepth returns 2 ───────────────
  const d10 = await getMaxDescendantDepth(prisma, b.partId);
  assert(d10 === 2, `10: b→c, expected 2, got ${d10}`);
  console.log("10. One-child descendant depth = 2: PASS");

  // ── 11. Assembly a (a→b→c) → getMaxDescendantDepth returns 3 ─────────────
  const d11 = await getMaxDescendantDepth(prisma, a.partId);
  assert(d11 === 3, `11: a→b→c, expected 3, got ${d11}`);
  console.log("11. Two-level descendant depth = 3: PASS");

  // ── Validate wrappers ─────────────────────────────────────────────────────

  // 12. validateNoCycle passes for a new unrelated edge
  await validateNoCycle(prisma, x.partId, y.partId);
  console.log("12. validateNoCycle passes for unrelated edge: PASS");

  // 13. validateNoCycle throws for cycle
  const err13 = await assertThrows(
    () => validateNoCycle(prisma, b.partId, a.partId),
    BomCycleError,
    "13: reverse edge should throw BomCycleError",
  );
  assert(err13.details.cycleChain !== undefined, "13: cycleChain present in error details");
  console.log("13. validateNoCycle throws BomCycleError with chain:", (err13.details as { cycleChain: number[] }).cycleChain, "PASS");

  // 14. Depth limit: build a chain of 8 and test that adding a 9th throws
  //
  // Build chain: e1→e2→e3→e4→e5→e6→e7→e8 (depth 8)
  // Then try to add e0→e1 (would make depth 9 via e0→e1→...→e8)
  //
  const chain: Array<{ partId: number }> = [];
  for (let i = 1; i <= 8; i++) {
    chain.push(await mkAssembly(`e${i}`));
  }
  for (let i = 0; i < chain.length - 1; i++) {
    await mkEdge(chain[i]!.partId, chain[i + 1]!.partId);
  }
  // chain[0] is depth 8 from chain[7]. Add a root: e0→chain[0]
  const e0 = await mkAssembly("e0");
  // validateDepthLimit: e0 (depth 1) + chain[0]..chain[7] (depth 8) = 9 > 8
  const err14 = await assertThrows(
    () => validateDepthLimit(prisma, e0.partId, chain[0]!.partId),
    BomDepthExceededError,
    "14: 9-level chain should throw BomDepthExceededError",
  );
  assert(
    (err14.details as { computedDepth: number }).computedDepth > BOM_DEPTH_HARD_LIMIT,
    "14: computedDepth exceeds hard limit",
  );
  console.log(
    `14. Depth limit throws BomDepthExceededError (computed=${(err14.details as { computedDepth: number }).computedDepth}, limit=${BOM_DEPTH_HARD_LIMIT}): PASS`,
  );

  // 15. validateDepthLimit passes at exactly the limit
  // chain[0]→chain[7] is depth 8. Adding another child to chain[7] (a leaf at depth 1)
  // = 8 + 1 = 9? No: getMaxAncestorDepth(chain[7]) = 8; getMaxDescendantDepth(new leaf) = 1; 8+1=9 > 8.
  // So test: adding a child to chain[6] (depth 7 from root + 1 self = 7 ancestors)
  // chain[6]→chain[7] already exists. Try validateDepthLimit(chain[6], new leaf)
  // getMaxAncestorDepth(chain[6]) = 7; getMaxDescendantDepth(new_leaf) = 1; sum = 8 = limit → PASS
  const leafForDepthTest = await mkPart("depth_leaf");
  await validateDepthLimit(prisma, chain[6]!.partId, leafForDepthTest.partId);
  console.log("15. validateDepthLimit passes at exactly depth 8: PASS");

  console.log("\nAll 15 CTE helper verification cases passed.");
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    console.log("\nCleaning up test data...");
    if (createdBomIds.length) {
      await prisma.bOM.deleteMany({ where: { bomId: { in: createdBomIds } } });
    }
    if (createdPartIds.length) {
      await prisma.part.deleteMany({ where: { partId: { in: createdPartIds } } });
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  });
