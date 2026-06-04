import type { Prisma } from "@prisma/client";
import type { SortSpec } from "@/lib/views/types";

// Column IDs that map directly to scalar fields on Part.
const SCALAR_COLUMNS = new Set([
  "partNumber",
  "partName",
  "partType",
  "description",
  "modelLink",
  "drawingLink",
  "defaultVendorId",
  "vendorPartNumber",
  "materialSpecId",
  "stockSize",
  "routingTemplateDefinitionId",
  "blankLength",
  "machineCycleTime",
  "numberOfSetups",
  "procurementCategoryId",
  "inventoryLocation",
  "stockCount",
  "binMin",
  "binMax",
  "isActive",
  "notes",
  "partCost",
  "partCostUpdatedAt",
]);

type RelationOrderBy =
  | { materialSpec: { materialName: "asc" | "desc" } }
  | { materialSpec: { form: "asc" | "desc" } }
  | { defaultVendor: { vendorName: "asc" | "desc" } }
  | { procurementCategory: { categoryName: "asc" | "desc" } }
  | { routingTemplate: { templateName: "asc" | "desc" } };

function buildRelationOrderBy(
  column: string,
  direction: "asc" | "desc"
): RelationOrderBy | null {
  switch (column) {
    case "materialName":
      return { materialSpec: { materialName: direction } };
    case "materialForm":
      return { materialSpec: { form: direction } };
    case "defaultVendorName":
      return { defaultVendor: { vendorName: direction } };
    // Both column IDs in use: seed views use "procurementCategory"; PartRow uses "procurementCategoryName".
    case "procurementCategory":
    case "procurementCategoryName":
      return { procurementCategory: { categoryName: direction } };
    case "routingTemplateName":
      return { routingTemplate: { templateName: direction } };
    default:
      return null;
  }
}

export function buildPartSortOrder(
  sortSpecs: SortSpec[]
): Prisma.PartOrderByWithRelationInput[] {
  if (sortSpecs.length === 0) {
    return [{ partNumber: "asc" }];
  }

  return sortSpecs.map((spec) => {
    const { column, direction } = spec;

    if (SCALAR_COLUMNS.has(column)) {
      return { [column]: direction } as Prisma.PartOrderByWithRelationInput;
    }

    const relation = buildRelationOrderBy(column, direction);
    if (relation !== null) {
      return relation as Prisma.PartOrderByWithRelationInput;
    }

    // processTypes, usedInCount, and buildableCount are not DB-sortable columns.
    // buildableCount is computed post-query in service.ts; processTypes and usedInCount
    // are display-only. Any of these reaching this builder indicates a programming error.
    throw new Error(
      `buildPartSortOrder: unknown or unsortable column "${column}". ` +
        `Add it to SCALAR_COLUMNS or buildRelationOrderBy if sortable.`
    );
  });
}
