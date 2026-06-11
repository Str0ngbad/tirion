import { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  ProjectNotFoundError,
  ProjectNumberConflictError,
  ProjectNotDraftError,
  TopLevelItemNotFoundError,
  TopLevelItemPartInactiveError,
  ProjectCompilationError,
} from "@/lib/errors/project";
import type { ValidationFailure } from "@/lib/errors/project";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  AddTopLevelItemInput,
  UpdateTopLevelItemInput,
  ListProjectsQuery,
} from "@/lib/projects/schemas";

function isP2002(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getProjects(filters?: ListProjectsQuery) {
  const where: Prisma.ProjectWhereInput = {};

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    const validStatuses = statuses.filter((s): s is ProjectStatus =>
      Object.values(ProjectStatus).includes(s as ProjectStatus)
    );
    if (validStatuses.length > 0) where.status = { in: validStatuses };
  }

  if (filters?.customerName) {
    where.customerName = { contains: filters.customerName, mode: "insensitive" };
  }

  return prisma.project.findMany({
    where,
    include: {
      topLevelItems: true,
      creator: { select: { displayName: true } },
      lastEditedBy: { select: { displayName: true } },
    },
    orderBy: { lastEditedAt: "desc" },
  });
}

export async function getProjectById(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { projectId },
    include: {
      topLevelItems: {
        orderBy: { topLevelIndex: "asc" },
        include: {
          part: { select: { partNumber: true, partName: true, partType: true } },
        },
      },
    },
  });
  if (!project) throw new ProjectNotFoundError(projectId);
  return project;
}

// ─── Create / Update / Delete ─────────────────────────────────────────────────

export async function createProject(data: CreateProjectInput, actingUserId: number) {
  try {
    return await mutateWithAudit({
      userId: actingUserId,
      entityType: "Project",
      action: "ProjectCreated",
      work: async (tx) => {
        const project = await tx.project.create({
          data: {
            projectNumber: data.projectNumber,
            projectName: data.projectName,
            customerName: data.customerName ?? null,
            dueDate: data.dueDate ?? null,
            priority: data.priority ?? null,
            color: data.color ?? null,
            notes: data.notes ?? null,
            status: "Draft",
            creatorUserId: actingUserId,
            lastEditedUserId: actingUserId,
          },
          include: { topLevelItems: true },
        });
        return {
          entityId: project.projectId,
          previousValue: null,
          newValue: {
            projectNumber: project.projectNumber,
            projectName: project.projectName,
            status: project.status,
          },
          result: project,
        };
      },
    });
  } catch (err) {
    if (isP2002(err)) throw new ProjectNumberConflictError(data.projectNumber);
    throw err;
  }
}

export async function updateProject(
  projectId: number,
  data: UpdateProjectInput,
  actingUserId: number
) {
  try {
    return await mutateWithAudit({
      userId: actingUserId,
      entityType: "Project",
      action: "ProjectUpdated",
      work: async (tx) => {
        const project = await tx.project.findUnique({ where: { projectId } });
        if (!project) throw new ProjectNotFoundError(projectId);

        // projectNumber is only mutable on Draft projects
        if (data.projectNumber !== undefined && project.status !== "Draft") {
          throw new ProjectNotDraftError(projectId, project.status);
        }

        const updated = await tx.project.update({
          where: { projectId },
          data: {
            ...data,
            lastEditedAt: new Date(),
            lastEditedUserId: actingUserId,
          },
          include: {
            topLevelItems: {
              orderBy: { topLevelIndex: "asc" },
              include: {
                part: { select: { partNumber: true, partName: true, partType: true } },
              },
            },
          },
        });

        return {
          entityId: projectId,
          previousValue: {
            projectNumber: project.projectNumber,
            projectName: project.projectName,
            customerName: project.customerName,
          },
          newValue: {
            projectNumber: updated.projectNumber,
            projectName: updated.projectName,
            customerName: updated.customerName,
          },
          result: updated,
        };
      },
    });
  } catch (err) {
    if (isP2002(err)) throw new ProjectNumberConflictError(data.projectNumber ?? "");
    throw err;
  }
}

export async function deleteProject(projectId: number, actingUserId: number) {
  await mutateWithAudit({
    userId: actingUserId,
    entityType: "Project",
    action: "ProjectDeleted",
    work: async (tx) => {
      const project = await tx.project.findUnique({ where: { projectId } });
      if (!project) throw new ProjectNotFoundError(projectId);
      if (project.status !== "Draft") throw new ProjectNotDraftError(projectId, project.status);

      await tx.project.delete({ where: { projectId } });

      return {
        entityId: projectId,
        previousValue: {
          projectNumber: project.projectNumber,
          projectName: project.projectName,
          status: project.status,
        },
        newValue: null,
        result: undefined,
      };
    },
  });
}

// ─── Top-Level Items ──────────────────────────────────────────────────────────

export async function addTopLevelItem(
  projectId: number,
  data: AddTopLevelItemInput,
  actingUserId: number
) {
  return mutateWithAudit({
    userId: actingUserId,
    entityType: "Project",
    action: "ProjectUpdated",
    work: async (tx) => {
      const project = await tx.project.findUnique({ where: { projectId } });
      if (!project) throw new ProjectNotFoundError(projectId);
      if (project.status !== "Draft") throw new ProjectNotDraftError(projectId, project.status);

      const part = await tx.part.findUnique({ where: { partId: data.partId } });
      if (!part || !part.isActive) {
        throw new TopLevelItemPartInactiveError(data.partId, part?.partNumber ?? String(data.partId));
      }

      // Use Project.nextTopLevelIndex as the monotonic counter (PC-21 — indices are never reused)
      const nextIndex = project.nextTopLevelIndex;

      const item = await tx.projectTopLevelItem.create({
        data: {
          projectId,
          partId: data.partId,
          quantity: data.quantity,
          topLevelIndex: nextIndex,
        },
      });

      await tx.project.update({
        where: { projectId },
        data: {
          nextTopLevelIndex: { increment: 1 },
          lastEditedAt: new Date(),
          lastEditedUserId: actingUserId,
        },
      });

      return {
        entityId: projectId,
        previousValue: null,
        newValue: { topLevelItemId: item.topLevelItemId, topLevelIndex: nextIndex },
        result: item,
      };
    },
  });
}

export async function updateTopLevelItem(
  projectId: number,
  topLevelItemId: number,
  data: UpdateTopLevelItemInput,
  actingUserId: number
) {
  return mutateWithAudit({
    userId: actingUserId,
    entityType: "Project",
    action: "ProjectUpdated",
    work: async (tx) => {
      const project = await tx.project.findUnique({ where: { projectId } });
      if (!project) throw new ProjectNotFoundError(projectId);
      if (project.status !== "Draft") throw new ProjectNotDraftError(projectId, project.status);

      const item = await tx.projectTopLevelItem.findUnique({ where: { topLevelItemId } });
      if (!item || item.projectId !== projectId) throw new TopLevelItemNotFoundError(topLevelItemId);

      const updated = await tx.projectTopLevelItem.update({
        where: { topLevelItemId },
        data: { quantity: data.quantity },
      });

      await tx.project.update({
        where: { projectId },
        data: { lastEditedAt: new Date(), lastEditedUserId: actingUserId },
      });

      return {
        entityId: projectId,
        previousValue: { topLevelItemId, quantity: item.quantity },
        newValue: { topLevelItemId, quantity: data.quantity },
        result: updated,
      };
    },
  });
}

export async function removeTopLevelItem(
  projectId: number,
  topLevelItemId: number,
  actingUserId: number
) {
  await mutateWithAudit({
    userId: actingUserId,
    entityType: "Project",
    action: "ProjectUpdated",
    work: async (tx) => {
      const project = await tx.project.findUnique({ where: { projectId } });
      if (!project) throw new ProjectNotFoundError(projectId);
      if (project.status !== "Draft") throw new ProjectNotDraftError(projectId, project.status);

      const item = await tx.projectTopLevelItem.findUnique({ where: { topLevelItemId } });
      if (!item || item.projectId !== projectId) throw new TopLevelItemNotFoundError(topLevelItemId);

      // Hard delete; topLevelIndex is never reused (PC-21)
      await tx.projectTopLevelItem.delete({ where: { topLevelItemId } });

      await tx.project.update({
        where: { projectId },
        data: { lastEditedAt: new Date(), lastEditedUserId: actingUserId },
      });

      return {
        entityId: projectId,
        previousValue: { topLevelItemId, topLevelIndex: item.topLevelIndex },
        newValue: null,
        result: undefined,
      };
    },
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

// Recursive BOM node type for tree walking
type BomNode = {
  childPartId: number;
  quantity: Prisma.Decimal;
  childPart: {
    partId: number;
    partNumber: string;
    partName: string;
    isActive: boolean;
    routingTemplateDefinitionId: number | null;
    routingTemplate: { isActive: boolean; routingTemplateDefinitionId: number; templateName: string } | null;
    bomParent: BomNode[];
  };
};

async function fetchBomTree(
  tx: Prisma.TransactionClient,
  partId: number
): Promise<BomNode[]> {
  return tx.bOM.findMany({
    where: { parentPartId: partId },
    include: {
      childPart: {
        include: {
          routingTemplate: true,
          bomParent: {
            include: {
              childPart: {
                include: {
                  routingTemplate: true,
                  // Nested fetching is handled by walking recursively
                  bomParent: true,
                },
              },
            },
          },
        },
      },
    },
  }) as unknown as BomNode[];
}

type PartForValidation = {
  partId: number;
  partNumber: string;
  partName: string;
  isActive: boolean;
  routingTemplateDefinitionId: number | null;
  routingTemplate: { isActive: boolean; routingTemplateDefinitionId: number; templateName: string } | null;
};

async function walkBomForValidation(
  tx: Prisma.TransactionClient,
  partId: number,
  topLevelRef: string,
  pathSoFar: string[],
  failures: ValidationFailure[]
): Promise<void> {
  const part = await tx.part.findUniqueOrThrow({
    where: { partId },
    include: { routingTemplate: true },
  }) as PartForValidation;

  const currentPath = [...pathSoFar, part.partNumber];

  if (!part.isActive) {
    failures.push({
      partId: part.partId,
      partNumber: part.partNumber,
      partName: part.partName,
      bomPath: [topLevelRef, ...currentPath],
      failureType: "part-inactive",
    });
    // Stop checking this node but continue siblings (caller handles iteration)
    return;
  }

  if (part.routingTemplateDefinitionId === null) {
    failures.push({
      partId: part.partId,
      partNumber: part.partNumber,
      partName: part.partName,
      bomPath: [topLevelRef, ...currentPath],
      failureType: "no-template",
    });
    // Continue walking children even on failure
  } else if (part.routingTemplate && !part.routingTemplate.isActive) {
    failures.push({
      partId: part.partId,
      partNumber: part.partNumber,
      partName: part.partName,
      bomPath: [topLevelRef, ...currentPath],
      failureType: "template-inactive",
      templateId: part.routingTemplate.routingTemplateDefinitionId,
      templateName: part.routingTemplate.templateName,
    });
    // Continue walking children
  }

  // Walk children regardless of parent failure
  const children = await tx.bOM.findMany({
    where: { parentPartId: partId },
    select: { childPartId: true },
  });

  for (const child of children) {
    await walkBomForValidation(tx, child.childPartId, topLevelRef, currentPath, failures);
  }
}

export async function validateProject(projectId: number): Promise<ValidationFailure[]> {
  const project = await prisma.project.findUnique({
    where: { projectId },
    include: { topLevelItems: { orderBy: { topLevelIndex: "asc" } } },
  });
  if (!project) throw new ProjectNotFoundError(projectId);

  const failures: ValidationFailure[] = [];

  // Use a read-only transaction for consistency
  await prisma.$transaction(async (tx) => {
    for (const item of project.topLevelItems) {
      // Top-Level Reference: projectNumber + '.' + zero-padded topLevelIndex
      const topLevelRef = `${project.projectNumber}.${String(item.topLevelIndex).padStart(2, "0")}`;
      await walkBomForValidation(tx, item.partId, topLevelRef, [], failures);
    }
  });

  return failures;
}

// ─── Compile ──────────────────────────────────────────────────────────────────

async function walkAndCreateWOs(
  tx: Prisma.TransactionClient,
  projectId: number,
  partId: number,
  parentWoId: number | null,
  topLevelIndex: number | null,
  quantity: Prisma.Decimal,
  priority: number | null,
  dueDate: Date | null,
  projectAuditActionId: number,
  woAuditActionId: number,
  actingUserId: number,
  woCount: { n: number }
): Promise<void> {
  const part = await tx.part.findUniqueOrThrow({
    where: { partId },
    include: {
      routingTemplate: {
        include: { steps: { orderBy: { stepIndex: "asc" } } },
      },
    },
  });

  const wo = await tx.workOrder.create({
    data: {
      projectId,
      partId,
      parentWoId,
      routingTemplateDefinitionId: part.routingTemplateDefinitionId!,
      topLevelIndex,
      quantity,
      priority,
      dueDate,
      status: "Unreleased",
    },
  });

  woCount.n++;

  if (part.routingTemplate && part.routingTemplate.steps.length > 0) {
    await tx.workOrderStep.createMany({
      data: part.routingTemplate.steps.map((step) => ({
        workOrderId: wo.workOrderId,
        processTypeId: step.processTypeId,
        stepIndex: step.stepIndex,
        state: "Waiting",
      })),
    });
  }

  await tx.auditLog.create({
    data: {
      entityType: "WorkOrder",
      entityId: wo.workOrderId,
      auditActionId: woAuditActionId,
      changedByUserId: actingUserId,
      newValue: {
        projectId,
        partId,
        quantity: quantity.toString(),
        status: "Unreleased",
      },
    },
  });

  // Recurse into children
  const children = await tx.bOM.findMany({
    where: { parentPartId: partId },
    orderBy: { bomId: "asc" },
  });

  for (const child of children) {
    const childQty = quantity.mul(child.quantity);
    await walkAndCreateWOs(
      tx,
      projectId,
      child.childPartId,
      wo.workOrderId,
      null,
      childQty,
      priority,
      dueDate,
      projectAuditActionId,
      woAuditActionId,
      actingUserId,
      woCount
    );
  }
}

export async function compileProject(projectId: number, actingUserId: number) {
  // Step 1: validate — no state changes
  const failures = await validateProject(projectId);
  if (failures.length > 0) throw new ProjectCompilationError(failures);

  // Pre-fetch audit action IDs outside the transaction
  const [projectCompiledAction, woCreatedAction] = await Promise.all([
    prisma.auditAction.findUniqueOrThrow({ where: { actionName: "ProjectCompiled" } }),
    prisma.auditAction.findUniqueOrThrow({ where: { actionName: "WorkOrderCreated" } }),
  ]);

  const result = await prisma.$transaction(async (tx) => {
    // Re-fetch project inside transaction for atomicity
    const project = await tx.project.findUniqueOrThrow({
      where: { projectId },
      include: { topLevelItems: { orderBy: { topLevelIndex: "asc" } } },
    });

    // Step 2a: set Project status = Active
    await tx.project.update({
      where: { projectId },
      data: {
        status: "Active",
        lastEditedAt: new Date(),
        lastEditedUserId: actingUserId,
      },
    });

    const woCount = { n: 0 };

    // Step 2b: walk BOM tree from each top-level item in topLevelIndex order
    for (const item of project.topLevelItems) {
      await walkAndCreateWOs(
        tx,
        projectId,
        item.partId,
        null,
        item.topLevelIndex,
        item.quantity,
        project.priority,
        project.dueDate ?? null,
        projectCompiledAction.auditActionId,
        woCreatedAction.auditActionId,
        actingUserId,
        woCount
      );
    }

    // Step 2c: write Project audit entry
    await tx.auditLog.create({
      data: {
        entityType: "Project",
        entityId: projectId,
        auditActionId: projectCompiledAction.auditActionId,
        changedByUserId: actingUserId,
        previousValue: { status: "Draft" },
        newValue: { status: "Active", workOrderCount: woCount.n },
      },
    });

    const compiledProject = await tx.project.findUniqueOrThrow({
      where: { projectId },
      include: { topLevelItems: { orderBy: { topLevelIndex: "asc" } } },
    });

    return { project: compiledProject, workOrderCount: woCount.n };
  });

  return result;
}
