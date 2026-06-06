import { Prisma, PartType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  BomEdgeNotFoundError,
  BomParentInvalidError,
  BomChildInvalidError,
  BomSelfReferenceError,
  BomDuplicateChildError,
  BomBulkDeleteInvalidError,
} from "@/lib/errors/bom";
import { validateNoCycle, validateDepthLimit } from "@/lib/bom/validate";
import type {
  BomNode,
  BomEdgeRow,
  CreateBomEdgeInput,
  UpdateBomEdgeInput,
  BulkDeleteInput,
  SaveResponse,
} from "@/lib/bom/types";

// ─── Tree fetch ────────────────────────────────────────────────────────────────

type TreeRow = {
  parent_part_id: number | null;
  child_part_id: number;
  bom_id: number | null;
  quantity: Prisma.Decimal | null;
  part_number: string;
  part_name: string;
  part_type: PartType;
  is_active: boolean;
  stock_count: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
  cost_last_updated: Date | null;
  inventory_location: string | null;
};

/**
 * Returns the full recursive BOM tree rooted at assemblyPartId.
 * Children at each level are sorted: Parts alpha by partNumber, then
 * Assemblies alpha by partNumber (the fixed sort rule).
 *
 * Uses a single recursive CTE with a cycle guard (defensive — prevents
 * infinite recursion if corrupted data somehow has a cycle).
 */
export async function getBomTree(assemblyPartId: number): Promise<BomNode> {
  const root = await prisma.part.findUnique({
    where: { partId: assemblyPartId },
  });

  if (!root) {
    throw new BomParentInvalidError(assemblyPartId, "part_not_found");
  }
  if (!root.isActive) {
    throw new BomParentInvalidError(assemblyPartId, "part_inactive");
  }
  if (root.partType !== "Assembly") {
    throw new BomParentInvalidError(assemblyPartId, "parent_not_assembly");
  }

  // Single recursive CTE: gather all reachable nodes + edges.
  // The root row is the assembly itself (no BOM edge, null parent/bomId/qty).
  const rows = await prisma.$queryRaw<TreeRow[]>`
    WITH RECURSIVE tree(parent_part_id, child_part_id, bom_id, quantity, path) AS (
      SELECT
        NULL::int                        AS parent_part_id,
        ${assemblyPartId}::int           AS child_part_id,
        NULL::int                        AS bom_id,
        NULL::decimal                    AS quantity,
        ARRAY[${assemblyPartId}::int]    AS path
      UNION ALL
      SELECT
        b."parentPartId",
        b."childPartId",
        b."bomId",
        b."quantity",
        t.path || b."childPartId"
      FROM "BOM" b
      JOIN tree t ON b."parentPartId" = t.child_part_id
      WHERE NOT (b."childPartId" = ANY(t.path))
    )
    SELECT
      tree.parent_part_id,
      tree.child_part_id,
      tree.bom_id,
      tree.quantity,
      p."partNumber"          AS part_number,
      p."partName"            AS part_name,
      p."partType"            AS part_type,
      p."isActive"            AS is_active,
      p."stockCount"          AS stock_count,
      p."partCost"            AS cost,
      p."partCostUpdatedAt"   AS cost_last_updated,
      p."inventoryLocation"   AS inventory_location
    FROM tree
    JOIN "Part" p ON p."partId" = tree.child_part_id
  `;

  return buildTree(assemblyPartId, rows);
}

function buildTree(rootId: number, rows: TreeRow[]): BomNode {
  // Group children by their parent_part_id
  const childrenByParent = new Map<number, TreeRow[]>();
  for (const row of rows) {
    if (row.parent_part_id === null) continue; // root row itself
    const siblings = childrenByParent.get(row.parent_part_id) ?? [];
    siblings.push(row);
    childrenByParent.set(row.parent_part_id, siblings);
  }

  // Find the root row
  const rootRow = rows.find((r) => r.child_part_id === rootId && r.parent_part_id === null);

  function toNode(row: TreeRow): BomNode {
    const kids = (childrenByParent.get(row.child_part_id) ?? [])
      .slice()
      .sort((a, b) => {
        // Parts first (by partNumber asc), then Assemblies (by partNumber asc)
        if (a.part_type !== b.part_type) {
          return a.part_type === "Part" ? -1 : 1;
        }
        return a.part_number.localeCompare(b.part_number);
      })
      .map(toNode);

    return {
      bomId: row.bom_id ?? null,
      partId: row.child_part_id,
      partNumber: row.part_number,
      partName: row.part_name,
      partType: row.part_type,
      isActive: row.is_active,
      quantity: row.quantity !== null ? new Prisma.Decimal(row.quantity).toNumber() : null,
      stockCount: row.stock_count !== null ? new Prisma.Decimal(row.stock_count).toNumber() : null,
      cost: row.cost !== null ? new Prisma.Decimal(row.cost).toNumber() : null,
      costLastUpdated: row.cost_last_updated ? row.cost_last_updated.toISOString() : null,
      inventoryLocation: row.inventory_location,
      children: kids,
    };
  }

  if (!rootRow) {
    // Fallback: root with no children (shouldn't happen given the query)
    return {
      bomId: null,
      partId: rootId,
      partNumber: "",
      partName: "",
      partType: "Assembly",
      isActive: true,
      quantity: null,
      stockCount: null,
      cost: null,
      costLastUpdated: null,
      inventoryLocation: null,
      children: [],
    };
  }

  return toNode(rootRow);
}

// ─── Edge operations ───────────────────────────────────────────────────────────

function toBomEdgeRow(edge: { bomId: number; parentPartId: number; childPartId: number; quantity: Prisma.Decimal }): BomEdgeRow {
  return {
    bomId: edge.bomId,
    parentPartId: edge.parentPartId,
    childPartId: edge.childPartId,
    quantity: new Prisma.Decimal(edge.quantity).toNumber(),
  };
}

/**
 * Creates a BOM edge after a seven-step validation pipeline:
 * self-reference → parent validity → child validity → duplicate →
 * cycle → depth → insert.
 *
 * Returns { edge, flaggedWoCount: 0 }. The flaggedWoCount field is always 0
 * in Phase 1D. When the WorkOrder + DefinitionChangeFlag layers exist,
 * flag-creation logic lands here and populates the count from actual flags.
 */
export async function createBomEdge(
  input: CreateBomEdgeInput,
  userId: number,
): Promise<SaveResponse> {
  // 1. Self-reference check (cheap, no DB)
  if (input.parentPartId === input.childPartId) {
    throw new BomSelfReferenceError(input.parentPartId);
  }

  // 2. Parent existence and type
  const parent = await prisma.part.findUnique({ where: { partId: input.parentPartId } });
  if (!parent) throw new BomParentInvalidError(input.parentPartId, "part_not_found");
  if (!parent.isActive) throw new BomParentInvalidError(input.parentPartId, "part_inactive");
  if (parent.partType !== "Assembly") throw new BomParentInvalidError(input.parentPartId, "parent_not_assembly");

  // 3. Child existence and active state
  const child = await prisma.part.findUnique({ where: { partId: input.childPartId } });
  if (!child) throw new BomChildInvalidError(input.childPartId, "part_not_found");
  if (!child.isActive) throw new BomChildInvalidError(input.childPartId, "part_inactive");

  // 4. Duplicate check
  const existing = await prisma.bOM.findUnique({
    where: { parentPartId_childPartId: { parentPartId: input.parentPartId, childPartId: input.childPartId } },
  });
  if (existing) throw new BomDuplicateChildError(input.parentPartId, input.childPartId);

  // 5. Cycle check
  await validateNoCycle(prisma, input.parentPartId, input.childPartId);

  // 6. Depth check
  await validateDepthLimit(prisma, input.parentPartId, input.childPartId);

  // 7. Create the edge
  return mutateWithAudit({
    userId,
    entityType: "BOM",
    action: "BOMRowAdded",
    work: async (tx) => {
      const edge = await tx.bOM.create({
        data: {
          parentPartId: input.parentPartId,
          childPartId: input.childPartId,
          quantity: input.quantity,
        },
      });
      const row = toBomEdgeRow(edge);
      return {
        entityId: edge.bomId,
        previousValue: null,
        newValue: row as unknown as Prisma.InputJsonValue,
        result: { edge: row, flaggedWoCount: 0 } satisfies SaveResponse,
      };
    },
  });
}

/**
 * Updates a BOM edge quantity.
 *
 * quantity > 0: normal update, returns SaveResponse.
 * quantity = 0: spec's qty=0-as-remove semantics — delegates to deleteBomEdge
 *   and returns { deleted: true }. The UI shows a confirmation dialog before
 *   sending quantity=0, so the backend treats it as an unconditional remove.
 */
export async function updateBomEdge(
  edgeId: number,
  input: UpdateBomEdgeInput,
  userId: number,
): Promise<SaveResponse | { deleted: true }> {
  if (input.quantity === 0) {
    await deleteBomEdge(edgeId, userId);
    return { deleted: true };
  }

  return mutateWithAudit({
    userId,
    entityType: "BOM",
    action: "BOMRowEdited",
    work: async (tx) => {
      const existing = await tx.bOM.findUnique({ where: { bomId: edgeId } });
      if (!existing) throw new BomEdgeNotFoundError(edgeId);

      const previousRow = toBomEdgeRow(existing);
      const updated = await tx.bOM.update({
        where: { bomId: edgeId },
        data: { quantity: input.quantity },
      });
      const row = toBomEdgeRow(updated);
      return {
        entityId: edgeId,
        previousValue: previousRow as unknown as Prisma.InputJsonValue,
        newValue: row as unknown as Prisma.InputJsonValue,
        result: { edge: row, flaggedWoCount: 0 } satisfies SaveResponse,
      };
    },
  });
}

/**
 * Hard-deletes a BOM edge. BOM rows do not soft-delete.
 */
export async function deleteBomEdge(edgeId: number, userId: number): Promise<void> {
  await mutateWithAudit({
    userId,
    entityType: "BOM",
    action: "BOMRowRemoved",
    work: async (tx) => {
      const existing = await tx.bOM.findUnique({ where: { bomId: edgeId } });
      if (!existing) throw new BomEdgeNotFoundError(edgeId);

      await tx.bOM.delete({ where: { bomId: edgeId } });
      return {
        entityId: edgeId,
        previousValue: toBomEdgeRow(existing) as unknown as Prisma.InputJsonValue,
        newValue: null,
        result: undefined,
      };
    },
  });
}

/**
 * Atomically deletes multiple BOM edges after validating:
 * 1. All edge IDs exist.
 * 2. All edges share the same parent assembly (parent-scoped bulk delete).
 *
 * On success, writes one AuditLog entry per deleted edge inside one
 * transaction (N audit entries vs. a single summary entry — this keeps
 * each audit row self-contained and consistent with the single-delete pattern).
 */
export async function bulkDeleteBomEdges(
  input: BulkDeleteInput,
  userId: number,
): Promise<{ deletedCount: number }> {
  const edges = await prisma.bOM.findMany({
    where: { bomId: { in: input.edgeIds } },
  });

  // Validate: all IDs exist
  if (edges.length !== input.edgeIds.length) {
    const foundIds = new Set(edges.map((e) => e.bomId));
    const missingEdgeIds = input.edgeIds.filter((id) => !foundIds.has(id));
    throw new BomBulkDeleteInvalidError({ missingEdgeIds });
  }

  // Validate: all edges share a parent
  const parentIds = new Set(edges.map((e) => e.parentPartId));
  if (parentIds.size > 1) {
    throw new BomBulkDeleteInvalidError({
      edgeIdsFromDifferentParents: edges.map((e) => e.bomId),
    });
  }

  // Atomic delete with one audit entry per edge
  await prisma.$transaction(async (tx) => {
    const auditAction = await tx.auditAction.findUnique({
      where: { actionName: "BOMRowRemoved" },
    });
    if (!auditAction) throw new Error("AuditAction not found: BOMRowRemoved");

    await tx.bOM.deleteMany({ where: { bomId: { in: input.edgeIds } } });

    for (const edge of edges) {
      await tx.auditLog.create({
        data: {
          entityType: "BOM",
          entityId: edge.bomId,
          auditActionId: auditAction.auditActionId,
          changedByUserId: userId,
          previousValue: toBomEdgeRow(edge) as unknown as Prisma.InputJsonValue,
          newValue: Prisma.DbNull,
        },
      });
    }
  });

  return { deletedCount: edges.length };
}
