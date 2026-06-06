import type { PartRowClient } from "@/lib/api/parts";

export type ColumnId =
  | "partNumber"
  | "partName"
  | "partType"
  | "procurementCategory"
  | "material"
  | "materialForm"
  | "vendor"
  | "vendorPartNumber"
  | "routing"
  | "buildableCount"
  | "stockCount"
  | "inventoryLocation"
  | "stockSize"
  | "blankLength"
  | "partCost"
  | "partCostUpdatedAt"
  | "assembliesUsedInCount"
  | "machineCycleTime"
  | "numberOfSetups"
  | "isActive";

export type ColumnDataType =
  | "text"
  | "numeric"
  | "currency"
  | "date"
  | "categorical"
  | "boolean"
  | "routing";

export type ColumnMeta = {
  id: ColumnId;
  label: string;
  dataType: ColumnDataType;
  sortable: boolean;
  filterable: boolean;
  align: "left" | "right" | "center";
  defaultWidth: string;
  /** Fixed pixel width used by table-layout: fixed colgroup */
  width: number;
};

export const ALL_COLUMNS: ColumnMeta[] = [
  { id: "partNumber",            label: "Part Number",   dataType: "text",        sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[110px] max-w-[160px]", width: 140 },
  { id: "partName",              label: "Part Name",     dataType: "text",        sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[200px] max-w-[280px]", width: 240 },
  { id: "partType",              label: "Type",          dataType: "categorical", sortable: true,  filterable: true,  align: "left",   defaultWidth: "w-20",                        width: 80  },
  { id: "procurementCategory",   label: "Proc",          dataType: "categorical", sortable: true,  filterable: true,  align: "left",   defaultWidth: "w-32",                        width: 128 },
  { id: "material",              label: "Material",      dataType: "categorical", sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[120px] max-w-[180px]", width: 150 },
  { id: "materialForm",          label: "Form",          dataType: "categorical", sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[100px] max-w-[140px]", width: 120 },
  { id: "vendor",                label: "Vendor",        dataType: "categorical", sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[120px] max-w-[160px]", width: 140 },
  { id: "vendorPartNumber",      label: "Vendor Part #", dataType: "text",        sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[120px] max-w-[150px]", width: 130 },
  { id: "routing",               label: "Routing",       dataType: "routing",     sortable: false, filterable: true,  align: "left",   defaultWidth: "",                             width: 120 },
  { id: "buildableCount",        label: "Buildable",     dataType: "numeric",     sortable: true,  filterable: true,  align: "right",  defaultWidth: "w-24",                        width: 96  },
  { id: "stockCount",            label: "Stock",         dataType: "numeric",     sortable: true,  filterable: true,  align: "right",  defaultWidth: "w-20",                        width: 80  },
  { id: "inventoryLocation",     label: "Location",      dataType: "text",        sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[100px] max-w-[160px]", width: 130 },
  { id: "stockSize",             label: "Stock Size",    dataType: "text",        sortable: true,  filterable: true,  align: "left",   defaultWidth: "min-w-[100px] max-w-[140px]", width: 120 },
  { id: "blankLength",           label: "Length",        dataType: "numeric",     sortable: true,  filterable: true,  align: "right",  defaultWidth: "w-24",                        width: 96  },
  { id: "partCost",              label: "Cost",          dataType: "currency",    sortable: true,  filterable: true,  align: "right",  defaultWidth: "w-24",                        width: 96  },
  { id: "partCostUpdatedAt",     label: "Cost Updated",  dataType: "date",        sortable: true,  filterable: true,  align: "left",   defaultWidth: "w-28",                        width: 112 },
  { id: "assembliesUsedInCount", label: "Used In",       dataType: "numeric",     sortable: false, filterable: true,  align: "right",  defaultWidth: "w-20",                        width: 80  },
  { id: "machineCycleTime",      label: "Cycle Time",    dataType: "numeric",     sortable: true,  filterable: true,  align: "right",  defaultWidth: "w-24",                        width: 96  },
  { id: "numberOfSetups",        label: "Setups",        dataType: "numeric",     sortable: true,  filterable: true,  align: "right",  defaultWidth: "w-20",                        width: 80  },
  { id: "isActive",              label: "Active",        dataType: "boolean",     sortable: true,  filterable: true,  align: "center", defaultWidth: "w-16",                        width: 64  },
];

export const COLUMN_BY_ID = new Map<ColumnId, ColumnMeta>(
  ALL_COLUMNS.map((c) => [c.id, c])
);

export const ALL_COLUMN_IDS = new Set<string>(ALL_COLUMNS.map((c) => c.id));

// Maps a ColumnId to the value to use for client-side sorting.
export function getSortValue(row: PartRowClient, columnId: ColumnId): string | number | boolean | null {
  switch (columnId) {
    case "partNumber":            return row.partNumber;
    case "partName":              return row.partName;
    case "partType":              return row.partType;
    case "procurementCategory":   return row.procurementCategoryName;
    case "material":              return row.materialName;
    case "materialForm":          return row.materialForm;
    case "vendor":                return row.defaultVendorName;
    case "vendorPartNumber":      return row.vendorPartNumber;
    case "routing":               return row.routingTemplateName;
    case "buildableCount":        return row.buildableCount;
    case "stockCount":            return row.stockCount;
    case "inventoryLocation":     return row.inventoryLocation;
    case "stockSize":             return row.stockSize;
    case "blankLength":           return row.blankLength;
    case "partCost":              return row.partCost;
    case "partCostUpdatedAt":     return row.partCostUpdatedAt;
    case "assembliesUsedInCount": return row.assembliesUsedInCount;
    case "machineCycleTime":      return row.machineCycleTime;
    case "numberOfSetups":        return row.numberOfSetups;
    case "isActive":              return row.isActive ? 1 : 0;
  }
}

export function applyClientSort(
  rows: PartRowClient[],
  columnId: ColumnId,
  direction: "asc" | "desc"
): PartRowClient[] {
  return applyClientSorts(rows, [{ columnId, direction }]);
}

export function applyClientSorts(
  rows: PartRowClient[],
  sorts: Array<{ columnId: ColumnId; direction: "asc" | "desc" }>
): PartRowClient[] {
  if (sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { columnId, direction } of sorts) {
      const factor = direction === "asc" ? 1 : -1;
      const av = getSortValue(a, columnId);
      const bv = getSortValue(b, columnId);
      // Nulls sort last regardless of direction.
      if (av === null && bv === null) continue;
      if (av === null) return 1;
      if (bv === null) return -1;
      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      if (cmp !== 0) return factor * cmp;
    }
    return 0;
  });
}
