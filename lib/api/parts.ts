"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";
import type { SortSpec, FilterObject } from "@/lib/views/types";

export type ProcessTypeRow = {
  processTypeId: number;
  processName: string;
  processCode: string;
};

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
  directChildCount: number;
};

export type PartsGridQuery =
  | { viewId: number; activeFilter?: "true" | "false" | "all" }
  | { filters: FilterObject[]; sort: SortSpec[]; activeFilter?: "true" | "false" | "all" };

export function useDistinctValues(columnId: string | null): UseQueryResult<{ values: string[] }, ApiError> {
  return useQuery({
    queryKey: ["parts", "distinct-values", columnId],
    queryFn: () =>
      apiFetch<{ values: string[] }>(`/api/v1/parts/distinct-values?column=${columnId}`),
    enabled: columnId !== null,
    staleTime: 30_000,
  });
}

export function useProcessTypes(): UseQueryResult<ProcessTypeRow[], ApiError> {
  return useQuery({
    queryKey: ["process-types"],
    queryFn: () =>
      apiFetch<{ data: ProcessTypeRow[] }>("/api/v1/process-types").then((r) => r.data),
    staleTime: 300_000,
  });
}

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

type UpdateStockCountVars = { partId: number; stockCount: number };
type UpdateInventoryLocationVars = { partId: number; inventoryLocation: string | null };

export function useUpdateStockCount(): UseMutationResult<PartRowClient, ApiError, UpdateStockCountVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, stockCount }: UpdateStockCountVars) =>
      apiFetch<PartRowClient>(`/api/v1/parts/${partId}/stock-count`, {
        method: "PATCH",
        body: JSON.stringify({ stockCount }),
      }),
    onMutate: async ({ partId, stockCount }) => {
      await queryClient.cancelQueries({ queryKey: ["parts", "grid"] });
      const snapshots = queryClient.getQueriesData<PartRowClient[]>({ queryKey: ["parts", "grid"] });
      queryClient.setQueriesData<PartRowClient[]>(
        { queryKey: ["parts", "grid"] },
        (old) => old?.map((r) => r.partId === partId ? { ...r, stockCount } : r)
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as { snapshots: [unknown, PartRowClient[] | undefined][] } | undefined;
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key as Parameters<typeof queryClient.setQueryData>[0], data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}

type UpdatePartVars = {
  partId: number;
  input: {
    partName?: string;
    description?: string | null;
    notes?: string | null;
    defaultVendorId?: number | null;
    vendorPartNumber?: string | null;
    materialSpecId?: number | null;
    stockSize?: string | null;
    routingTemplateDefinitionId?: number | null;
    blankLength?: number | null;
    procurementCategoryId?: number | null;
    partCost?: number | null;
  };
};

type SetActiveVars = { partId: number; active: boolean };

export function useUpdatePart(): UseMutationResult<PartRowClient, ApiError, UpdatePartVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, input }: UpdatePartVars) =>
      apiFetch<PartRowClient>(`/api/v1/parts/${partId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onMutate: async ({ partId, input }) => {
      await queryClient.cancelQueries({ queryKey: ["parts", "grid"] });
      const snapshots = queryClient.getQueriesData<PartRowClient[]>({ queryKey: ["parts", "grid"] });
      queryClient.setQueriesData<PartRowClient[]>(
        { queryKey: ["parts", "grid"] },
        (old) => old?.map((r) => r.partId === partId ? { ...r, ...input } : r)
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as { snapshots: [unknown, PartRowClient[] | undefined][] } | undefined;
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key as Parameters<typeof queryClient.setQueryData>[0], data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}

export function useSetPartActive(): UseMutationResult<PartRowClient, ApiError, SetActiveVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, active }: SetActiveVars) =>
      apiFetch<PartRowClient>(
        `/api/v1/parts/${partId}/${active ? "reactivate" : "deactivate"}`,
        { method: "POST" }
      ),
    onMutate: async ({ partId, active }) => {
      await queryClient.cancelQueries({ queryKey: ["parts", "grid"] });
      const snapshots = queryClient.getQueriesData<PartRowClient[]>({ queryKey: ["parts", "grid"] });
      queryClient.setQueriesData<PartRowClient[]>(
        { queryKey: ["parts", "grid"] },
        (old) => old?.map((r) => r.partId === partId ? { ...r, isActive: active } : r)
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as { snapshots: [unknown, PartRowClient[] | undefined][] } | undefined;
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key as Parameters<typeof queryClient.setQueryData>[0], data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}

// ─── Single part fetch ────────────────────────────────────────────────────────

export function usePart(partId: number | null): UseQueryResult<PartRowClient, ApiError> {
  return useQuery({
    queryKey: ["parts", "detail", partId],
    queryFn: () => apiFetch<PartRowClient>(`/api/v1/parts/${partId}`),
    enabled: partId !== null,
    staleTime: 30_000,
  });
}

// ─── Part-scoped detail hooks ─────────────────────────────────────────────────

export type AuditLogEntry = {
  auditLogId: number;
  actionName: string;
  changedByUserName: string;
  timestamp: string;
  note: string | null;
};

export type BomParentRow = {
  bomId: number;
  parentPartId: number;
  partNumber: string;
  partName: string;
  isActive: boolean;
  qtyUsed: number;
};

export type BomChildRow = {
  bomId: number;
  childPartId: number;
  partNumber: string;
  partName: string;
  isActive: boolean;
  quantity: number;
  stockCount: number;
  buildableFromThis: number;
};

export type OpenWoRow = {
  workOrderId: number;
  projectNumber: string;
  projectName: string;
  status: string;
  quantity: number;
};

export function usePartAuditLog(
  partId: number,
  enabled: boolean
): UseQueryResult<AuditLogEntry[], ApiError> {
  return useQuery({
    queryKey: ["parts", "audit-log", partId],
    queryFn: () =>
      apiFetch<{ data: AuditLogEntry[] }>(`/api/v1/parts/${partId}/audit-log`).then(
        (r) => r.data
      ),
    enabled,
    staleTime: 0,
  });
}

export function useBomParents(
  partId: number,
  enabled: boolean
): UseQueryResult<BomParentRow[], ApiError> {
  return useQuery({
    queryKey: ["parts", "bom-parents", partId],
    queryFn: () =>
      apiFetch<{ data: BomParentRow[] }>(`/api/v1/parts/${partId}/bom-parents`).then(
        (r) => r.data
      ),
    enabled,
    staleTime: 30_000,
  });
}

export function useBomChildren(
  partId: number,
  enabled: boolean
): UseQueryResult<BomChildRow[], ApiError> {
  return useQuery({
    queryKey: ["parts", "bom-children", partId],
    queryFn: () =>
      apiFetch<{ data: BomChildRow[] }>(`/api/v1/parts/${partId}/bom-children`).then(
        (r) => r.data
      ),
    enabled,
    staleTime: 30_000,
  });
}

export function usePartOpenWos(
  partId: number,
  enabled: boolean
): UseQueryResult<OpenWoRow[], ApiError> {
  return useQuery({
    queryKey: ["parts", "open-wos", partId],
    queryFn: () =>
      apiFetch<{ data: OpenWoRow[] }>(`/api/v1/parts/${partId}/open-wos`).then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}

// ─── Create part ──────────────────────────────────────────────────────────────

type CreatePartVars = {
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
};

export function useCreatePart(): UseMutationResult<PartRowClient, ApiError, CreatePartVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: CreatePartVars) =>
      apiFetch<PartRowClient>("/api/v1/parts", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Assembly selector ────────────────────────────────────────────────────────

export type AssemblyOption = {
  partId: number;
  partNumber: string;
  partName: string;
  directChildCount: number;
};

export function useAssemblies(): UseQueryResult<AssemblyOption[], ApiError> {
  return useQuery({
    queryKey: ["parts", "assemblies"],
    queryFn: () =>
      apiFetch<{ data: PartRowClient[] }>("/api/v1/parts?partType=Assembly&active=true").then(
        (r) =>
          r.data.map((p) => ({
            partId: p.partId,
            partNumber: p.partNumber,
            partName: p.partName,
            directChildCount: p.directChildCount,
          }))
      ),
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── All active parts (for BOM Editor combobox) ───────────────────────────────

export type AllActivePartOption = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
};

export function useAllActiveParts(): UseQueryResult<AllActivePartOption[], ApiError> {
  return useQuery({
    queryKey: ["parts", "all-active"],
    queryFn: () =>
      apiFetch<{ data: PartRowClient[] }>("/api/v1/parts?active=true").then((r) =>
        r.data.map((p) => ({
          partId: p.partId,
          partNumber: p.partNumber,
          partName: p.partName,
          partType: p.partType,
        }))
      ),
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateInventoryLocation(): UseMutationResult<PartRowClient, ApiError, UpdateInventoryLocationVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, inventoryLocation }: UpdateInventoryLocationVars) =>
      apiFetch<PartRowClient>(`/api/v1/parts/${partId}/inventory-location`, {
        method: "PATCH",
        body: JSON.stringify({ inventoryLocation }),
      }),
    onMutate: async ({ partId, inventoryLocation }) => {
      await queryClient.cancelQueries({ queryKey: ["parts", "grid"] });
      const snapshots = queryClient.getQueriesData<PartRowClient[]>({ queryKey: ["parts", "grid"] });
      queryClient.setQueriesData<PartRowClient[]>(
        { queryKey: ["parts", "grid"] },
        (old) => old?.map((r) => r.partId === partId ? { ...r, inventoryLocation } : r)
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as { snapshots: [unknown, PartRowClient[] | undefined][] } | undefined;
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key as Parameters<typeof queryClient.setQueryData>[0], data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}
