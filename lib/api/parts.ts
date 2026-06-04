"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";
import type { SortSpec, FilterObject } from "@/lib/views/types";

// Frontend representation of PartRow — dates are ISO strings after JSON serialization.
export type PartRowClient = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  description: string | null;
  modelLink: string | null;
  drawingLink: string | null;
  defaultVendorId: number | null;
  defaultVendorName: string | null;
  vendorPartNumber: string | null;
  materialSpecId: number | null;
  materialName: string | null;
  materialForm: string | null;
  stockSize: string | null;
  routingTemplateDefinitionId: number | null;
  routingTemplateName: string | null;
  processTypes: string[];
  blankLength: number | null;
  machineCycleTime: number | null;
  numberOfSetups: number | null;
  procurementCategoryId: number | null;
  procurementCategoryName: string | null;
  inventoryLocation: string | null;
  stockCount: number | null;
  binMin: number | null;
  binMax: number | null;
  isActive: boolean;
  notes: string | null;
  partCost: number | null;
  partCostUpdatedAt: string | null;
  buildableCount: number | null;
  assembliesUsedInCount: number;
};

export type PartsGridQuery =
  | { viewId: number; activeFilter?: "true" | "false" | "all" }
  | { filters: FilterObject[]; sort: SortSpec[]; activeFilter?: "true" | "false" | "all" };

export function usePartsGrid(
  query: PartsGridQuery
): UseQueryResult<PartRowClient[], ApiError> {
  return useQuery({
    queryKey: ["parts", "grid", query],
    queryFn: () =>
      apiFetch<{ data: PartRowClient[] }>("/api/v1/parts/grid", {
        method: "POST",
        body: JSON.stringify(query),
      }).then((r) => r.data),
    staleTime: 30_000,
  });
}
