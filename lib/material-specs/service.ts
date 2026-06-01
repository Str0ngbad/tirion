import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { isP2002OnComposite } from "@/lib/db/p2002";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  MaterialSpecNotFoundError,
  MaterialSpecAlreadyActiveError,
  MaterialSpecAlreadyInactiveError,
  MaterialSpecCollisionError,
} from "@/lib/errors/material-spec";
import type {
  ListMaterialSpecsQuery,
  CreateMaterialSpecInput,
  UpdateMaterialSpecInput,
  MaterialSpecWithCounts,
  MaterialSpecWithParts,
} from "@/lib/material-specs/types";

type MaterialSpecWithCountsRaw = {
  materialSpecId: number;
  materialName: string;
  form: string;
  isActive: boolean;
  _count: {
    parts: number;
  };
};

type MaterialSpecWithPartsRaw = MaterialSpecWithCountsRaw & {
  parts: Array<{
    partId: number;
    partNumber: string;
    partName: string;
  }>;
};

function toMaterialSpecWithCounts(raw: MaterialSpecWithCountsRaw): MaterialSpecWithCounts {
  return {
    materialSpecId: raw.materialSpecId,
    materialName: raw.materialName,
    form: raw.form,
    isActive: raw.isActive,
    usedByCount: raw._count.parts,
  };
}

function toMaterialSpecWithParts(raw: MaterialSpecWithPartsRaw): MaterialSpecWithParts {
  return {
    materialSpecId: raw.materialSpecId,
    materialName: raw.materialName,
    form: raw.form,
    isActive: raw.isActive,
    usedByCount: raw._count.parts,
    parts: raw.parts,
  };
}

async function fetchWithCounts(
  tx: Prisma.TransactionClient,
  materialSpecId: number
): Promise<MaterialSpecWithCountsRaw> {
  return tx.materialSpec.findUniqueOrThrow({
    where: { materialSpecId },
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
        },
      },
    },
  });
}

function isCollision(err: unknown): boolean {
  return isP2002OnComposite(err, ["materialName", "form"]);
}

export async function listMaterialSpecs(
  query: ListMaterialSpecsQuery
): Promise<MaterialSpecWithCounts[]> {
  let where: Prisma.MaterialSpecWhereInput;

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

  const rows = await prisma.materialSpec.findMany({
    where,
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ materialName: "asc" }, { form: "asc" }],
  });

  return rows.map(toMaterialSpecWithCounts);
}

export async function getMaterialSpec(materialSpecId: number): Promise<MaterialSpecWithParts> {
  const raw = await prisma.materialSpec.findUnique({
    where: { materialSpecId },
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

  if (raw === null) throw new MaterialSpecNotFoundError(materialSpecId);

  return toMaterialSpecWithParts(raw as MaterialSpecWithPartsRaw);
}

export async function createMaterialSpec(
  input: CreateMaterialSpecInput,
  userId: number
): Promise<MaterialSpecWithCounts> {
  try {
    return await mutateWithAudit<MaterialSpecWithCounts>({
      userId,
      entityType: "MaterialSpec",
      action: "MaterialSpecCreated",
      work: async (tx) => {
        const created = await tx.materialSpec.create({
          data: {
            materialName: input.materialName,
            form: input.form,
          },
        });

        const result: MaterialSpecWithCounts = {
          materialSpecId: created.materialSpecId,
          materialName: created.materialName,
          form: created.form,
          isActive: created.isActive,
          usedByCount: 0,
        };

        return {
          entityId: created.materialSpecId,
          previousValue: null,
          newValue: {
            materialName: created.materialName,
            form: created.form,
            isActive: created.isActive,
          },
          result,
        };
      },
    });
  } catch (err) {
    if (isCollision(err)) throw new MaterialSpecCollisionError(input.materialName, input.form);
    throw err;
  }
}

export async function updateMaterialSpec(
  materialSpecId: number,
  input: UpdateMaterialSpecInput,
  userId: number
): Promise<MaterialSpecWithCounts> {
  return mutateWithAudit<MaterialSpecWithCounts>({
    userId,
    entityType: "MaterialSpec",
    action: "MaterialSpecUpdated",
    work: async (tx) => {
      const spec = await tx.materialSpec.findUnique({ where: { materialSpecId } });
      if (spec === null) throw new MaterialSpecNotFoundError(materialSpecId);

      const previousValue = {
        materialName: spec.materialName,
        form: spec.form,
      };

      try {
        await tx.materialSpec.update({
          where: { materialSpecId },
          data: input,
        });
      } catch (err) {
        if (isCollision(err)) {
          throw new MaterialSpecCollisionError(
            input.materialName ?? spec.materialName,
            input.form ?? spec.form
          );
        }
        throw err;
      }

      const refreshed = await fetchWithCounts(tx, materialSpecId);
      const result = toMaterialSpecWithCounts(refreshed);

      return {
        entityId: materialSpecId,
        previousValue,
        newValue: {
          materialName: refreshed.materialName,
          form: refreshed.form,
        },
        result,
      };
    },
  });
}

export async function deactivateMaterialSpec(
  materialSpecId: number,
  userId: number
): Promise<MaterialSpecWithCounts> {
  return mutateWithAudit<MaterialSpecWithCounts>({
    userId,
    entityType: "MaterialSpec",
    action: "MaterialSpecDeactivated",
    work: async (tx) => {
      const spec = await tx.materialSpec.findUnique({ where: { materialSpecId } });
      if (spec === null) throw new MaterialSpecNotFoundError(materialSpecId);
      if (!spec.isActive) throw new MaterialSpecAlreadyInactiveError(materialSpecId);

      await tx.materialSpec.update({
        where: { materialSpecId },
        data: { isActive: false },
      });

      const refreshed = await fetchWithCounts(tx, materialSpecId);
      return {
        entityId: materialSpecId,
        previousValue: { isActive: true },
        newValue: { isActive: false },
        result: toMaterialSpecWithCounts(refreshed),
      };
    },
  });
}

export async function reactivateMaterialSpec(
  materialSpecId: number,
  userId: number
): Promise<MaterialSpecWithCounts> {
  return mutateWithAudit<MaterialSpecWithCounts>({
    userId,
    entityType: "MaterialSpec",
    action: "MaterialSpecReactivated",
    work: async (tx) => {
      const spec = await tx.materialSpec.findUnique({ where: { materialSpecId } });
      if (spec === null) throw new MaterialSpecNotFoundError(materialSpecId);
      if (spec.isActive) throw new MaterialSpecAlreadyActiveError(materialSpecId);

      await tx.materialSpec.update({
        where: { materialSpecId },
        data: { isActive: true },
      });

      const refreshed = await fetchWithCounts(tx, materialSpecId);
      return {
        entityId: materialSpecId,
        previousValue: { isActive: false },
        newValue: { isActive: true },
        result: toMaterialSpecWithCounts(refreshed),
      };
    },
  });
}
