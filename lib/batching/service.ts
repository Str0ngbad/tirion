import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  BatchNotFoundError,
  BatchWOPartMismatchError,
  BatchConfirmEmptyError,
  WONotBatchCandidateError,
  BatchEligibilityError,
  OpenRowHeadroomError,
} from "@/lib/errors/batching-errors";
import type {
  BatchingViewData,
  CandidateWO,
  OpenWO,
  ProductionState,
  AncestorNode,
  RoutingStep,
} from "@/lib/batching/types";
import type { ConfirmDraftInput, UpdatePlannedQtyInput } from "@/lib/batching/schemas";

type DecimalValue = Prisma.Decimal;

// ─── Pure helpers ───────────────────────────────────────────────────────────

type StepRow = {
  state: string;
  subStatusId: number | null;
  completedQty: DecimalValue | null;
};

/** See spec/batching_lens_spec.md BL-6 for production state derivation */
export function deriveProductionState(steps: StepRow[]): ProductionState {
  const hasActivity = steps.some(
    (s) => s.state === "Started" || s.state === "Complete" || s.subStatusId !== null
  );
  if (!hasActivity) return "case1";
  const hasCompletedQty = steps.some(
    (s) => s.completedQty !== null && new Prisma.Decimal(s.completedQty).gt(0)
  );
  return hasCompletedQty ? "case2" : "case3";
}

function parseBomPath(raw: string[]): AncestorNode[] {
  return raw.map((entry) => {
    const spaceIdx = entry.indexOf(" ");
    return spaceIdx > 0
      ? { partNumber: entry.slice(0, spaceIdx), partName: entry.slice(spaceIdx + 1) }
      : { partNumber: entry, partName: "" };
  });
}

function batchDisplayId(batchId: number): string {
  return `BN${batchId.toString().padStart(4, "0")}`;
}

function buildTopLevelRef(projectNumber: string, topLevelIndex: number): string {
  return `${projectNumber}.${topLevelIndex.toString().padStart(2, "0")}`;
}

function computeHeadroom(
  plannedQty: DecimalValue | null,
  totalQty: DecimalValue
): DecimalValue {
  if (!plannedQty) return new Prisma.Decimal(0);
  return new Prisma.Decimal(plannedQty).minus(totalQty);
}

// ─── View data query ─────────────────────────────────────────────────────────

export async function getBatchingViewData(): Promise<BatchingViewData> {
  const candidateWOs = await prisma.workOrder.findMany({
    where: {
      status: "Unreleased",
      stockFulfillmentReviewedAt: { not: null },
    },
    include: {
      part: { select: { partNumber: true, partName: true } },
      project: { select: { projectNumber: true } },
      routingTemplate: {
        include: {
          steps: {
            include: { processType: { select: { processName: true } } },
            orderBy: { stepIndex: "asc" },
          },
        },
      },
      steps: {
        select: { state: true, subStatusId: true, completedQty: true },
      },
    },
  });

  if (candidateWOs.length === 0) {
    return { candidatesByPartId: {}, openRowsByPartId: {}, partIds: [] };
  }

  const candidatePartIds = [...new Set(candidateWOs.map((wo) => wo.partId))];

  // Build a map to resolve topLevelIndex for child WOs (topLevelIndex is null on non-top-level WOs).
  // Fetch all WOs in the relevant projects, then walk the parentWoId chain.
  const projectIds = [...new Set(candidateWOs.map((wo) => wo.projectId))];
  const projectWOs = await prisma.workOrder.findMany({
    where: { projectId: { in: projectIds } },
    select: { workOrderId: true, parentWoId: true, topLevelIndex: true },
  });
  const woIndexMap = new Map<number, number | null>(
    projectWOs.map((w) => [w.workOrderId, w.topLevelIndex])
  );
  const woParentMap = new Map<number, number | null>(
    projectWOs.map((w) => [w.workOrderId, w.parentWoId])
  );

  function resolveTopLevelIndex(workOrderId: number): number {
    let id: number | null = workOrderId;
    while (id !== null) {
      const idx = woIndexMap.get(id);
      if (idx !== null && idx !== undefined) return idx;
      id = woParentMap.get(id) ?? null;
    }
    return 0;
  }

  const openWOs = await prisma.workOrder.findMany({
    where: {
      status: "Open",
      partId: { in: candidatePartIds },
    },
    include: {
      part: { select: { partNumber: true, partName: true } },
      steps: {
        select: { state: true, subStatusId: true, completedQty: true },
      },
      batch: {
        select: {
          batchId: true,
          totalQuantity: true,
          plannedQuantity: true,
        },
      },
    },
  });

  // Build candidatesByPartId
  const candidatesByPartId: Record<number, CandidateWO[]> = {};

  for (const wo of candidateWOs) {
    const routingSteps: RoutingStep[] =
      wo.routingTemplate?.steps.map((s) => ({
        stepIndex: s.stepIndex,
        processTypeName: s.processType.processName,
      })) ?? [];

    const bomPath: AncestorNode[] = parseBomPath(wo.bomPath as string[]);
    const productionState = deriveProductionState(
      wo.steps as StepRow[]
    );
    const completedQtyStep = wo.steps.find(
      (s) => s.completedQty !== null
    );

    const candidate: CandidateWO = {
      workOrderId: wo.workOrderId,
      partId: wo.partId,
      partNumber: wo.part.partNumber,
      partName: wo.part.partName,
      demand: wo.quantity,
      priority: wo.priority,
      dueDate: wo.dueDate,
      routingSteps,
      bomPath,
      topLevelRef: buildTopLevelRef(wo.project.projectNumber, resolveTopLevelIndex(wo.workOrderId)),
      productionState,
      completedQty: completedQtyStep?.completedQty ?? null,
      lockState: "Unlocked",
    };

    if (!candidatesByPartId[wo.partId]) candidatesByPartId[wo.partId] = [];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    candidatesByPartId[wo.partId]!.push(candidate);
  }

  // Build openRowsByPartId — one row per batch, one per standalone WO
  const openRowsByPartId: Record<number, OpenWO[]> = {};
  const seenBatchIds = new Set<number>();

  for (const wo of openWOs) {
    const productionState = deriveProductionState(wo.steps as StepRow[]);
    const completedQtyStep = wo.steps.find((s) => s.completedQty !== null);
    const completedQty = completedQtyStep?.completedQty ?? null;

    if (wo.batchId !== null && wo.batch !== null) {
      if (seenBatchIds.has(wo.batchId)) continue;
      seenBatchIds.add(wo.batchId);

      const headroom = computeHeadroom(
        wo.batch.plannedQuantity,
        wo.batch.totalQuantity
      );

      const row: OpenWO = {
        workOrderId: null,
        batchId: wo.batchId,
        batchDisplayId: batchDisplayId(wo.batchId),
        partId: wo.partId,
        partNumber: wo.part.partNumber,
        partName: wo.part.partName,
        demand: wo.batch.totalQuantity,
        plannedQty: wo.batch.plannedQuantity,
        available: headroom,
        productionState,
        completedQty,
      };

      if (!openRowsByPartId[wo.partId]) openRowsByPartId[wo.partId] = [];
      openRowsByPartId[wo.partId]!.push(row);
    } else {
      const row: OpenWO = {
        workOrderId: wo.workOrderId,
        batchId: null,
        batchDisplayId: null,
        partId: wo.partId,
        partNumber: wo.part.partNumber,
        partName: wo.part.partName,
        demand: wo.quantity,
        plannedQty: null,
        // headroom = plannedQty ?? quantity; available = headroom - quantity (WO is sole member)
        available: computeHeadroom(null, wo.quantity),
        productionState,
        completedQty,
      };

      if (!openRowsByPartId[wo.partId]) openRowsByPartId[wo.partId] = [];
      openRowsByPartId[wo.partId]!.push(row);
    }
  }

  // Apply lock state: singletons (1 candidate, no Open rows) default Locked
  for (const partId of candidatePartIds) {
    const candidates = candidatesByPartId[partId] ?? [];
    const openRows = openRowsByPartId[partId] ?? [];
    if (candidates.length === 1 && openRows.length === 0) {
      candidates[0]!.lockState = "Locked";
    }
  }

  // Sort partIds by earliest candidate dueDate, then partNumber
  const partIds = [...candidatePartIds].sort((a, b) => {
    const aCands = candidatesByPartId[a] ?? [];
    const bCands = candidatesByPartId[b] ?? [];

    const aDate = aCands.reduce<Date | null>((min, c) => {
      if (!c.dueDate) return min;
      return !min || c.dueDate < min ? c.dueDate : min;
    }, null);
    const bDate = bCands.reduce<Date | null>((min, c) => {
      if (!c.dueDate) return min;
      return !min || c.dueDate < min ? c.dueDate : min;
    }, null);

    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return (aCands[0]?.partNumber ?? "").localeCompare(bCands[0]?.partNumber ?? "");
  });

  return { candidatesByPartId, openRowsByPartId, partIds };
}

// ─── Confirm Draft ────────────────────────────────────────────────────────────

type ValidatedWO = {
  workOrderId: number;
  status: string;
  partId: number;
  quantity: Prisma.Decimal;
  stockFulfillmentReviewedAt: Date | null;
};

export async function confirmDraft(
  input: ConfirmDraftInput,
  userId: number
): Promise<void> {
  if (input.assignments.length === 0) throw new BatchConfirmEmptyError();

  const auditActions = await prisma.auditAction.findMany({
    where: {
      actionName: {
        in: ["BatchCreated", "WOAddedToOpenBatch", "SingletonConfirmed", "WOBatchingConfirmed"],
      },
    },
    select: { auditActionId: true, actionName: true },
  });
  const auditActionMap = new Map(auditActions.map((a) => [a.actionName, a.auditActionId]));

  const auditBatchCreated = auditActionMap.get("BatchCreated")!;
  const auditWOAddedToOpenBatch = auditActionMap.get("WOAddedToOpenBatch")!;
  const auditSingletonConfirmed = auditActionMap.get("SingletonConfirmed")!;
  const auditWOBatchingConfirmed = auditActionMap.get("WOBatchingConfirmed")!;

  const allWoIds = input.assignments.flatMap((a) => a.workOrderIds);
  const rawWOs = await prisma.workOrder.findMany({
    where: { workOrderId: { in: allWoIds } },
    select: {
      workOrderId: true,
      status: true,
      partId: true,
      quantity: true,
      stockFulfillmentReviewedAt: true,
    },
  });
  const woMap = new Map<number, ValidatedWO>(rawWOs.map((w) => [w.workOrderId, w]));

  for (const woId of allWoIds) {
    const wo = woMap.get(woId);
    if (!wo) throw new WONotBatchCandidateError(woId, "not found");
    if (wo.status !== "Unreleased")
      throw new WONotBatchCandidateError(woId, `status is ${wo.status}, expected Unreleased`);
    if (!wo.stockFulfillmentReviewedAt)
      throw new WONotBatchCandidateError(woId, "not reviewed");
  }

  await prisma.$transaction(
    async (tx) => {
      const now = new Date();

      for (const assignment of input.assignments) {
        const { workOrderIds, targetType, targetBatchId, targetWorkOrderId, plannedQty } =
          assignment;

        const wos = workOrderIds.map((id) => woMap.get(id)!);
        const partId = wos[0]!.partId;

        for (const wo of wos) {
          if (wo.partId !== partId) {
            throw new BatchEligibilityError(
              `All WOs in a single assignment must share the same part`,
              { workOrderIds, conflictingWoId: wo.workOrderId }
            );
          }
        }

        const totalDemand = wos.reduce(
          (sum, w) => sum.plus(w.quantity),
          new Prisma.Decimal(0)
        );

        if (targetType === "standalone") {
          for (const wo of wos) {
            await tx.workOrder.update({
              where: { workOrderId: wo.workOrderId },
              data: { status: "Open" },
            });
            await tx.auditLog.create({
              data: {
                entityType: "WorkOrder",
                entityId: wo.workOrderId,
                auditActionId: auditSingletonConfirmed,
                changedByUserId: userId,
                timestamp: now,
                previousValue: { status: "Unreleased" },
                newValue: { status: "Open" },
              },
            });
          }
          continue;
        }

        if (targetType === "new-batch") {
          const effective = plannedQty ? new Prisma.Decimal(plannedQty) : null;
          if (effective && effective.lt(totalDemand)) {
            throw new BatchEligibilityError(
              `plannedQty ${effective} is less than total demand ${totalDemand}`,
              {
                plannedQty: effective.toFixed(),
                totalDemand: totalDemand.toFixed(),
              }
            );
          }
          const batch = await tx.productionBatch.create({
            data: {
              partId,
              totalQuantity: totalDemand,
              plannedQuantity: effective,
              status: "Planned",
            },
          });
          await tx.workOrder.updateMany({
            where: { workOrderId: { in: workOrderIds } },
            data: { status: "Open", batchId: batch.batchId },
          });
          await tx.auditLog.create({
            data: {
              entityType: "ProductionBatch",
              entityId: batch.batchId,
              auditActionId: auditBatchCreated,
              changedByUserId: userId,
              timestamp: now,
              newValue: {
                workOrderIds,
                totalQuantity: totalDemand.toFixed(),
              },
            },
          });
          for (const wo of wos) {
            await tx.auditLog.create({
              data: {
                entityType: "WorkOrder",
                entityId: wo.workOrderId,
                auditActionId: auditWOBatchingConfirmed,
                changedByUserId: userId,
                timestamp: now,
                previousValue: { status: "Unreleased" },
                newValue: { status: "Open", batchId: batch.batchId },
              },
            });
          }
          continue;
        }

        if (targetType === "add-to-open-batch") {
          if (!targetBatchId) {
            throw new BatchEligibilityError(
              "targetBatchId is required for add-to-open-batch",
              {}
            );
          }
          const batch = await tx.productionBatch.findUnique({
            where: { batchId: targetBatchId },
            select: {
              batchId: true,
              partId: true,
              totalQuantity: true,
              plannedQuantity: true,
            },
          });
          if (!batch) throw new BatchNotFoundError(targetBatchId);
          if (batch.partId !== partId)
            throw new BatchWOPartMismatchError(workOrderIds[0]!, partId, batch.partId);

          const headroom = computeHeadroom(batch.plannedQuantity, batch.totalQuantity);
          if (headroom.lt(totalDemand)) {
            throw new OpenRowHeadroomError(
              targetBatchId,
              headroom.toFixed(),
              totalDemand.toFixed()
            );
          }

          const newTotal = new Prisma.Decimal(batch.totalQuantity).plus(totalDemand);
          await tx.productionBatch.update({
            where: { batchId: targetBatchId },
            data: { totalQuantity: newTotal },
          });
          await tx.workOrder.updateMany({
            where: { workOrderId: { in: workOrderIds } },
            data: { status: "Open", batchId: targetBatchId },
          });
          await tx.auditLog.create({
            data: {
              entityType: "ProductionBatch",
              entityId: targetBatchId,
              auditActionId: auditWOAddedToOpenBatch,
              changedByUserId: userId,
              timestamp: now,
              newValue: {
                addedWorkOrderIds: workOrderIds,
                newTotalQuantity: newTotal.toFixed(),
              },
            },
          });
          for (const wo of wos) {
            await tx.auditLog.create({
              data: {
                entityType: "WorkOrder",
                entityId: wo.workOrderId,
                auditActionId: auditWOBatchingConfirmed,
                changedByUserId: userId,
                timestamp: now,
                previousValue: { status: "Unreleased" },
                newValue: { status: "Open", batchId: targetBatchId },
              },
            });
          }
          continue;
        }

        if (targetType === "add-to-open-wo") {
          if (!targetWorkOrderId) {
            throw new BatchEligibilityError(
              "targetWorkOrderId is required for add-to-open-wo",
              {}
            );
          }
          const openWO = await tx.workOrder.findUnique({
            where: { workOrderId: targetWorkOrderId },
            select: {
              workOrderId: true,
              partId: true,
              quantity: true,
              status: true,
              batchId: true,
              steps: {
                select: { state: true, subStatusId: true, completedQty: true },
              },
            },
          });
          if (!openWO)
            throw new WONotBatchCandidateError(targetWorkOrderId, "not found");
          if (openWO.status !== "Open")
            throw new BatchEligibilityError(
              `Target WO ${targetWorkOrderId} is not Open`,
              { targetWorkOrderId, status: openWO.status }
            );
          if (openWO.partId !== partId)
            throw new BatchWOPartMismatchError(targetWorkOrderId, partId, openWO.partId);

          const targetState = deriveProductionState(openWO.steps as StepRow[]);
          if (targetState !== "case1") {
            throw new BatchEligibilityError(
              `Target WO ${targetWorkOrderId} has production activity and cannot be merged`,
              { targetWorkOrderId, productionState: targetState }
            );
          }

          const newTotal = new Prisma.Decimal(openWO.quantity).plus(totalDemand);
          const batch = await tx.productionBatch.create({
            data: {
              partId,
              totalQuantity: newTotal,
              plannedQuantity: plannedQty ? new Prisma.Decimal(plannedQty) : null,
              status: "Planned",
            },
          });
          await tx.workOrder.update({
            where: { workOrderId: targetWorkOrderId },
            data: { batchId: batch.batchId },
          });
          await tx.workOrder.updateMany({
            where: { workOrderId: { in: workOrderIds } },
            data: { status: "Open", batchId: batch.batchId },
          });
          await tx.auditLog.create({
            data: {
              entityType: "ProductionBatch",
              entityId: batch.batchId,
              auditActionId: auditBatchCreated,
              changedByUserId: userId,
              timestamp: now,
              newValue: {
                mergedFromOpenWoId: targetWorkOrderId,
                addedWorkOrderIds: workOrderIds,
                totalQuantity: newTotal.toFixed(),
              },
            },
          });
          for (const wo of wos) {
            await tx.auditLog.create({
              data: {
                entityType: "WorkOrder",
                entityId: wo.workOrderId,
                auditActionId: auditWOBatchingConfirmed,
                changedByUserId: userId,
                timestamp: now,
                previousValue: { status: "Unreleased" },
                newValue: { status: "Open", batchId: batch.batchId },
              },
            });
          }
        }
      }
    },
    { timeout: 60_000 }
  );
}

// ─── Update Planned Qty ───────────────────────────────────────────────────────

export async function updatePlannedQty(
  batchId: number,
  input: UpdatePlannedQtyInput,
  userId: number
): Promise<void> {
  const batch = await prisma.productionBatch.findUnique({
    where: { batchId },
    select: { batchId: true, totalQuantity: true, plannedQuantity: true },
  });
  if (!batch) throw new BatchNotFoundError(batchId);

  const newPlanned = new Prisma.Decimal(input.plannedQty);
  if (newPlanned.lt(batch.totalQuantity)) {
    throw new BatchEligibilityError(
      `plannedQty ${newPlanned} must be >= totalQuantity ${batch.totalQuantity}`,
      {
        batchId,
        plannedQty: newPlanned.toFixed(),
        totalQuantity: batch.totalQuantity.toFixed(),
      }
    );
  }

  const auditAction = await prisma.auditAction.findFirst({
    where: { actionName: "BatchPlannedQtySet" },
    select: { auditActionId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.productionBatch.update({
      where: { batchId },
      data: { plannedQuantity: newPlanned },
    });
    await tx.auditLog.create({
      data: {
        entityType: "ProductionBatch",
        entityId: batchId,
        auditActionId: auditAction!.auditActionId,
        changedByUserId: userId,
        timestamp: new Date(),
        previousValue: { plannedQuantity: batch.plannedQuantity?.toFixed() ?? null },
        newValue: { plannedQuantity: newPlanned.toFixed() },
      },
    });
  });
}
