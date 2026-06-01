import { Prisma, PartType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { isP2002OnField } from "@/lib/db/p2002";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import { getView } from "@/lib/views/service";
import { buildPartWhereClause } from "@/lib/grids/filter-builder";
import { buildPartSortOrder } from "@/lib/grids/sort-builder";
import type { GridQueryBody } from "@/lib/grids/schemas";
import {
  PartNotFoundError,
  PartNumberCollisionError,
  PartInventoryLocationCollisionError,
  PartAlreadyActiveError,
  PartAlreadyInactiveError,
  PartVendorInvalidError,
  PartMaterialSpecInvalidError,
  PartProcurementCategoryInvalidError,
  PartRoutingTemplateInvalidError,
} from "@/lib/errors/part";
import type {
  ListPartsQuery,
  CreatePartInput,
  UpdatePartInput,
  UpdateStockCountInput,
  UpdateInventoryLocationInput,
  PartRow,
  PartDetail,
} from "@/lib/parts/types";

// ─── Internal types ───────────────────────────────────────────────────────────

type PartRaw = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: PartType;
  description: string | null;
  modelLink: string | null;
  drawingLink: string | null;
  defaultVendorId: number | null;
  vendorPartNumber: string | null;
  materialSpecId: number | null;
  stockSize: string | null;
  routingTemplateDefinitionId: number | null;
  blankLength: Prisma.Decimal | null;
  machineCycleTime: number | null;
  numberOfSetups: number | null;
  procurementCategoryId: number | null;
  inventoryLocation: string | null;
  stockCount: Prisma.Decimal | null;
  binMin: number | null;
  binMax: number | null;
  isActive: boolean;
  notes: string | null;
  partCost: Prisma.Decimal | null;
  partCostUpdatedAt: Date | null;
  defaultVendor: { vendorName: string } | null;
  materialSpec: { materialName: string } | null;
  procurementCategory: { categoryName: string } | null;
  routingTemplate: { templateName: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PART_INCLUDE = {
  defaultVendor: { select: { vendorName: true } },
  materialSpec: { select: { materialName: true } },
  procurementCategory: { select: { categoryName: true } },
  routingTemplate: { select: { templateName: true } },
} as const;

function toPartRow(raw: PartRaw): PartRow {
  return {
    partId: raw.partId,
    partNumber: raw.partNumber,
    partName: raw.partName,
    partType: raw.partType,
    description: raw.description,
    modelLink: raw.modelLink,
    drawingLink: raw.drawingLink,
    defaultVendorId: raw.defaultVendorId,
    defaultVendorName: raw.defaultVendor?.vendorName ?? null,
    vendorPartNumber: raw.vendorPartNumber,
    materialSpecId: raw.materialSpecId,
    materialName: raw.materialSpec?.materialName ?? null,
    stockSize: raw.stockSize,
    routingTemplateDefinitionId: raw.routingTemplateDefinitionId,
    routingTemplateName: raw.routingTemplate?.templateName ?? null,
    blankLength: raw.blankLength !== null ? raw.blankLength.toNumber() : null,
    machineCycleTime: raw.machineCycleTime,
    numberOfSetups: raw.numberOfSetups,
    procurementCategoryId: raw.procurementCategoryId,
    procurementCategoryName: raw.procurementCategory?.categoryName ?? null,
    inventoryLocation: raw.inventoryLocation,
    stockCount: raw.stockCount !== null ? raw.stockCount.toNumber() : null,
    binMin: raw.binMin,
    binMax: raw.binMax,
    isActive: raw.isActive,
    notes: raw.notes,
    partCost: raw.partCost !== null ? raw.partCost.toNumber() : null,
    partCostUpdatedAt: raw.partCostUpdatedAt,
  };
}

async function fetchPart(
  tx: Prisma.TransactionClient,
  partId: number
): Promise<PartRaw> {
  return tx.part.findUniqueOrThrow({
    where: { partId },
    include: PART_INCLUDE,
  }) as Promise<PartRaw>;
}

function handleP2002(err: unknown, partNumber?: string, inventoryLocation?: string): never {
  if (isP2002OnField(err, "partNumber")) {
    throw new PartNumberCollisionError(partNumber ?? "");
  }
  if (isP2002OnField(err, "inventoryLocation")) {
    throw new PartInventoryLocationCollisionError(inventoryLocation ?? "");
  }
  throw err;
}

async function validateForeignKeys(
  tx: Prisma.TransactionClient,
  input: {
    defaultVendorId?: number | null;
    materialSpecId?: number | null;
    procurementCategoryId?: number | null;
    routingTemplateDefinitionId?: number | null;
  }
): Promise<void> {
  if (input.defaultVendorId != null) {
    const vendor = await tx.vendor.findUnique({
      where: { vendorId: input.defaultVendorId },
      select: { isActive: true },
    });
    if (vendor === null || !vendor.isActive) {
      throw new PartVendorInvalidError(input.defaultVendorId);
    }
  }
  if (input.materialSpecId != null) {
    const spec = await tx.materialSpec.findUnique({
      where: { materialSpecId: input.materialSpecId },
      select: { isActive: true },
    });
    if (spec === null || !spec.isActive) {
      throw new PartMaterialSpecInvalidError(input.materialSpecId);
    }
  }
  if (input.procurementCategoryId != null) {
    const cat = await tx.procurementCategory.findUnique({
      where: { procurementCategoryId: input.procurementCategoryId },
      select: { isActive: true },
    });
    if (cat === null || !cat.isActive) {
      throw new PartProcurementCategoryInvalidError(input.procurementCategoryId);
    }
  }
  if (input.routingTemplateDefinitionId != null) {
    const tmpl = await tx.routingTemplateDefinition.findUnique({
      where: { routingTemplateDefinitionId: input.routingTemplateDefinitionId },
      select: { isActive: true },
    });
    if (tmpl === null || !tmpl.isActive) {
      throw new PartRoutingTemplateInvalidError(input.routingTemplateDefinitionId);
    }
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listParts(query: ListPartsQuery): Promise<PartRow[]> {
  let where: Prisma.PartWhereInput;

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

  const rows = await prisma.part.findMany({
    where,
    include: PART_INCLUDE,
    orderBy: { partNumber: "asc" },
  });

  return rows.map((r) => toPartRow(r as PartRaw));
}

export async function getPart(partId: number): Promise<PartDetail> {
  const raw = await prisma.part.findUnique({
    where: { partId },
    include: PART_INCLUDE,
  });

  if (raw === null) throw new PartNotFoundError(partId);

  const partRow = toPartRow(raw as PartRaw);

  const bomParentCount = await prisma.bOM.count({
    where: {
      childPartId: partId,
      parentPart: { isActive: true },
    },
  });

  const bomChildCount =
    raw.partType === PartType.Assembly
      ? await prisma.bOM.count({
          where: {
            parentPartId: partId,
            childPart: { isActive: true },
          },
        })
      : null;

  return { ...partRow, bomParentCount, bomChildCount };
}

export async function createPart(
  input: CreatePartInput,
  userId: number
): Promise<PartRow> {
  try {
    return await mutateWithAudit<PartRow>({
      userId,
      entityType: "Part",
      action: "PartCreated",
      work: async (tx) => {
        await validateForeignKeys(tx, input);

        const created = await tx.part.create({
          data: {
            partNumber: input.partNumber,
            partName: input.partName,
            partType: input.partType,
            description: input.description ?? null,
            modelLink: input.modelLink ?? null,
            drawingLink: input.drawingLink ?? null,
            defaultVendorId: input.defaultVendorId ?? null,
            vendorPartNumber: input.vendorPartNumber ?? null,
            materialSpecId: input.materialSpecId ?? null,
            stockSize: input.stockSize ?? null,
            routingTemplateDefinitionId: input.routingTemplateDefinitionId ?? null,
            blankLength: input.blankLength ?? null,
            machineCycleTime: input.machineCycleTime ?? null,
            numberOfSetups: input.numberOfSetups ?? null,
            procurementCategoryId: input.procurementCategoryId ?? null,
            binMin: input.binMin ?? null,
            binMax: input.binMax ?? null,
            notes: input.notes ?? null,
            partCost: input.partCost ?? null,
          },
        });

        const result = toPartRow(await fetchPart(tx, created.partId));

        return {
          entityId: created.partId,
          previousValue: null,
          newValue: { partNumber: created.partNumber, partName: created.partName, partType: created.partType },
          result,
        };
      },
    });
  } catch (err) {
    return handleP2002(err, input.partNumber, undefined);
  }
}

export async function updatePart(
  partId: number,
  input: UpdatePartInput,
  userId: number
): Promise<PartRow> {
  try {
    return await mutateWithAudit<PartRow>({
      userId,
      entityType: "Part",
      action: "PartUpdated",
      work: async (tx) => {
        const existing = await tx.part.findUnique({ where: { partId } });
        if (existing === null) throw new PartNotFoundError(partId);

        await validateForeignKeys(tx, input);

        const previousValue = { partNumber: existing.partNumber, partName: existing.partName };

        await tx.part.update({
          where: { partId },
          data: {
            ...(input.partNumber !== undefined && { partNumber: input.partNumber }),
            ...(input.partName !== undefined && { partName: input.partName }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.modelLink !== undefined && { modelLink: input.modelLink }),
            ...(input.drawingLink !== undefined && { drawingLink: input.drawingLink }),
            ...(input.defaultVendorId !== undefined && { defaultVendorId: input.defaultVendorId }),
            ...(input.vendorPartNumber !== undefined && { vendorPartNumber: input.vendorPartNumber }),
            ...(input.materialSpecId !== undefined && { materialSpecId: input.materialSpecId }),
            ...(input.stockSize !== undefined && { stockSize: input.stockSize }),
            ...(input.routingTemplateDefinitionId !== undefined && {
              routingTemplateDefinitionId: input.routingTemplateDefinitionId,
            }),
            ...(input.blankLength !== undefined && { blankLength: input.blankLength }),
            ...(input.machineCycleTime !== undefined && { machineCycleTime: input.machineCycleTime }),
            ...(input.numberOfSetups !== undefined && { numberOfSetups: input.numberOfSetups }),
            ...(input.procurementCategoryId !== undefined && {
              procurementCategoryId: input.procurementCategoryId,
            }),
            ...(input.binMin !== undefined && { binMin: input.binMin }),
            ...(input.binMax !== undefined && { binMax: input.binMax }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.partCost !== undefined && { partCost: input.partCost }),
          },
        });

        const result = toPartRow(await fetchPart(tx, partId));

        return {
          entityId: partId,
          previousValue,
          newValue: { partNumber: result.partNumber, partName: result.partName },
          result,
        };
      },
    });
  } catch (err) {
    return handleP2002(err, input.partNumber, undefined);
  }
}

export async function updateStockCount(
  partId: number,
  input: UpdateStockCountInput,
  userId: number
): Promise<PartRow> {
  return mutateWithAudit<PartRow>({
    userId,
    entityType: "Part",
    action: "StockCountUpdated",
    work: async (tx) => {
      const existing = await tx.part.findUnique({ where: { partId }, select: { stockCount: true } });
      if (existing === null) throw new PartNotFoundError(partId);

      // No active check: inactive Parts may still need stock count corrections
      // before final cleanup. The spec does not explicitly forbid it.

      const previousStockCount = existing.stockCount?.toNumber() ?? null;

      await tx.part.update({ where: { partId }, data: { stockCount: input.stockCount } });

      const result = toPartRow(await fetchPart(tx, partId));

      return {
        entityId: partId,
        previousValue: { stockCount: previousStockCount },
        newValue: { stockCount: input.stockCount },
        result,
      };
    },
  });
}

export async function updateInventoryLocation(
  partId: number,
  input: UpdateInventoryLocationInput,
  userId: number
): Promise<PartRow> {
  try {
    return await mutateWithAudit<PartRow>({
      userId,
      entityType: "Part",
      action: "InventoryLocationUpdated",
      work: async (tx) => {
        const existing = await tx.part.findUnique({
          where: { partId },
          select: { inventoryLocation: true },
        });
        if (existing === null) throw new PartNotFoundError(partId);

        const previousLocation = existing.inventoryLocation;

        await tx.part.update({ where: { partId }, data: { inventoryLocation: input.inventoryLocation } });

        const result = toPartRow(await fetchPart(tx, partId));

        return {
          entityId: partId,
          previousValue: { inventoryLocation: previousLocation },
          newValue: { inventoryLocation: input.inventoryLocation },
          result,
        };
      },
    });
  } catch (err) {
    return handleP2002(err, undefined, input.inventoryLocation ?? undefined);
  }
}

export async function deactivatePart(partId: number, userId: number): Promise<PartRow> {
  return mutateWithAudit<PartRow>({
    userId,
    entityType: "Part",
    action: "PartDeactivated",
    work: async (tx) => {
      const existing = await tx.part.findUnique({ where: { partId } });
      if (existing === null) throw new PartNotFoundError(partId);
      if (!existing.isActive) throw new PartAlreadyInactiveError(partId);

      await tx.part.update({ where: { partId }, data: { isActive: false } });

      const result = toPartRow(await fetchPart(tx, partId));

      return {
        entityId: partId,
        previousValue: { isActive: true },
        newValue: { isActive: false },
        result,
      };
    },
  });
}

export async function reactivatePart(partId: number, userId: number): Promise<PartRow> {
  return mutateWithAudit<PartRow>({
    userId,
    entityType: "Part",
    action: "PartReactivated",
    work: async (tx) => {
      const existing = await tx.part.findUnique({ where: { partId } });
      if (existing === null) throw new PartNotFoundError(partId);
      if (existing.isActive) throw new PartAlreadyActiveError(partId);

      await tx.part.update({ where: { partId }, data: { isActive: true } });

      const result = toPartRow(await fetchPart(tx, partId));

      return {
        entityId: partId,
        previousValue: { isActive: false },
        newValue: { isActive: true },
        result,
      };
    },
  });
}

export async function queryPartsGrid(input: GridQueryBody): Promise<PartRow[]> {
  let filters: import("@/lib/views/types").FilterObject[];
  let sort: import("@/lib/views/types").SortSpec[];

  if ("viewId" in input) {
    const view = await getView(input.viewId);
    filters = view.filters;
    sort = view.defaultSort;
  } else {
    filters = input.filters;
    sort = input.sort;
  }

  const baseWhere = buildPartWhereClause(filters);
  const orderBy = buildPartSortOrder(sort);

  // Overlay the activeFilter on top of the base where clause.
  // Default is "true" — the grid hides inactive Parts unless explicitly requested.
  const activeFilterValue = input.activeFilter ?? "true";
  let where: Prisma.PartWhereInput;
  if (activeFilterValue === "all") {
    where = baseWhere;
  } else {
    const isActive = activeFilterValue === "true";
    where = { AND: [{ isActive }, baseWhere] };
  }

  const rows = await prisma.part.findMany({ where, orderBy, include: PART_INCLUDE });
  return rows.map((r) => toPartRow(r as PartRaw));
}
