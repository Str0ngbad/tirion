import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { isP2002OnComposite } from "@/lib/db/p2002";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  ProcessTypeSubStatusNotFoundError,
  ProcessTypeSubStatusAlreadyActiveError,
  ProcessTypeSubStatusAlreadyInactiveError,
  ProcessTypeSubStatusCollisionError,
} from "@/lib/errors/process-type-sub-status";
import { ProcessTypeNotFoundError } from "@/lib/errors/process-type";
import type {
  ListProcessTypeSubStatusesQuery,
  CreateProcessTypeSubStatusInput,
  UpdateProcessTypeSubStatusInput,
  ProcessTypeSubStatus,
} from "@/lib/process-type-sub-statuses/types";

// ─── Internal types ───────────────────────────────────────────────────────────

type ProcessTypeSubStatusRaw = {
  processTypeSubStatusId: number;
  processTypeId: number;
  subStatusName: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  processType: {
    processCode: string;
    processName: string;
  };
  _count: {
    workOrderSteps: number;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toProcessTypeSubStatus(raw: ProcessTypeSubStatusRaw): ProcessTypeSubStatus {
  return {
    processTypeSubStatusId: raw.processTypeSubStatusId,
    processTypeId: raw.processTypeId,
    processCode: raw.processType.processCode,
    processName: raw.processType.processName,
    subStatusName: raw.subStatusName,
    description: raw.description,
    displayOrder: raw.displayOrder,
    isActive: raw.isActive,
    usedByCount: raw._count.workOrderSteps,
  };
}

async function fetchByIdWithProcessType(
  tx: Prisma.TransactionClient,
  processTypeSubStatusId: number
): Promise<ProcessTypeSubStatusRaw> {
  return tx.processTypeSubStatus.findUniqueOrThrow({
    where: { processTypeSubStatusId },
    include: {
      processType: { select: { processCode: true, processName: true } },
      _count: { select: { workOrderSteps: true } },
    },
  }) as Promise<ProcessTypeSubStatusRaw>;
}

function isCollision(err: unknown): boolean {
  return isP2002OnComposite(err, ["processTypeId", "subStatusName"]);
}

async function assertProcessTypeExists(
  tx: Prisma.TransactionClient,
  processTypeId: number
): Promise<void> {
  const pt = await tx.processType.findUnique({ where: { processTypeId } });
  if (!pt) throw new ProcessTypeNotFoundError(processTypeId);
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listProcessTypeSubStatuses(
  query: ListProcessTypeSubStatusesQuery
): Promise<ProcessTypeSubStatus[]> {
  let activeFilter: Prisma.ProcessTypeSubStatusWhereInput;

  switch (query.active) {
    case "true":
      activeFilter = { isActive: true };
      break;
    case "false":
      activeFilter = { isActive: false };
      break;
    case "all":
      activeFilter = {};
      break;
    default: {
      const _exhaustive: never = query.active;
      throw new Error(`Unhandled active filter: ${String(_exhaustive)}`);
    }
  }

  const where: Prisma.ProcessTypeSubStatusWhereInput = {
    ...activeFilter,
    ...(query.processTypeId !== undefined ? { processTypeId: query.processTypeId } : {}),
  };

  const rows = await prisma.processTypeSubStatus.findMany({
    where,
    include: {
      processType: { select: { processCode: true, processName: true } },
      _count: { select: { workOrderSteps: true } },
    },
    orderBy: [
      { processTypeId: "asc" },
      { displayOrder: "asc" },
      { subStatusName: "asc" },
    ],
  });

  return rows.map((r) => toProcessTypeSubStatus(r as ProcessTypeSubStatusRaw));
}

export async function getProcessTypeSubStatus(
  processTypeSubStatusId: number
): Promise<ProcessTypeSubStatus> {
  const raw = await prisma.processTypeSubStatus.findUnique({
    where: { processTypeSubStatusId },
    include: {
      processType: { select: { processCode: true, processName: true } },
      _count: { select: { workOrderSteps: true } },
    },
  });

  if (raw === null) throw new ProcessTypeSubStatusNotFoundError(processTypeSubStatusId);

  return toProcessTypeSubStatus(raw as ProcessTypeSubStatusRaw);
}

export async function createProcessTypeSubStatus(
  input: CreateProcessTypeSubStatusInput,
  actorUserId: number
): Promise<ProcessTypeSubStatus> {
  try {
    return await mutateWithAudit<ProcessTypeSubStatus>({
      userId: actorUserId,
      entityType: "ProcessTypeSubStatus",
      action: "ProcessTypeSubStatusCreated",
      work: async (tx) => {
        await assertProcessTypeExists(tx, input.processTypeId);

        let created: { processTypeSubStatusId: number };
        try {
          created = await tx.processTypeSubStatus.create({
            data: {
              processTypeId: input.processTypeId,
              subStatusName: input.subStatusName,
              description: input.description ?? null,
              displayOrder: input.displayOrder ?? 0,
            },
            select: { processTypeSubStatusId: true },
          });
        } catch (err) {
          if (isCollision(err)) {
            throw new ProcessTypeSubStatusCollisionError(
              input.processTypeId,
              input.subStatusName
            );
          }
          throw err;
        }

        const refreshed = await fetchByIdWithProcessType(tx, created.processTypeSubStatusId);
        const result = toProcessTypeSubStatus(refreshed);

        return {
          entityId: created.processTypeSubStatusId,
          previousValue: null,
          newValue: {
            processTypeId: refreshed.processTypeId,
            subStatusName: refreshed.subStatusName,
            description: refreshed.description,
            displayOrder: refreshed.displayOrder,
          },
          result,
        };
      },
    });
  } catch (err) {
    throw err;
  }
}

export async function updateProcessTypeSubStatus(
  processTypeSubStatusId: number,
  input: UpdateProcessTypeSubStatusInput,
  actorUserId: number
): Promise<ProcessTypeSubStatus> {
  return mutateWithAudit<ProcessTypeSubStatus>({
    userId: actorUserId,
    entityType: "ProcessTypeSubStatus",
    action: "ProcessTypeSubStatusUpdated",
    work: async (tx) => {
      const existing = await tx.processTypeSubStatus.findUnique({
        where: { processTypeSubStatusId },
        include: { processType: { select: { processCode: true, processName: true } } },
      });
      if (existing === null) throw new ProcessTypeSubStatusNotFoundError(processTypeSubStatusId);

      const previousValue = {
        subStatusName: existing.subStatusName,
        description: existing.description,
        displayOrder: existing.displayOrder,
      };

      try {
        await tx.processTypeSubStatus.update({
          where: { processTypeSubStatusId },
          data: {
            ...(input.subStatusName !== undefined && { subStatusName: input.subStatusName }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
          },
        });
      } catch (err) {
        if (isCollision(err)) {
          const effectiveName = input.subStatusName ?? existing.subStatusName;
          throw new ProcessTypeSubStatusCollisionError(
            existing.processTypeId,
            effectiveName
          );
        }
        throw err;
      }

      const refreshed = await fetchByIdWithProcessType(tx, processTypeSubStatusId);
      const result = toProcessTypeSubStatus(refreshed);

      return {
        entityId: processTypeSubStatusId,
        previousValue,
        newValue: {
          subStatusName: refreshed.subStatusName,
          description: refreshed.description,
          displayOrder: refreshed.displayOrder,
        },
        result,
      };
    },
  });
}

export async function deactivateProcessTypeSubStatus(
  processTypeSubStatusId: number,
  actorUserId: number
): Promise<ProcessTypeSubStatus> {
  return mutateWithAudit<ProcessTypeSubStatus>({
    userId: actorUserId,
    entityType: "ProcessTypeSubStatus",
    action: "ProcessTypeSubStatusDeactivated",
    work: async (tx) => {
      const existing = await tx.processTypeSubStatus.findUnique({
        where: { processTypeSubStatusId },
        include: { processType: { select: { processCode: true, processName: true } } },
      });
      if (existing === null) throw new ProcessTypeSubStatusNotFoundError(processTypeSubStatusId);
      if (!existing.isActive) throw new ProcessTypeSubStatusAlreadyInactiveError(processTypeSubStatusId);

      await tx.processTypeSubStatus.update({
        where: { processTypeSubStatusId },
        data: { isActive: false },
      });

      const refreshed = await fetchByIdWithProcessType(tx, processTypeSubStatusId);
      const result = toProcessTypeSubStatus(refreshed);

      return {
        entityId: processTypeSubStatusId,
        previousValue: { isActive: true },
        newValue: { isActive: false },
        result,
      };
    },
  });
}

export async function reactivateProcessTypeSubStatus(
  processTypeSubStatusId: number,
  actorUserId: number
): Promise<ProcessTypeSubStatus> {
  return mutateWithAudit<ProcessTypeSubStatus>({
    userId: actorUserId,
    entityType: "ProcessTypeSubStatus",
    action: "ProcessTypeSubStatusReactivated",
    work: async (tx) => {
      const existing = await tx.processTypeSubStatus.findUnique({
        where: { processTypeSubStatusId },
        include: { processType: { select: { processCode: true, processName: true } } },
      });
      if (existing === null) throw new ProcessTypeSubStatusNotFoundError(processTypeSubStatusId);
      if (existing.isActive) throw new ProcessTypeSubStatusAlreadyActiveError(processTypeSubStatusId);

      await tx.processTypeSubStatus.update({
        where: { processTypeSubStatusId },
        data: { isActive: true },
      });

      const refreshed = await fetchByIdWithProcessType(tx, processTypeSubStatusId);
      const result = toProcessTypeSubStatus(refreshed);

      return {
        entityId: processTypeSubStatusId,
        previousValue: { isActive: false },
        newValue: { isActive: true },
        result,
      };
    },
  });
}
