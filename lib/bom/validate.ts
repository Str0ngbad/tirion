import type { PrismaClient } from "@prisma/client";
import { BomCycleError, BomDepthExceededError } from "@/lib/errors/bom";
import { detectCycle, getMaxAncestorDepth, getMaxDescendantDepth } from "@/lib/bom/cte-helpers";

export const BOM_DEPTH_HARD_LIMIT = 8;

/**
 * Throws BomCycleError if adding (parentPartId → childPartId) would create
 * a cycle in the BOM graph.
 */
export async function validateNoCycle(
  prisma: PrismaClient,
  parentPartId: number,
  childPartId: number,
): Promise<void> {
  const chain = await detectCycle(prisma, parentPartId, childPartId);
  if (chain !== null) {
    throw new BomCycleError(parentPartId, childPartId, chain);
  }
}

/**
 * Throws BomDepthExceededError if adding (parentPartId → childPartId) would
 * produce a tree depth exceeding BOM_DEPTH_HARD_LIMIT.
 *
 * Total depth = getMaxAncestorDepth(parent) + getMaxDescendantDepth(child).
 * Ancestor depth includes the parent itself; descendant depth includes the
 * child itself. The edge being added connects them, so the sum equals the
 * longest root-to-leaf path through that edge.
 */
export async function validateDepthLimit(
  prisma: PrismaClient,
  parentPartId: number,
  childPartId: number,
): Promise<void> {
  const [ancestorDepth, descendantDepth] = await Promise.all([
    getMaxAncestorDepth(prisma, parentPartId),
    getMaxDescendantDepth(prisma, childPartId),
  ]);

  const computedDepth = ancestorDepth + descendantDepth;
  if (computedDepth > BOM_DEPTH_HARD_LIMIT) {
    throw new BomDepthExceededError(
      computedDepth,
      BOM_DEPTH_HARD_LIMIT,
      parentPartId,
      childPartId,
    );
  }
}
