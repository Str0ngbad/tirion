import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { isP2002OnField } from "@/lib/db/p2002";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  RoutingTemplateNotFoundError,
  RoutingTemplateNameCollisionError,
  RoutingTemplateAlreadyActiveError,
  RoutingTemplateAlreadyInactiveError,
  RoutingTemplateStepIndexError,
  RoutingTemplateInvalidProcessTypeError,
} from "@/lib/errors/routing-template";
import type {
  ListRoutingTemplatesQuery,
  CreateRoutingTemplateInput,
  UpdateRoutingTemplateInput,
  RoutingTemplateRow,
  RoutingTemplateDetail,
  RoutingTemplateStepRow,
  PartSummary,
  SaveResponse,
} from "@/lib/routing-templates/types";

// ─── Internal Prisma shapes ───────────────────────────────────────────────────

type StepRaw = {
  routingTemplateStepId: number;
  stepIndex: number;
  processTypeId: number;
  processType: { processName: string };
};

type TemplateRaw = {
  routingTemplateDefinitionId: number;
  templateName: string;
  description: string | null;
  isActive: boolean;
  steps: StepRaw[];
  _count: { parts: number };
};

const STEP_INCLUDE = {
  include: {
    processType: { select: { processName: true } },
  },
  orderBy: { stepIndex: "asc" as const },
};

const TEMPLATE_INCLUDE = {
  steps: STEP_INCLUDE,
  _count: {
    select: {
      parts: { where: { isActive: true } },
    },
  },
} as const;

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function toStepRow(raw: StepRaw): RoutingTemplateStepRow {
  return {
    routingTemplateStepId: raw.routingTemplateStepId,
    stepIndex: raw.stepIndex,
    processTypeId: raw.processTypeId,
    processTypeName: raw.processType.processName,
  };
}

function toTemplateRow(raw: TemplateRaw): RoutingTemplateRow {
  return {
    routingTemplateDefinitionId: raw.routingTemplateDefinitionId,
    templateName: raw.templateName,
    description: raw.description,
    isActive: raw.isActive,
    stepCount: raw.steps.length,
    partsReferencingCount: raw._count.parts,
    steps: raw.steps.map(toStepRow),
  };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateStepIndexing(steps: { stepIndex: number }[]): void {
  const sorted = [...steps].map((s) => s.stepIndex).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      throw new RoutingTemplateStepIndexError(sorted);
    }
  }
}

async function validateProcessTypes(
  tx: Prisma.TransactionClient,
  steps: { processTypeId: number }[]
): Promise<void> {
  const ids = steps.map((s) => s.processTypeId);
  const found = await tx.processType.findMany({
    where: { processTypeId: { in: ids } },
    select: { processTypeId: true, isActive: true },
  });
  const foundMap = new Map(found.map((pt) => [pt.processTypeId, pt]));

  for (const { processTypeId } of steps) {
    const pt = foundMap.get(processTypeId);
    if (!pt) {
      throw new RoutingTemplateInvalidProcessTypeError(processTypeId, "process_type_not_found");
    }
    if (!pt.isActive) {
      throw new RoutingTemplateInvalidProcessTypeError(processTypeId, "process_type_inactive");
    }
  }
}

// RoutingTemplateDefinition has no appliesTo/partType field in Phase 1C.
// The Assembly + Purchase/Receive constraint is enforced at Part assignment
// time in the Part service. No create-time check needed here.

// ─── Service functions ────────────────────────────────────────────────────────

export async function listRoutingTemplates(
  query: ListRoutingTemplatesQuery
): Promise<RoutingTemplateRow[]> {
  const where: Prisma.RoutingTemplateDefinitionWhereInput =
    query.active === "all" ? {} : { isActive: query.active === "true" };

  const rows = await prisma.routingTemplateDefinition.findMany({
    where,
    include: TEMPLATE_INCLUDE,
    orderBy: { templateName: "asc" },
  });

  return (rows as unknown as TemplateRaw[]).map(toTemplateRow);
}

export async function getRoutingTemplate(
  routingTemplateDefinitionId: number
): Promise<RoutingTemplateDetail> {
  const raw = await prisma.routingTemplateDefinition.findUnique({
    where: { routingTemplateDefinitionId },
    include: TEMPLATE_INCLUDE,
  });

  if (!raw) throw new RoutingTemplateNotFoundError(routingTemplateDefinitionId);

  const referencingPartsRaw = await prisma.part.findMany({
    where: { routingTemplateDefinitionId, isActive: true },
    select: {
      partId: true,
      partNumber: true,
      partName: true,
      stockCount: true,
    },
    orderBy: { partNumber: "asc" },
  });

  const referencingParts: PartSummary[] = referencingPartsRaw.map((p) => ({
    partId: p.partId,
    partNumber: p.partNumber,
    partName: p.partName,
    stockCount: p.stockCount ? Number(p.stockCount) : 0,
  }));

  const affectedStockCount = referencingParts.reduce((sum, p) => sum + p.stockCount, 0);

  return {
    ...toTemplateRow(raw as unknown as TemplateRaw),
    // Phase 1C: hardcoded 0 until WorkOrder + DefinitionChangeFlag layers exist
    openWorkOrderCount: 0,
    referencingParts,
    affectedStockCount,
    // Reconcile: partsReferencingCount now uses active-only filter (matches referencingParts)
    partsReferencingCount: referencingParts.length,
  };
}

export async function createRoutingTemplate(
  input: CreateRoutingTemplateInput,
  userId: number
): Promise<SaveResponse> {
  // 1. Validate step indexing (contiguous 1-based)
  validateStepIndexing(input.steps);

  return mutateWithAudit({
    userId,
    entityType: "RoutingTemplate",
    action: "RoutingTemplateCreated",
    work: async (tx) => {
      // 2. Validate ProcessType existence and active state
      await validateProcessTypes(tx, input.steps);

      let created;
      try {
        created = await tx.routingTemplateDefinition.create({
          data: {
            templateName: input.templateName,
            description: input.description ?? null,
            steps: {
              create: input.steps.map((s) => ({
                stepIndex: s.stepIndex,
                processTypeId: s.processTypeId,
              })),
            },
          },
          include: TEMPLATE_INCLUDE,
        });
      } catch (err) {
        if (isP2002OnField(err, "templateName")) {
          throw new RoutingTemplateNameCollisionError(input.templateName);
        }
        throw err;
      }

      const template = toTemplateRow(created as unknown as TemplateRaw);
      return {
        entityId: created.routingTemplateDefinitionId,
        previousValue: null,
        newValue: template as unknown as Prisma.InputJsonValue,
        result: { template, flaggedWoCount: 0 } satisfies SaveResponse,
      };
    },
  });
}

export async function updateRoutingTemplate(
  routingTemplateDefinitionId: number,
  input: UpdateRoutingTemplateInput,
  userId: number
): Promise<SaveResponse> {
  if (input.steps) {
    validateStepIndexing(input.steps);
  }

  return mutateWithAudit({
    userId,
    entityType: "RoutingTemplate",
    action: "RoutingTemplateEdited",
    work: async (tx) => {
      const existing = await tx.routingTemplateDefinition.findUnique({
        where: { routingTemplateDefinitionId },
        include: TEMPLATE_INCLUDE,
      });
      if (!existing) throw new RoutingTemplateNotFoundError(routingTemplateDefinitionId);
      const previousValue = toTemplateRow(existing as unknown as TemplateRaw);

      if (input.steps) {
        await validateProcessTypes(tx, input.steps);
        // Full replacement: delete existing steps, insert new set atomically
        await tx.routingTemplateStep.deleteMany({ where: { routingTemplateDefinitionId } });
      }

      let updated;
      try {
        updated = await tx.routingTemplateDefinition.update({
          where: { routingTemplateDefinitionId },
          data: {
            ...(input.templateName !== undefined && { templateName: input.templateName }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.steps && {
              steps: {
                create: input.steps.map((s) => ({
                  stepIndex: s.stepIndex,
                  processTypeId: s.processTypeId,
                })),
              },
            }),
          },
          include: TEMPLATE_INCLUDE,
        });
      } catch (err) {
        if (isP2002OnField(err, "templateName")) {
          throw new RoutingTemplateNameCollisionError(input.templateName!);
        }
        throw err;
      }

      const template = toTemplateRow(updated as unknown as TemplateRaw);
      return {
        entityId: routingTemplateDefinitionId,
        previousValue: previousValue as unknown as Prisma.InputJsonValue,
        newValue: template as unknown as Prisma.InputJsonValue,
        // Phase 1C: flaggedWoCount is always 0; DefinitionChangeFlag logic
        // lands here when WorkOrder + Flag layers are built in Phase 1C+.
        result: { template, flaggedWoCount: 0 } satisfies SaveResponse,
      };
    },
  });
}

export async function deactivateRoutingTemplate(
  routingTemplateDefinitionId: number,
  userId: number
): Promise<RoutingTemplateRow> {
  return mutateWithAudit({
    userId,
    entityType: "RoutingTemplate",
    action: "RoutingTemplateRetired",
    work: async (tx) => {
      const existing = await tx.routingTemplateDefinition.findUnique({
        where: { routingTemplateDefinitionId },
        include: TEMPLATE_INCLUDE,
      });
      if (!existing) throw new RoutingTemplateNotFoundError(routingTemplateDefinitionId);
      if (!existing.isActive) throw new RoutingTemplateAlreadyInactiveError(routingTemplateDefinitionId);

      const updated = await tx.routingTemplateDefinition.update({
        where: { routingTemplateDefinitionId },
        data: { isActive: false },
        include: TEMPLATE_INCLUDE,
      });

      const result = toTemplateRow(updated as unknown as TemplateRaw);
      return {
        entityId: routingTemplateDefinitionId,
        previousValue: toTemplateRow(existing as unknown as TemplateRaw) as unknown as Prisma.InputJsonValue,
        newValue: result as unknown as Prisma.InputJsonValue,
        result,
      };
    },
  });
}

export async function reactivateRoutingTemplate(
  routingTemplateDefinitionId: number,
  userId: number
): Promise<RoutingTemplateRow> {
  return mutateWithAudit({
    userId,
    entityType: "RoutingTemplate",
    action: "RoutingTemplateReactivated",
    work: async (tx) => {
      const existing = await tx.routingTemplateDefinition.findUnique({
        where: { routingTemplateDefinitionId },
        include: TEMPLATE_INCLUDE,
      });
      if (!existing) throw new RoutingTemplateNotFoundError(routingTemplateDefinitionId);
      if (existing.isActive) throw new RoutingTemplateAlreadyActiveError(routingTemplateDefinitionId);

      const updated = await tx.routingTemplateDefinition.update({
        where: { routingTemplateDefinitionId },
        data: { isActive: true },
        include: TEMPLATE_INCLUDE,
      });

      const result = toTemplateRow(updated as unknown as TemplateRaw);
      return {
        entityId: routingTemplateDefinitionId,
        previousValue: toTemplateRow(existing as unknown as TemplateRaw) as unknown as Prisma.InputJsonValue,
        newValue: result as unknown as Prisma.InputJsonValue,
        result,
      };
    },
  });
}
