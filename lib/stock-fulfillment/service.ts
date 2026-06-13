import { Prisma, PartType } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type Decimal = Prisma.Decimal;
import {
  WONotFoundError,
  WONotUnreleasedError,
  WOAlreadyReviewedError,
  InsufficientStockError,
  DescendantCompleteError,
  ReconcileStockError,
} from "@/lib/errors/stock-fulfillment-errors";
import type { CandidateWO, ProjectStats, SfViewData } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Rows from the DB enriched WO query — slimmed shape used across service helpers.
type WoRow = {
  workOrderId: number;
  projectId: number;
  partId: number;
  parentWoId: number | null;
  topLevelIndex: number | null;
  quantity: Decimal;
  status: string;
  stockFulfillmentReviewedAt: Date | null;
  bomPath: string[];
  part: {
    partNumber: string;
    partName: string;
    partType: PartType;
    stockCount: Decimal | null;
    inventoryLocation: string | null;
  };
  project: {
    projectNumber: string;
    customerName: string | null;
    dueDate: Date | null;
  };
};

// Slim shape for descendant-walk queries.
type WoHierarchyRow = {
  workOrderId: number;
  projectId: number;
  parentWoId: number | null;
  status: string;
};

export function getDescendantWoIds(wos: WoHierarchyRow[], rootWoId: number): number[] {
  const result: number[] = [];
  const queue = [rootWoId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const w of wos) {
      if (w.parentWoId === id) {
        result.push(w.workOrderId);
        queue.push(w.workOrderId);
      }
    }
  }
  return result;
}

// DFS pre-order within a project's candidate set.
// Top-level WOs sort by topLevelIndex; children sort by inventoryLocation (nulls last) then workOrderId.
// Handles "orphan" groups — candidates whose parent is not itself a candidate.
export function locationSortedProject(candidates: CandidateWO[]): CandidateWO[] {
  const candidateIds = new Set(candidates.map((c) => c.workOrderId));

  const byParent = new Map<number | null, CandidateWO[]>();
  for (const wo of candidates) {
    const key = wo.parentWoId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(wo);
  }

  for (const [parentId, siblings] of byParent) {
    if (parentId === null) {
      siblings.sort((a, b) => (a.topLevelIndex ?? 0) - (b.topLevelIndex ?? 0));
    } else {
      siblings.sort((a, b) => {
        const la = a.inventoryLocation;
        const lb = b.inventoryLocation;
        if (la !== lb) {
          if (la === null) return 1;
          if (lb === null) return -1;
          return la < lb ? -1 : 1;
        }
        return a.workOrderId - b.workOrderId;
      });
    }
  }

  // Root groups: true top-levels, plus orphan groups (parent not in candidate set).
  const rootGroups: Array<{ minWoId: number; wos: CandidateWO[] }> = [];

  for (const wo of byParent.get(null) ?? []) {
    rootGroups.push({ minWoId: wo.workOrderId, wos: [wo] });
  }
  for (const [parentId, group] of byParent) {
    if (parentId === null || candidateIds.has(parentId)) continue;
    rootGroups.push({
      minWoId: Math.min(...group.map((o) => o.workOrderId)),
      wos: group,
    });
  }
  rootGroups.sort((a, b) => a.minWoId - b.minWoId);

  function dfsEmit(wo: CandidateWO): CandidateWO[] {
    const out: CandidateWO[] = [wo];
    for (const child of byParent.get(wo.workOrderId) ?? []) {
      out.push(...dfsEmit(child));
    }
    return out;
  }

  const result: CandidateWO[] = [];
  for (const group of rootGroups) {
    for (const wo of group.wos) {
      result.push(...dfsEmit(wo));
    }
  }
  return result;
}

// ─── getSfViewData ─────────────────────────────────────────────────────────────

export type SfFilters = {
  projectId?: number;
  competingOnly?: boolean;
};

export async function getSfViewData(filters?: SfFilters): Promise<SfViewData> {
  // Step 1+2: fetch Active Projects that have at least one Unreleased WO.
  const activeProjectIds = await prisma.project.findMany({
    where: {
      status: "Active",
      workOrders: { some: { status: "Unreleased" } },
    },
    select: { projectId: true },
  });

  if (activeProjectIds.length === 0) {
    return { candidates: [], projectStats: [] };
  }

  const projectIdSet = activeProjectIds.map((p) => p.projectId);

  const wos = (await prisma.workOrder.findMany({
    where: {
      projectId: { in: projectIdSet },
      status: "Unreleased",
    },
    include: {
      part: {
        select: {
          partNumber: true,
          partName: true,
          partType: true,
          stockCount: true,
          inventoryLocation: true,
        },
      },
      project: {
        select: {
          projectNumber: true,
          customerName: true,
          dueDate: true,
        },
      },
    },
  })) as WoRow[];

  // For descendant-complete check we need all WOs in scope (including Complete).
  const allWosInProjects = await prisma.workOrder.findMany({
    where: { projectId: { in: projectIdSet } },
    select: { workOrderId: true, projectId: true, parentWoId: true, status: true },
  });

  const completeIds = new Set(
    allWosInProjects.filter((w) => w.status === "Complete").map((w) => w.workOrderId)
  );

  // Step 3: compute candidates.
  const basicEligible = wos.filter(
    (w) =>
      w.stockFulfillmentReviewedAt === null &&
      (w.part.stockCount ?? new Prisma.Decimal(0)).gte(w.quantity)
  );

  const disqualifiedIds = new Set<number>();
  for (const wo of basicEligible) {
    if (wo.part.partType !== PartType.Assembly) continue;
    const descendants = getDescendantWoIds(allWosInProjects, wo.workOrderId);
    if (descendants.some((id) => completeIds.has(id))) {
      disqualifiedIds.add(wo.workOrderId);
    }
  }

  const eligible = basicEligible.filter((w) => !disqualifiedIds.has(w.workOrderId));

  // Step 6: compute cumulativeDemand per partId BEFORE applying filters.
  const cumulativeByPart = new Map<number, Decimal>();
  for (const wo of eligible) {
    const prev = cumulativeByPart.get(wo.partId) ?? new Prisma.Decimal(0);
    cumulativeByPart.set(wo.partId, prev.add(wo.quantity));
  }

  // Build CandidateWO objects pre-filter so cumulative demand is cross-project.
  const allCandidates: CandidateWO[] = eligible.map((w) => ({
    workOrderId: w.workOrderId,
    projectId: w.projectId,
    projectNumber: w.project.projectNumber,
    partId: w.partId,
    partNumber: w.part.partNumber,
    partName: w.part.partName,
    partType: w.part.partType,
    quantity: w.quantity,
    stockCount: w.part.stockCount ?? new Prisma.Decimal(0),
    dueDate: w.project.dueDate,
    topLevelIndex: w.topLevelIndex,
    parentWoId: w.parentWoId,
    inventoryLocation: w.part.inventoryLocation,
    bomPath: w.bomPath ?? [],
    cumulativeDemand: cumulativeByPart.get(w.partId) ?? w.quantity,
  }));

  // Step 4: apply filters.
  let filtered = allCandidates;
  if (filters?.projectId !== undefined) {
    filtered = filtered.filter((c) => c.projectId === filters.projectId);
  }
  if (filters?.competingOnly) {
    filtered = filtered.filter((c) => c.cumulativeDemand.gt(c.stockCount));
  }

  // Step 5: sort. Project order: dueDate ASC (nulls last), projectId ASC.
  const projectOrder = [
    ...new Set(
      filtered
        .slice()
        .sort((a, b) => {
          const da = a.dueDate;
          const db = b.dueDate;
          if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return da.getTime() - db.getTime();
          }
          return a.projectId - b.projectId;
        })
        .map((c) => c.projectId)
    ),
  ];

  const byProject = new Map<number, CandidateWO[]>();
  for (const c of filtered) {
    if (!byProject.has(c.projectId)) byProject.set(c.projectId, []);
    byProject.get(c.projectId)!.push(c);
  }

  const sortedCandidates: CandidateWO[] = [];
  for (const pid of projectOrder) {
    sortedCandidates.push(...locationSortedProject(byProject.get(pid)!));
  }

  // Step 7: ProjectStats for projects with unreleasedCount > 0.
  const candidateSet = new Set(allCandidates.map((c) => c.workOrderId));

  // Fetch project metadata for stats.
  const projectMeta = await prisma.project.findMany({
    where: { projectId: { in: projectIdSet } },
    select: { projectId: true, projectNumber: true, customerName: true, dueDate: true, color: true },
  });
  const metaByProjectId = new Map(projectMeta.map((p) => [p.projectId, p]));

  const unreleasedByProject = new Map<number, number>();
  for (const w of wos) {
    unreleasedByProject.set(w.projectId, (unreleasedByProject.get(w.projectId) ?? 0) + 1);
  }

  const candidateCountByProject = new Map<number, number>();
  for (const c of allCandidates) {
    candidateCountByProject.set(c.projectId, (candidateCountByProject.get(c.projectId) ?? 0) + 1);
  }

  const projectStats: ProjectStats[] = [];
  for (const [pid, unreleasedCount] of unreleasedByProject) {
    if (unreleasedCount === 0) continue;
    const meta = metaByProjectId.get(pid);
    const candidateCount = candidateCountByProject.get(pid) ?? 0;
    const pendingReleaseCount = unreleasedCount - candidateCount;

    if (candidateCount + pendingReleaseCount !== unreleasedCount) {
      console.warn(
        `SF invariant violated for project ${pid}: candidateCount(${candidateCount}) + pendingReleaseCount(${pendingReleaseCount}) !== unreleasedCount(${unreleasedCount})`
      );
    }

    projectStats.push({
      projectId: pid,
      projectNumber: meta?.projectNumber ?? String(pid),
      customerName: meta?.customerName ?? null,
      dueDate: meta?.dueDate ?? null,
      color: (meta?.color ?? null) as import("@/components/project/project-id-pill").ProjectColor | null,
      candidateCount,
      pendingReleaseCount,
      unreleasedCount,
    });
  }

  // Sort stats same project order as candidates.
  projectStats.sort((a, b) => {
    const ai = projectOrder.indexOf(a.projectId);
    const bi = projectOrder.indexOf(b.projectId);
    if (ai === -1 && bi === -1) return a.projectId - b.projectId;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return { candidates: sortedCandidates, projectStats };
}

// ─── fulfillFromStock ──────────────────────────────────────────────────────────

export type FulfillResult = {
  fulfilledWoId: number;
  cascadedWoIds: number[];
  autoPassedWoIds: number[];
};

export async function fulfillFromStock(
  workOrderId: number,
  actingUserId: number
): Promise<FulfillResult> {
  // Step 1: fetch WO with Part and Project.
  const wo = await prisma.workOrder.findUnique({
    where: { workOrderId },
    include: {
      part: { select: { partId: true, partNumber: true, partType: true, stockCount: true } },
      project: { select: { projectId: true } },
    },
  });

  if (!wo) throw new WONotFoundError(workOrderId);
  if (wo.status !== "Unreleased") throw new WONotUnreleasedError(workOrderId, wo.status);
  if (wo.stockFulfillmentReviewedAt !== null) throw new WOAlreadyReviewedError(workOrderId);

  const stockCount = wo.part.stockCount ?? new Prisma.Decimal(0);
  if (stockCount.lt(wo.quantity)) {
    throw new InsufficientStockError(
      wo.part.partId,
      stockCount.toString(),
      wo.quantity.toString()
    );
  }

  // Step 2: action-time descendant check.
  const allProjectWOs = await prisma.workOrder.findMany({
    where: { projectId: wo.project.projectId },
    select: { workOrderId: true, projectId: true, parentWoId: true, status: true },
  });

  const descendantIds = getDescendantWoIds(allProjectWOs, workOrderId);

  const completeDescendant = descendantIds.find(
    (id) => allProjectWOs.find((w) => w.workOrderId === id)?.status === "Complete"
  );
  if (completeDescendant !== undefined) {
    throw new DescendantCompleteError(workOrderId, completeDescendant);
  }

  // Pre-fetch audit action IDs.
  const [stockFulfilledAction, cascadeSkipAction, autoPassAction] = await Promise.all([
    prisma.auditAction.findUniqueOrThrow({ where: { actionName: "StockFulfilled" } }),
    prisma.auditAction.findUniqueOrThrow({ where: { actionName: "AssemblyCascadeSkip" } }),
    prisma.auditAction.findUniqueOrThrow({ where: { actionName: "StockAutoPassThrough" } }),
  ]);

  const newStockCount = stockCount.sub(wo.quantity);

  // Step 3: transaction.
  const result = await prisma.$transaction(
    async (tx) => {
      const now = new Date();

      // a. Decrement stock.
      await tx.part.update({
        where: { partId: wo.partId },
        data: { stockCount: newStockCount },
      });

      // b+c+d. Stamp reviewedAt, skip steps, set WO Complete.
      await tx.workOrderStep.updateMany({
        where: { workOrderId },
        data: { state: "Skipped" },
      });
      await tx.workOrder.update({
        where: { workOrderId },
        data: { status: "Complete", stockFulfillmentReviewedAt: now },
      });

      // e. Assembly cascade.
      const cascadedWoIds: number[] = [];
      if (descendantIds.length > 0) {
        await tx.workOrderStep.updateMany({
          where: { workOrderId: { in: descendantIds } },
          data: { state: "Skipped" },
        });
        await tx.workOrder.updateMany({
          where: { workOrderId: { in: descendantIds } },
          data: { status: "Complete", stockFulfillmentReviewedAt: now },
        });
        cascadedWoIds.push(...descendantIds);
      }

      // f. Auto-pass-through: remaining Unreleased WOs for same partId now failing stock check.
      const remainingForPart = await tx.workOrder.findMany({
        where: {
          partId: wo.partId,
          status: "Unreleased",
          stockFulfillmentReviewedAt: null,
          workOrderId: { not: workOrderId },
        },
        select: { workOrderId: true, quantity: true },
      });

      const autoPassIds = remainingForPart
        .filter((w) => w.quantity.gt(newStockCount))
        .map((w) => w.workOrderId);

      if (autoPassIds.length > 0) {
        await tx.workOrder.updateMany({
          where: { workOrderId: { in: autoPassIds } },
          data: { stockFulfillmentReviewedAt: now },
        });
      }

      // g. Audit entries.
      await tx.auditLog.create({
        data: {
          entityType: "WorkOrder",
          entityId: workOrderId,
          auditActionId: stockFulfilledAction.auditActionId,
          changedByUserId: actingUserId,
          previousValue: {
            status: "Unreleased",
            stockCount: stockCount.toString(),
          },
          newValue: {
            status: "Complete",
            stockCount: newStockCount.toString(),
            cascadedWoIds: cascadedWoIds,
          },
        },
      });

      for (const descId of cascadedWoIds) {
        await tx.auditLog.create({
          data: {
            entityType: "WorkOrder",
            entityId: descId,
            auditActionId: cascadeSkipAction.auditActionId,
            changedByUserId: actingUserId,
            previousValue: { status: "Unreleased" },
            newValue: { status: "Complete", cascadedFromWoId: workOrderId },
          },
        });
      }

      for (const aptId of autoPassIds) {
        await tx.auditLog.create({
          data: {
            entityType: "WorkOrder",
            entityId: aptId,
            auditActionId: autoPassAction.auditActionId,
            changedByUserId: actingUserId,
            newValue: {
              reason: "stock depleted by other fulfillment",
              depletedByWoId: workOrderId,
              newStockCount: newStockCount.toString(),
            },
          },
        });
      }

      return {
        fulfilledWoId: workOrderId,
        cascadedWoIds,
        autoPassedWoIds: autoPassIds,
      };
    },
    { timeout: 60_000 }
  );

  return result;
}

// ─── passThrough ──────────────────────────────────────────────────────────────

export async function passThrough(workOrderId: number, actingUserId: number) {
  const wo = await prisma.workOrder.findUnique({
    where: { workOrderId },
    select: { workOrderId: true, status: true, stockFulfillmentReviewedAt: true, partId: true },
  });

  if (!wo) throw new WONotFoundError(workOrderId);
  if (wo.status !== "Unreleased") throw new WONotUnreleasedError(workOrderId, wo.status);
  if (wo.stockFulfillmentReviewedAt !== null) throw new WOAlreadyReviewedError(workOrderId);

  const passThroughAction = await prisma.auditAction.findUniqueOrThrow({
    where: { actionName: "StockPassThrough" },
  });

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.workOrder.update({
      where: { workOrderId },
      data: { stockFulfillmentReviewedAt: now },
    });

    await tx.auditLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: workOrderId,
        auditActionId: passThroughAction.auditActionId,
        changedByUserId: actingUserId,
        newValue: { stockFulfillmentReviewedAt: now.toISOString() },
      },
    });

    return updated;
  });
}

// ─── reconcileStock ───────────────────────────────────────────────────────────

export async function reconcileStock(
  partId: number,
  newStockCount: number,
  reason: string,
  actingUserId: number
) {
  const part = await prisma.part.findUnique({
    where: { partId },
    select: { partId: true, partNumber: true, partName: true, stockCount: true },
  });

  if (!part) throw new Error(`Part not found: ${partId}`);
  if (newStockCount < 0) throw new ReconcileStockError(partId, newStockCount);

  const reconcileAction = await prisma.auditAction.findUniqueOrThrow({
    where: { actionName: "StockReconciliation" },
  });

  const oldCount = part.stockCount ?? new Prisma.Decimal(0);
  const newCountDecimal = new Prisma.Decimal(newStockCount);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.part.update({
      where: { partId },
      data: { stockCount: newCountDecimal },
      select: { partId: true, partNumber: true, partName: true, stockCount: true },
    });

    await tx.auditLog.create({
      data: {
        entityType: "Part",
        entityId: partId,
        auditActionId: reconcileAction.auditActionId,
        changedByUserId: actingUserId,
        previousValue: { stockCount: oldCount.toString() },
        newValue: { stockCount: newCountDecimal.toString() },
        note: reason,
      },
    });

    return updated;
  });
}

// ─── releaseProject ───────────────────────────────────────────────────────────

export type ReleaseResult = {
  releasedWoIds: number[];
  woCount: number;
};

export async function releaseProject(
  projectId: number,
  actingUserId: number
): Promise<ReleaseResult> {
  const releasedAction = await prisma.auditAction.findUniqueOrThrow({
    where: { actionName: "StockFulfillmentReleased" },
  });

  const result = await prisma.$transaction(
    async (tx) => {
      // Fetch all Unreleased WOs for this project with their Part stockCount.
      const unreleasedWOs = await tx.workOrder.findMany({
        where: { projectId, status: "Unreleased" },
        include: {
          part: { select: { stockCount: true, partType: true } },
        },
      });

      // Need hierarchy to check descendant-complete status.
      const allProjectWOs = await tx.workOrder.findMany({
        where: { projectId },
        select: { workOrderId: true, projectId: true, parentWoId: true, status: true },
      });

      const completeIds = new Set(
        allProjectWOs.filter((w) => w.status === "Complete").map((w) => w.workOrderId)
      );

      // Determine which are still candidates (not eligible to release).
      const candidateIds = new Set<number>();
      for (const wo of unreleasedWOs) {
        if (wo.stockFulfillmentReviewedAt !== null) continue;
        const stockCount = wo.part.stockCount ?? new Prisma.Decimal(0);
        if (stockCount.lt(wo.quantity)) continue;
        if (wo.part.partType === PartType.Assembly) {
          const descendants = getDescendantWoIds(allProjectWOs, wo.workOrderId);
          if (descendants.some((id) => completeIds.has(id))) continue;
        }
        candidateIds.add(wo.workOrderId);
      }

      // Release all non-candidates.
      const toRelease = unreleasedWOs.filter((w) => !candidateIds.has(w.workOrderId));
      const now = new Date();
      const releasedWoIds = toRelease.map((w) => w.workOrderId);

      if (releasedWoIds.length > 0) {
        // Stamp reviewedAt on WOs that don't have it yet (implicit pass-throughs).
        const needsStamp = toRelease
          .filter((w) => w.stockFulfillmentReviewedAt === null)
          .map((w) => w.workOrderId);

        if (needsStamp.length > 0) {
          await tx.workOrder.updateMany({
            where: { workOrderId: { in: needsStamp } },
            data: { stockFulfillmentReviewedAt: now },
          });
        }

        // Transition all to Open.
        await tx.workOrder.updateMany({
          where: { workOrderId: { in: releasedWoIds } },
          data: { status: "Open" },
        });
      }

      // Single aggregate audit entry.
      await tx.auditLog.create({
        data: {
          entityType: "Project",
          entityId: projectId,
          auditActionId: releasedAction.auditActionId,
          changedByUserId: actingUserId,
          newValue: {
            releasedWoIds,
            woCount: releasedWoIds.length,
            scope: "project",
            projectId,
          },
        },
      });

      return { releasedWoIds, woCount: releasedWoIds.length };
    },
    { timeout: 60_000 }
  );

  return result;
}

// ─── releaseAll ───────────────────────────────────────────────────────────────

export async function releaseAll(
  actingUserId: number,
  projectIds?: number[]
): Promise<ReleaseResult> {
  const releasedAction = await prisma.auditAction.findUniqueOrThrow({
    where: { actionName: "StockFulfillmentReleased" },
  });

  // Determine scope: all active projects with unreleased WOs, or filtered subset.
  let scopeProjectIds: number[];

  if (projectIds && projectIds.length > 0) {
    scopeProjectIds = projectIds;
  } else {
    const activeProjects = await prisma.project.findMany({
      where: {
        status: "Active",
        workOrders: { some: { status: "Unreleased" } },
      },
      select: { projectId: true },
    });
    scopeProjectIds = activeProjects.map((p) => p.projectId);
  }

  if (scopeProjectIds.length === 0) {
    return { releasedWoIds: [], woCount: 0 };
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const unreleasedWOs = await tx.workOrder.findMany({
        where: { projectId: { in: scopeProjectIds }, status: "Unreleased" },
        include: {
          part: { select: { stockCount: true, partType: true } },
        },
      });

      const allProjectWOs = await tx.workOrder.findMany({
        where: { projectId: { in: scopeProjectIds } },
        select: { workOrderId: true, projectId: true, parentWoId: true, status: true },
      });

      const completeIds = new Set(
        allProjectWOs.filter((w) => w.status === "Complete").map((w) => w.workOrderId)
      );

      const candidateIds = new Set<number>();
      for (const wo of unreleasedWOs) {
        if (wo.stockFulfillmentReviewedAt !== null) continue;
        const stockCount = wo.part.stockCount ?? new Prisma.Decimal(0);
        if (stockCount.lt(wo.quantity)) continue;
        if (wo.part.partType === PartType.Assembly) {
          const descendants = getDescendantWoIds(allProjectWOs, wo.workOrderId);
          if (descendants.some((id) => completeIds.has(id))) continue;
        }
        candidateIds.add(wo.workOrderId);
      }

      const toRelease = unreleasedWOs.filter((w) => !candidateIds.has(w.workOrderId));
      const now = new Date();
      const releasedWoIds = toRelease.map((w) => w.workOrderId);

      if (releasedWoIds.length > 0) {
        const needsStamp = toRelease
          .filter((w) => w.stockFulfillmentReviewedAt === null)
          .map((w) => w.workOrderId);

        if (needsStamp.length > 0) {
          await tx.workOrder.updateMany({
            where: { workOrderId: { in: needsStamp } },
            data: { stockFulfillmentReviewedAt: now },
          });
        }

        await tx.workOrder.updateMany({
          where: { workOrderId: { in: releasedWoIds } },
          data: { status: "Open" },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "Project",
          entityId: scopeProjectIds[0]!, // entity for global release — use first project as anchor
          auditActionId: releasedAction.auditActionId,
          changedByUserId: actingUserId,
          newValue: {
            releasedWoIds,
            woCount: releasedWoIds.length,
            scope: projectIds ? "filtered" : "global",
            projectIds: scopeProjectIds,
          },
        },
      });

      return { releasedWoIds, woCount: releasedWoIds.length };
    },
    { timeout: 60_000 }
  );

  return result;
}
