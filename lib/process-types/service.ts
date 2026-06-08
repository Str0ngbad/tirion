import { prisma } from "@/lib/db/client";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import { ProcessTypeNotFoundError } from "@/lib/errors/process-type";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProcessTypeDetail = {
  processTypeId: number;
  processName: string;
  processCode: string;
  description: string | null;
  isActive: boolean;
  routingTemplatesCount: number;
  partsCount: number;
};

export type UpdateProcessTypeInput = {
  description?: string | null;
};

// ─── Service functions ────────────────────────────────────────────────────────

export async function getProcessTypeDetail(
  processTypeId: number
): Promise<ProcessTypeDetail> {
  const [processType, routingTemplatesCount, partsCount] = await Promise.all([
    prisma.processType.findUnique({
      where: { processTypeId },
      select: {
        processTypeId: true,
        processName: true,
        processCode: true,
        description: true,
        isActive: true,
      },
    }),
    // Distinct routing templates that have at least one step with this process type
    prisma.routingTemplateDefinition.count({
      where: {
        steps: { some: { processTypeId } },
      },
    }),
    // Active parts whose assigned routing template references this process type
    prisma.part.count({
      where: {
        isActive: true,
        routingTemplate: {
          steps: { some: { processTypeId } },
        },
      },
    }),
  ]);

  if (processType === null) throw new ProcessTypeNotFoundError(processTypeId);

  return {
    ...processType,
    routingTemplatesCount,
    partsCount,
  };
}

export async function updateProcessType(
  processTypeId: number,
  input: UpdateProcessTypeInput,
  actorUserId: number
): Promise<ProcessTypeDetail> {
  const result = await mutateWithAudit<ProcessTypeDetail>({
    userId: actorUserId,
    entityType: "ProcessType",
    action: "ProcessTypeUpdated",
    work: async (tx) => {
      const existing = await tx.processType.findUnique({
        where: { processTypeId },
        select: { processTypeId: true, description: true },
      });

      if (existing === null) throw new ProcessTypeNotFoundError(processTypeId);

      await tx.processType.update({
        where: { processTypeId },
        data: {
          ...(input.description !== undefined && { description: input.description }),
        },
      });

      const detail = await getProcessTypeDetail(processTypeId);

      return {
        entityId: processTypeId,
        previousValue: { description: existing.description },
        newValue: { description: input.description ?? existing.description },
        result: detail,
      };
    },
  });

  return result;
}
