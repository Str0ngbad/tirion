import { prisma } from "@/lib/db/client";

/**
 * Computes buildable count for every active Assembly in the database.
 * Buildable count = the minimum number of complete units that could
 * be produced from current on-hand inventory of all descendants.
 *
 * Implementation: fetches all active BOM edges + part metadata in a
 * single query, then computes bottom-up via memoized DFS. This is
 * correct for multi-level trees (a recursive SQL CTE approach has
 * subtle correctness issues for mixed-depth trees; see DEVIATIONS.md).
 *
 * Returns a Map keyed by partId. Non-Assembly Parts and inactive
 * Assemblies are not in the map (caller treats absence as null).
 *
 * Edge cases:
 * - Inactive child Parts: treated as stockCount = 0.
 * - Assembly with no active children: buildable = 0.
 * - Leaf Part with null stockCount: treated as 0.
 */
export async function buildableCountForAllAssemblies(): Promise<Map<number, number>> {
  // Single query: all active parts + all active BOM edges with child data
  const [allParts, allEdges] = await Promise.all([
    prisma.part.findMany({
      where: { isActive: true },
      select: { partId: true, partType: true, stockCount: true },
    }),
    prisma.bOM.findMany({
      include: {
        childPart: { select: { partId: true, partType: true, stockCount: true, isActive: true } },
      },
    }),
  ]);

  // Build maps for fast lookup
  type PartInfo = { partType: string; stockCount: number };
  const partMap = new Map<number, PartInfo>();
  for (const p of allParts) {
    partMap.set(p.partId, {
      partType: p.partType,
      stockCount: p.stockCount !== null ? p.stockCount.toNumber() : 0,
    });
  }

  // Children map: parentPartId → list of { childPartId, quantity }
  // Only include edges where child is active
  type ChildEdge = { childPartId: number; quantity: number };
  const childMap = new Map<number, ChildEdge[]>();
  for (const edge of allEdges) {
    if (!edge.childPart.isActive) continue;
    const list = childMap.get(edge.parentPartId) ?? [];
    list.push({ childPartId: edge.childPartId, quantity: Number(edge.quantity) });
    childMap.set(edge.parentPartId, list);
  }

  // Memoized DFS to compute buildable count bottom-up
  const cache = new Map<number, number>();

  function buildable(partId: number): number {
    const cached = cache.get(partId);
    if (cached !== undefined) return cached;

    const part = partMap.get(partId);
    if (!part) {
      // Inactive part treated as 0
      cache.set(partId, 0);
      return 0;
    }

    if (part.partType === "Part") {
      const count = part.stockCount;
      cache.set(partId, count);
      return count;
    }

    // Assembly: MIN(child.buildable / quantity) over all active children
    const children = childMap.get(partId) ?? [];
    if (children.length === 0) {
      cache.set(partId, 0);
      return 0;
    }

    let min = Infinity;
    for (const child of children) {
      const childBuildable = buildable(child.childPartId);
      const contribution = Math.floor(childBuildable / child.quantity);
      if (contribution < min) min = contribution;
    }

    const result = min === Infinity ? 0 : min;
    cache.set(partId, result);
    return result;
  }

  // Compute for all active Assemblies
  const resultMap = new Map<number, number>();
  for (const p of allParts) {
    if (p.partType === "Assembly") {
      resultMap.set(p.partId, buildable(p.partId));
    }
  }

  return resultMap;
}
