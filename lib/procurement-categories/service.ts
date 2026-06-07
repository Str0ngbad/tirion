import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { isP2002OnField } from "@/lib/db/p2002";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  ProcurementCategoryNotFoundError,
  ProcurementCategoryAlreadyActiveError,
  ProcurementCategoryAlreadyInactiveError,
  ProcurementCategoryCodeCollisionError,
  ProcurementCategoryNameCollisionError,
} from "@/lib/errors/procurement-category";
import type {
  ListProcurementCategoriesQuery,
  CreateProcurementCategoryInput,
  UpdateProcurementCategoryInput,
  ProcurementCategoryWithCounts,
  ProcurementCategoryWithParts,
} from "@/lib/procurement-categories/types";

type ProcurementCategoryWithCountsRaw = {
  procurementCategoryId: number;
  categoryCode: string;
  categoryName: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  _count: {
    parts: number;
  };
};

function toProcurementCategoryWithCounts(
  raw: ProcurementCategoryWithCountsRaw
): ProcurementCategoryWithCounts {
  return {
    procurementCategoryId: raw.procurementCategoryId,
    categoryCode: raw.categoryCode,
    categoryName: raw.categoryName,
    description: raw.description,
    displayOrder: raw.displayOrder,
    isActive: raw.isActive,
    usedByCount: raw._count.parts,
  };
}

async function fetchWithCounts(
  tx: Prisma.TransactionClient,
  procurementCategoryId: number
): Promise<ProcurementCategoryWithCountsRaw> {
  return tx.procurementCategory.findUniqueOrThrow({
    where: { procurementCategoryId },
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
        },
      },
    },
  });
}

function isCodeCollision(err: unknown): boolean {
  return isP2002OnField(err, "categoryCode");
}

function isNameCollision(err: unknown): boolean {
  return isP2002OnField(err, "categoryName");
}

export async function listProcurementCategories(
  query: ListProcurementCategoriesQuery
): Promise<ProcurementCategoryWithCounts[]> {
  let where: Prisma.ProcurementCategoryWhereInput;

  switch (query.active) {
    case "true":
      where = { isActive: true };
      break;
    case "false":
      where = { isActive: false };
      break;
    case "all":
      where = {};
      break;
    default: {
      const _exhaustive: never = query.active;
      throw new Error(`Unhandled active filter: ${String(_exhaustive)}`);
    }
  }

  const rows = await prisma.procurementCategory.findMany({
    where,
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { categoryName: "asc" }],
  });

  return rows.map(toProcurementCategoryWithCounts);
}

export async function getProcurementCategory(
  procurementCategoryId: number
): Promise<ProcurementCategoryWithParts> {
  const raw = await prisma.procurementCategory.findUnique({
    where: { procurementCategoryId },
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
        },
      },
      parts: {
        where: { isActive: true },
        select: { partId: true, partNumber: true, partName: true },
        orderBy: { partNumber: "asc" },
      },
    },
  });

  if (raw === null) throw new ProcurementCategoryNotFoundError(procurementCategoryId);

  return {
    ...toProcurementCategoryWithCounts(raw),
    parts: raw.parts,
  };
}

export async function createProcurementCategory(
  input: CreateProcurementCategoryInput,
  userId: number
): Promise<ProcurementCategoryWithCounts> {
  try {
    return await mutateWithAudit<ProcurementCategoryWithCounts>({
      userId,
      entityType: "ProcurementCategory",
      action: "ProcurementCategoryCreated",
      work: async (tx) => {
        const created = await tx.procurementCategory.create({
          data: {
            categoryCode: input.categoryCode,
            categoryName: input.categoryName,
            description: input.description ?? null,
            displayOrder: input.displayOrder ?? 0,
          },
        });

        const result: ProcurementCategoryWithCounts = {
          procurementCategoryId: created.procurementCategoryId,
          categoryCode: created.categoryCode,
          categoryName: created.categoryName,
          description: created.description,
          displayOrder: created.displayOrder,
          isActive: created.isActive,
          usedByCount: 0,
        };

        return {
          entityId: created.procurementCategoryId,
          previousValue: null,
          newValue: {
            categoryCode: created.categoryCode,
            categoryName: created.categoryName,
            description: created.description,
            displayOrder: created.displayOrder,
            isActive: created.isActive,
          },
          result,
        };
      },
    });
  } catch (err) {
    if (isCodeCollision(err)) throw new ProcurementCategoryCodeCollisionError(input.categoryCode);
    if (isNameCollision(err)) throw new ProcurementCategoryNameCollisionError(input.categoryName);
    throw err;
  }
}

export async function updateProcurementCategory(
  procurementCategoryId: number,
  input: UpdateProcurementCategoryInput,
  userId: number
): Promise<ProcurementCategoryWithCounts> {
  return mutateWithAudit<ProcurementCategoryWithCounts>({
    userId,
    entityType: "ProcurementCategory",
    action: "ProcurementCategoryUpdated",
    work: async (tx) => {
      const category = await tx.procurementCategory.findUnique({
        where: { procurementCategoryId },
      });
      if (category === null) throw new ProcurementCategoryNotFoundError(procurementCategoryId);

      const previousValue = {
        categoryCode: category.categoryCode,
        categoryName: category.categoryName,
        description: category.description,
        displayOrder: category.displayOrder,
      };

      try {
        await tx.procurementCategory.update({
          where: { procurementCategoryId },
          data: input,
        });
      } catch (err) {
        if (isCodeCollision(err))
          throw new ProcurementCategoryCodeCollisionError(input.categoryCode ?? category.categoryCode);
        if (isNameCollision(err))
          throw new ProcurementCategoryNameCollisionError(input.categoryName ?? category.categoryName);
        throw err;
      }

      const refreshed = await fetchWithCounts(tx, procurementCategoryId);
      const result = toProcurementCategoryWithCounts(refreshed);

      return {
        entityId: procurementCategoryId,
        previousValue,
        newValue: {
          categoryCode: refreshed.categoryCode,
          categoryName: refreshed.categoryName,
          description: refreshed.description,
          displayOrder: refreshed.displayOrder,
        },
        result,
      };
    },
  });
}

export async function deactivateProcurementCategory(
  procurementCategoryId: number,
  userId: number
): Promise<ProcurementCategoryWithCounts> {
  return mutateWithAudit<ProcurementCategoryWithCounts>({
    userId,
    entityType: "ProcurementCategory",
    action: "ProcurementCategoryDeactivated",
    work: async (tx) => {
      const category = await tx.procurementCategory.findUnique({
        where: { procurementCategoryId },
      });
      if (category === null) throw new ProcurementCategoryNotFoundError(procurementCategoryId);
      if (!category.isActive)
        throw new ProcurementCategoryAlreadyInactiveError(procurementCategoryId);

      await tx.procurementCategory.update({
        where: { procurementCategoryId },
        data: { isActive: false },
      });

      const refreshed = await fetchWithCounts(tx, procurementCategoryId);
      return {
        entityId: procurementCategoryId,
        previousValue: { isActive: true },
        newValue: { isActive: false },
        result: toProcurementCategoryWithCounts(refreshed),
      };
    },
  });
}

export async function reactivateProcurementCategory(
  procurementCategoryId: number,
  userId: number
): Promise<ProcurementCategoryWithCounts> {
  return mutateWithAudit<ProcurementCategoryWithCounts>({
    userId,
    entityType: "ProcurementCategory",
    action: "ProcurementCategoryReactivated",
    work: async (tx) => {
      const category = await tx.procurementCategory.findUnique({
        where: { procurementCategoryId },
      });
      if (category === null) throw new ProcurementCategoryNotFoundError(procurementCategoryId);
      if (category.isActive)
        throw new ProcurementCategoryAlreadyActiveError(procurementCategoryId);

      await tx.procurementCategory.update({
        where: { procurementCategoryId },
        data: { isActive: true },
      });

      const refreshed = await fetchWithCounts(tx, procurementCategoryId);
      return {
        entityId: procurementCategoryId,
        previousValue: { isActive: false },
        newValue: { isActive: true },
        result: toProcurementCategoryWithCounts(refreshed),
      };
    },
  });
}
