"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";
import type { AuditLogEntry } from "./parts";

export type ProcurementCategoryRow = {
  procurementCategoryId: number;
  categoryCode: string;
  categoryName: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  usedByCount: number;
};

export type ProcurementCategoryDetail = ProcurementCategoryRow & {
  parts: Array<{ partId: number; partNumber: string; partName: string }>;
};

export type CreateProcurementCategoryInput = {
  categoryCode: string;
  categoryName: string;
  description?: string | null;
  displayOrder?: number;
};

export type UpdateProcurementCategoryInput = {
  categoryCode?: string;
  categoryName?: string;
  description?: string | null;
  displayOrder?: number;
};

export function useProcurementCategories(options?: {
  active?: "true" | "false" | "all";
}): UseQueryResult<ProcurementCategoryRow[], ApiError> {
  const active = options?.active ?? "true";
  return useQuery({
    queryKey: ["procurement-categories", "list", { active }],
    queryFn: () =>
      apiFetch<{ data: ProcurementCategoryRow[] }>(
        `/api/v1/procurement-categories?active=${active}`
      ).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useProcurementCategory(
  id: number | null
): UseQueryResult<ProcurementCategoryDetail, ApiError> {
  return useQuery({
    queryKey: ["procurement-categories", "detail", id],
    queryFn: () =>
      apiFetch<ProcurementCategoryDetail>(`/api/v1/procurement-categories/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useProcurementCategoryAuditLog(
  id: number | null,
  enabled: boolean
): UseQueryResult<AuditLogEntry[], ApiError> {
  return useQuery({
    queryKey: ["procurement-categories", "audit-log", id],
    queryFn: () =>
      apiFetch<{ data: AuditLogEntry[] }>(
        `/api/v1/procurement-categories/${id}/audit-log`
      ).then((r) => r.data),
    enabled: enabled && id !== null,
    staleTime: 30_000,
  });
}

export function useCreateProcurementCategory(): UseMutationResult<
  ProcurementCategoryRow,
  ApiError,
  CreateProcurementCategoryInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      apiFetch<ProcurementCategoryRow>("/api/v1/procurement-categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["procurement-categories", "list"] });
    },
  });
}

export function useUpdateProcurementCategory(): UseMutationResult<
  ProcurementCategoryRow,
  ApiError,
  { id: number; input: UpdateProcurementCategoryInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<ProcurementCategoryRow>(`/api/v1/procurement-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["procurement-categories", "list"] });
      qc.invalidateQueries({ queryKey: ["procurement-categories", "detail", vars.id] });
    },
  });
}

export function useDeactivateProcurementCategory(): UseMutationResult<
  ProcurementCategoryRow,
  ApiError,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<ProcurementCategoryRow>(
        `/api/v1/procurement-categories/${id}/deactivate`,
        { method: "POST" }
      ),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["procurement-categories", "list"] });
      qc.invalidateQueries({ queryKey: ["procurement-categories", "detail", id] });
    },
  });
}

export function useReorderProcurementCategories(): UseMutationResult<
  unknown,
  ApiError,
  Array<{ id: number; displayOrder: number }>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates) =>
      apiFetch("/api/v1/procurement-categories/reorder", {
        method: "POST",
        body: JSON.stringify({ updates }),
      }),
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ["procurement-categories", "list"] });
      const activeKey = ["procurement-categories", "list", { active: "true" }];
      const allKey = ["procurement-categories", "list", { active: "all" }];
      const previousActive = qc.getQueryData<ProcurementCategoryRow[]>(activeKey);
      const previousAll = qc.getQueryData<ProcurementCategoryRow[]>(allKey);

      const applyUpdate = (old: ProcurementCategoryRow[] | undefined) => {
        if (!old) return old;
        return old.map((c) => {
          const u = updates.find((u) => u.id === c.procurementCategoryId);
          return u ? { ...c, displayOrder: u.displayOrder } : c;
        });
      };

      qc.setQueryData(activeKey, applyUpdate);
      qc.setQueryData(allKey, applyUpdate);
      return { previousActive, previousAll, activeKey, allKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousActive) qc.setQueryData(context.activeKey, context.previousActive);
      if (context?.previousAll) qc.setQueryData(context.allKey, context.previousAll);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["procurement-categories", "list"] });
    },
  });
}

export function useReactivateProcurementCategory(): UseMutationResult<
  ProcurementCategoryRow,
  ApiError,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<ProcurementCategoryRow>(
        `/api/v1/procurement-categories/${id}/reactivate`,
        { method: "POST" }
      ),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["procurement-categories", "list"] });
      qc.invalidateQueries({ queryKey: ["procurement-categories", "detail", id] });
    },
  });
}
