/**
 * Verification script for the BOM service layer.
 * Run with: npx tsx scripts/verify-bom-service.ts
 *
 * Creates its own test data and cleans up in a finally block.
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import {
  getBomTree,
  createBomEdge,
  updateBomEdge,
  deleteBomEdge,
  bulkDeleteBomEdges,
} from "../lib/bom/service";
import {
  BomEdgeNotFoundError,
  BomParentInvalidError,
  BomChildInvalidError,
  BomSelfReferenceError,
  BomDuplicateChildError,
  BomCycleError,
  BomDepthExceededError,
  BomBulkDeleteInvalidError,
} from "../lib/errors/index";

const USER_ID = 1;
const P = "__svc_";

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

const createdPartIds: number[] = [];
const createdBomIds: number[] = [];

async function mkAssembly(suffix: string, isActive = true) {
  const p = await prisma.part.create({
    data: { partNumber: `${P}assy_${suffix}`, partName: `Svc Assy ${suffix}`, partType: "Assembly", isActive },
  });
  createdPartIds.push(p.partId);
  return p;
}

async function mkPart(suffix: string, isActive = true) {
  const p = await prisma.part.create({
    data: { partNumber: `${P}part_${suffix}`, partName: `Svc Part ${suffix}`, partType: "Part", isActive },
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
  // ── Build fixtures ─────────────────────────────────────────────────────────
  const rootAssy = await mkAssembly("root");
  const subAssy = await mkAssembly("sub");
  const part1 = await mkPart("p1");
  const part2 = await mkPart("p2");
  const inactivePart = await mkPart("inactive", false);
  const inactiveAssy = await mkAssembly("inactive_assy", false);
  const unrelatedPart = await mkPart("unrelated");

  // rootAssy → subAssy → part1
  //          → part2
  await mkEdge(rootAssy.partId, subAssy.partId);
  await mkEdge(subAssy.partId, part1.partId);
  await mkEdge(rootAssy.partId, part2.partId);

  // ── getBomTree ─────────────────────────────────────────────────────────────

  // 1. Fetch known assembly's tree — assert shape and sort order
  const tree1 = await getBomTree(rootAssy.partId);
  assert(tree1.partId === rootAssy.partId, "1: root partId matches");
  assert(tree1.bomId === null, "1: root has no bomId");
  assert(tree1.quantity === null, "1: root has no quantity");
  assert(tree1.children.length === 2, `1: root has 2 children, got ${tree1.children.length}`);
  // Sort: Parts before Assemblies
  assert(tree1.children[0]!.partType === "Part", "1: first child is Part");
  assert(tree1.children[1]!.partType === "Assembly", "1: second child is Assembly");
  const subNode = tree1.children.find((c) => c.partId === subAssy.partId);
  assert(subNode !== undefined, "1: subAssy found in children");
  assert(subNode!.children.length === 1, "1: subAssy has 1 child");
  console.log("1. getBomTree shape and sort: PASS");

  // 2. Fetch a Part (not an Assembly) → BomParentInvalidError reason parent_not_assembly
  const err2 = await assertThrows(
    () => getBomTree(part1.partId),
    BomParentInvalidError,
    "2: part should fail with parent_not_assembly",
  );
  assert((err2 as BomParentInvalidError).details.reason === "parent_not_assembly", "2: reason");
  console.log("2. getBomTree rejects Part (not assembly): PASS");

  // 3. Fetch nonexistent partId → BomParentInvalidError reason part_not_found
  const err3 = await assertThrows(
    () => getBomTree(999999),
    BomParentInvalidError,
    "3: nonexistent part",
  );
  assert((err3 as BomParentInvalidError).details.reason === "part_not_found", "3: reason");
  console.log("3. getBomTree rejects nonexistent part: PASS");

  // ── createBomEdge — happy paths ────────────────────────────────────────────

  // 4. Create edge between valid assembly parent and unrelated part
  const r4 = await createBomEdge(
    { parentPartId: subAssy.partId, childPartId: unrelatedPart.partId, quantity: 2.5 },
    USER_ID,
  );
  createdBomIds.push(r4.edge.bomId);
  assert(r4.edge.parentPartId === subAssy.partId, "4: parentPartId");
  assert(r4.edge.childPartId === unrelatedPart.partId, "4: childPartId");
  assert(r4.edge.quantity === 2.5, "4: quantity");
  assert(r4.flaggedWoCount === 0, "4: flaggedWoCount is 0");
  console.log("4. createBomEdge happy path: PASS");

  // ── createBomEdge — validation paths ──────────────────────────────────────

  // 5. Self-reference
  await assertThrows(
    () => createBomEdge({ parentPartId: rootAssy.partId, childPartId: rootAssy.partId, quantity: 1 }, USER_ID),
    BomSelfReferenceError,
    "5: self-reference",
  );
  console.log("5. createBomEdge self-reference: PASS");

  // 6. Parent not an Assembly
  const err6 = await assertThrows(
    () => createBomEdge({ parentPartId: part1.partId, childPartId: part2.partId, quantity: 1 }, USER_ID),
    BomParentInvalidError,
    "6: parent not assembly",
  );
  assert((err6 as BomParentInvalidError).details.reason === "parent_not_assembly", "6: reason");
  console.log("6. createBomEdge parent not assembly: PASS");

  // 7. Parent inactive
  const err7 = await assertThrows(
    () => createBomEdge({ parentPartId: inactiveAssy.partId, childPartId: part1.partId, quantity: 1 }, USER_ID),
    BomParentInvalidError,
    "7: parent inactive",
  );
  assert((err7 as BomParentInvalidError).details.reason === "part_inactive", "7: reason");
  console.log("7. createBomEdge parent inactive: PASS");

  // 8. Parent nonexistent
  const err8 = await assertThrows(
    () => createBomEdge({ parentPartId: 999999, childPartId: part1.partId, quantity: 1 }, USER_ID),
    BomParentInvalidError,
    "8: parent not found",
  );
  assert((err8 as BomParentInvalidError).details.reason === "part_not_found", "8: reason");
  console.log("8. createBomEdge parent not found: PASS");

  // 9. Child inactive
  const err9 = await assertThrows(
    () => createBomEdge({ parentPartId: rootAssy.partId, childPartId: inactivePart.partId, quantity: 1 }, USER_ID),
    BomChildInvalidError,
    "9: child inactive",
  );
  assert((err9 as BomChildInvalidError).details.reason === "part_inactive", "9: reason");
  console.log("9. createBomEdge child inactive: PASS");

  // 10. Child nonexistent
  const err10 = await assertThrows(
    () => createBomEdge({ parentPartId: rootAssy.partId, childPartId: 999999, quantity: 1 }, USER_ID),
    BomChildInvalidError,
    "10: child not found",
  );
  assert((err10 as BomChildInvalidError).details.reason === "part_not_found", "10: reason");
  console.log("10. createBomEdge child not found: PASS");

  // 11. Duplicate child
  // rootAssy → part2 already exists; try again
  await assertThrows(
    () => createBomEdge({ parentPartId: rootAssy.partId, childPartId: part2.partId, quantity: 1 }, USER_ID),
    BomDuplicateChildError,
    "11: duplicate",
  );
  console.log("11. createBomEdge duplicate child: PASS");

  // 12. Cycle: subAssy → part1 exists; try to add part1 → subAssy (but part1 is a Part, not Assembly)
  //     Use assembly-to-assembly: rootAssy → subAssy; try subAssy → rootAssy
  const err12 = await assertThrows(
    () => createBomEdge({ parentPartId: subAssy.partId, childPartId: rootAssy.partId, quantity: 1 }, USER_ID),
    BomCycleError,
    "12: cycle",
  );
  assert(Array.isArray((err12 as BomCycleError).details.cycleChain), "12: cycleChain is array");
  console.log("12. createBomEdge cycle detection:", (err12 as BomCycleError).details.cycleChain, "PASS");

  // 13. Multi-step cycle: rootAssy → subAssy → part1 (part1 is leaf, so try subAssy → rootAssy)
  //     Already covered in case 12. For multi-step, set up: A→B→C all assemblies, try C→A
  const ca = await mkAssembly("ca");
  const cb = await mkAssembly("cb");
  const cc = await mkAssembly("cc");
  const eca = await mkEdge(ca.partId, cb.partId);
  createdBomIds.push(eca.bomId); // already pushed in mkEdge but avoid double-push; mkEdge handles it
  const ecb = await mkEdge(cb.partId, cc.partId);
  const err13 = await assertThrows(
    () => createBomEdge({ parentPartId: cc.partId, childPartId: ca.partId, quantity: 1 }, USER_ID),
    BomCycleError,
    "13: multi-step cycle",
  );
  const chain13 = (err13 as BomCycleError).details.cycleChain as number[];
  assert(chain13[0] === cc.partId, "13: chain starts at cc");
  assert(chain13[chain13.length - 1] === cc.partId, "13: chain ends at cc");
  assert(chain13.includes(ca.partId), "13: chain includes ca");
  assert(chain13.includes(cb.partId), "13: chain includes cb");
  console.log("13. createBomEdge multi-step cycle:", chain13, "PASS");

  // 14. Depth limit: build an 8-level chain, try to add a 9th
  const depthChain: Array<{ partId: number }> = [];
  for (let i = 1; i <= 8; i++) depthChain.push(await mkAssembly(`depth_${i}`));
  for (let i = 0; i < depthChain.length - 1; i++) {
    await mkEdge(depthChain[i]!.partId, depthChain[i + 1]!.partId);
  }
  const depthRoot = await mkAssembly("depth_root");
  await assertThrows(
    () => createBomEdge({ parentPartId: depthRoot.partId, childPartId: depthChain[0]!.partId, quantity: 1 }, USER_ID),
    BomDepthExceededError,
    "14: depth exceeded",
  );
  console.log("14. createBomEdge depth limit: PASS");

  // ── updateBomEdge ──────────────────────────────────────────────────────────

  // 15. Normal quantity update
  const edgeToUpdate = await prisma.bOM.findFirst({ where: { parentPartId: rootAssy.partId, childPartId: part2.partId } });
  assert(edgeToUpdate !== null, "15: edge exists");
  const r15 = await updateBomEdge(edgeToUpdate!.bomId, { quantity: 5 }, USER_ID);
  assert("edge" in r15, "15: returns SaveResponse");
  assert((r15 as { edge: { quantity: number } }).edge.quantity === 5, "15: quantity updated");
  console.log("15. updateBomEdge normal update: PASS");

  // 16. quantity = 0 → deleted: true
  const edgeToZero = await prisma.bOM.findFirst({ where: { parentPartId: rootAssy.partId, childPartId: part2.partId } });
  assert(edgeToZero !== null, "16: edge still exists");
  const r16 = await updateBomEdge(edgeToZero!.bomId, { quantity: 0 }, USER_ID);
  assert("deleted" in r16 && (r16 as { deleted: boolean }).deleted === true, "16: deleted: true");
  const gone = await prisma.bOM.findUnique({ where: { bomId: edgeToZero!.bomId } });
  assert(gone === null, "16: edge actually removed from DB");
  console.log("16. updateBomEdge qty=0 removes edge: PASS");

  // 17. Update nonexistent edge
  await assertThrows(
    () => updateBomEdge(999999, { quantity: 3 }, USER_ID),
    BomEdgeNotFoundError,
    "17: update nonexistent",
  );
  console.log("17. updateBomEdge nonexistent: PASS");

  // ── deleteBomEdge ──────────────────────────────────────────────────────────

  // 18. Delete an existing edge
  const edgeToDelete = await prisma.bOM.findFirst({ where: { parentPartId: rootAssy.partId, childPartId: subAssy.partId } });
  assert(edgeToDelete !== null, "18: edge exists");
  await deleteBomEdge(edgeToDelete!.bomId, USER_ID);
  const deleted18 = await prisma.bOM.findUnique({ where: { bomId: edgeToDelete!.bomId } });
  assert(deleted18 === null, "18: edge removed");
  const auditEntry = await prisma.auditLog.findFirst({
    where: { entityType: "BOM", entityId: edgeToDelete!.bomId },
  });
  assert(auditEntry !== null, "18: audit entry written");
  console.log("18. deleteBomEdge removes edge and writes audit: PASS");

  // 19. Delete nonexistent
  await assertThrows(
    () => deleteBomEdge(999999, USER_ID),
    BomEdgeNotFoundError,
    "19: delete nonexistent",
  );
  console.log("19. deleteBomEdge nonexistent: PASS");

  // ── bulkDeleteBomEdges ─────────────────────────────────────────────────────

  // 20. Bulk delete a valid set sharing a parent
  const bulkA = await mkAssembly("bulk_parent");
  const bulkP1 = await mkPart("bulk_c1");
  const bulkP2 = await mkPart("bulk_c2");
  const bulkP3 = await mkPart("bulk_c3");
  const be1 = await mkEdge(bulkA.partId, bulkP1.partId);
  const be2 = await mkEdge(bulkA.partId, bulkP2.partId);
  const be3 = await mkEdge(bulkA.partId, bulkP3.partId);
  const r20 = await bulkDeleteBomEdges({ edgeIds: [be1.bomId, be2.bomId] }, USER_ID);
  assert(r20.deletedCount === 2, `20: deletedCount=2, got ${r20.deletedCount}`);
  const remaining = await prisma.bOM.findMany({ where: { parentPartId: bulkA.partId } });
  assert(remaining.length === 1, "20: only be3 remains");
  assert(remaining[0]!.bomId === be3.bomId, "20: be3 is the survivor");
  console.log("20. bulkDeleteBomEdges valid set: PASS");

  // 21. Bulk delete with one missing ID
  const err21 = await assertThrows(
    () => bulkDeleteBomEdges({ edgeIds: [be3.bomId, 999999] }, USER_ID),
    BomBulkDeleteInvalidError,
    "21: missing edge ID",
  );
  assert(
    ((err21 as BomBulkDeleteInvalidError).details.missingEdgeIds as number[]).includes(999999),
    "21: missingEdgeIds populated",
  );
  console.log("21. bulkDeleteBomEdges missing ID: PASS");

  // 22. Bulk delete with edges from different parents
  const bulkB = await mkAssembly("bulk_parent2");
  const bulkP4 = await mkPart("bulk_c4");
  const be4 = await mkEdge(bulkB.partId, bulkP4.partId);
  const err22 = await assertThrows(
    () => bulkDeleteBomEdges({ edgeIds: [be3.bomId, be4.bomId] }, USER_ID),
    BomBulkDeleteInvalidError,
    "22: different parents",
  );
  assert(
    ((err22 as BomBulkDeleteInvalidError).details.edgeIdsFromDifferentParents as number[]).length > 0,
    "22: edgeIdsFromDifferentParents populated",
  );
  console.log("22. bulkDeleteBomEdges different parents: PASS");

  console.log("\nAll 22 BOM service verification cases passed.");
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    console.log("\nCleaning up test data...");
    // Remove all BOM edges referencing our test parts before deleting parts
    if (createdPartIds.length) {
      await prisma.bOM.deleteMany({
        where: {
          OR: [
            { parentPartId: { in: createdPartIds } },
            { childPartId: { in: createdPartIds } },
          ],
        },
      });
      await prisma.part.deleteMany({ where: { partId: { in: createdPartIds } } });
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  });
