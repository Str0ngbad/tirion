"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";
import type { AuditLogEntry } from "./parts";

export type MaterialSpecRow = {
  materialSpecId: number;
  materialName: string;
  form: string;
  isActive: boolean;
  usedByCount: number;
};

export type MaterialSpecDetail = MaterialSpecRow & {
  parts: Array<{ partId: number; partNumber: string; partName: string }>;
};

export type CreateMaterialSpecInput = {
  materialName: string;
  form: string;
};

export type UpdateMaterialSpecInput = {
  materialName?: string;
  form?: string;
};

export function useMaterialSpecs(options?: {
  active?: "true" | "false" | "all";
}): UseQueryResult<MaterialSpecRow[], ApiError> {
  const active = options?.active ?? "true";
  return useQuery({
    queryKey: ["material-specs", "list", { active }],
    queryFn: () =>
      apiFetch<{ data: MaterialSpecRow[] }>(`/api/v1/material-specs?active=${active}`).then(
        (r) => r.data
      ),
    staleTime: 30_000,
  });
}

export function useMaterialSpec(id: number | null): UseQueryResult<MaterialSpecDetail, ApiError> {
  return useQuery({
    queryKey: ["material-specs", "detail", id],
    queryFn: () => apiFetch<MaterialSpecDetail>(`/api/v1/material-specs/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useMaterialSpecAuditLog(
  id: number | null,
  enabled: boolean
): UseQueryResult<AuditLogEntry[], ApiError> {
  return useQuery({
    queryKey: ["material-specs", "audit-log", id],
    queryFn: () =>
      apiFetch<{ data: AuditLogEntry[] }>(`/api/v1/material-specs/${id}/audit-log`).then(
        (r) => r.data
      ),
    enabled: enabled && id !== null,
    staleTime: 30_000,
  });
}

export function useCreateMaterialSpec(): UseMutationResult<
  MaterialSpecRow,
  ApiError,
  CreateMaterialSpecInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaterialSpecInput) =>
      apiFetch<MaterialSpecRow>("/api/v1/material-specs", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["material-specs", "list"] });
    },
  });
}

export function useUpdateMaterialSpec(): UseMutationResult<
  MaterialSpecRow,
  ApiError,
  { id: number; input: UpdateMaterialSpecInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<MaterialSpecRow>(`/api/v1/material-specs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["material-specs", "list"] });
      qc.invalidateQueries({ queryKey: ["material-specs", "detail", vars.id] });
    },
  });
}

export function useDeactivateMaterialSpec(): UseMutationResult<MaterialSpecRow, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<MaterialSpecRow>(`/api/v1/material-specs/${id}/deactivate`, { method: "POST" }),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["material-specs", "list"] });
      qc.invalidateQueries({ queryKey: ["material-specs", "detail", id] });
    },
  });
}

export function useReactivateMaterialSpec(): UseMutationResult<MaterialSpecRow, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<MaterialSpecRow>(`/api/v1/material-specs/${id}/reactivate`, { method: "POST" }),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["material-specs", "list"] });
      qc.invalidateQueries({ queryKey: ["material-specs", "detail", id] });
    },
  });
}
