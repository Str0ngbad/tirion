/**
 * Verification script for buildableCountForAllAssemblies().
 * Run with: npx tsx scripts/verify-buildable-helpers.ts
 *
 * Creates controlled fixtures, asserts correctness, cleans up in finally.
 *
 * Fixture topology:
 *   Parts: A (stock=10), B (stock=5), C (stock=8), D (stock=3, inactive)
 *   Assemblies: X = 2*A + 1*B  → buildable = min(10/2=5, 5/1=5) = 5
 *               Y = 3*X + 1*C  → buildable = min(5/3=1, 8/1=8) = 1
 */

import "dotenv/config";
import { prisma } from "../lib/db/client";
import { buildableCountForAllAssemblies } from "../lib/bom/buildable-helpers";

const PREFIX = "__vbuild_";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

const createdPartIds: number[] = [];
const createdBomIds: number[] = [];

async function mkPart(suffix: string, stockCount: number, isActive = true) {
  const p = await prisma.part.create({
    data: {
      partNumber: `${PREFIX}part_${suffix}`,
      partName: `Buildable Part ${suffix}`,
      partType: "Part",
      stockCount,
      isActive,
    },
  });
  createdPartIds.push(p.partId);
  return p;
}

async function mkAssembly(suffix: string) {
  const p = await prisma.part.create({
    data: {
      partNumber: `${PREFIX}assy_${suffix}`,
      partName: `Buildable Assy ${suffix}`,
      partType: "Assembly",
      isActive: true,
    },
  });
  createdPartIds.push(p.partId);
  return p;
}

async function mkEdge(parentPartId: number, childPartId: number, qty: number) {
  const edge = await prisma.bOM.create({ data: { parentPartId, childPartId, quantity: qty } });
  createdBomIds.push(edge.bomId);
  return edge;
}

async function main() {
  // Idempotent pre-run cleanup
  const stale = await prisma.part.findMany({
    where: { partNumber: { startsWith: PREFIX } },
    select: { partId: true },
  });
  if (stale.length > 0) {
    const ids = stale.map((p) => p.partId);
    await prisma.bOM.deleteMany({ where: { OR: [{ parentPartId: { in: ids } }, { childPartId: { in: ids } }] } });
    await prisma.part.deleteMany({ where: { partId: { in: ids } } });
  }

  try {
    const partA = await mkPart("A", 10);
    const partB = await mkPart("B", 5);
    const partC = await mkPart("C", 8);
    const partD = await mkPart("D", 3, false); // inactive
    const assyX = await mkAssembly("X");
    const assyY = await mkAssembly("Y");

    // X = 2*A + 1*B
    await mkEdge(assyX.partId, partA.partId, 2);
    await mkEdge(assyX.partId, partB.partId, 1);

    // Y = 3*X + 1*C
    await mkEdge(assyY.partId, assyX.partId, 3);
    await mkEdge(assyY.partId, partC.partId, 1);

    const map = await buildableCountForAllAssemblies();

    // 1. Map contains exactly X and Y (not leaf parts, not inactive D)
    assert(map.has(assyX.partId), "1. Map contains assembly X");
    assert(map.has(assyY.partId), "2. Map contains assembly Y");
    assert(!map.has(partA.partId), "3. Map does not contain leaf part A");
    assert(!map.has(partB.partId), "4. Map does not contain leaf part B");
    assert(!map.has(partD.partId), "5. Map does not contain inactive part D");

    // 2. X buildable = min(10/2, 5/1) = min(5, 5) = 5
    assert(map.get(assyX.partId) === 5, `6. X buildable = 5 (got ${map.get(assyX.partId)})`);

    // 3. Y buildable = min(5/3=floor(1.66)=1, 8/1=8) = 1
    assert(map.get(assyY.partId) === 1, `7. Y buildable = 1 (got ${map.get(assyY.partId)})`);

    // 4. Assembly with no children = 0
    const emptyAssy = await mkAssembly("Empty");
    const map2 = await buildableCountForAllAssemblies();
    assert(map2.get(emptyAssy.partId) === 0, "8. Assembly with no children = 0");

    console.log(`\n── Results: ${passed} passed, ${failed} failed ─────────────────────\n`);
    if (failed > 0) process.exit(1);
  } finally {
    if (createdBomIds.length) {
      await prisma.bOM.deleteMany({ where: { bomId: { in: createdBomIds } } });
    }
    if (createdPartIds.length) {
      await prisma.part.deleteMany({ where: { partId: { in: createdPartIds } } });
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  }
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  });
