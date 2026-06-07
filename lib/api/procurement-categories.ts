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
