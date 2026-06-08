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

export type ProcessTypeSubStatusRow = {
  processTypeSubStatusId: number;
  processTypeId: number;
  processCode: string;
  processName: string;
  subStatusName: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  usedByCount: number;
};

export type CreateProcessTypeSubStatusInput = {
  processTypeId: number;
  subStatusName: string;
  description?: string | null;
  displayOrder?: number;
};

export type UpdateProcessTypeSubStatusInput = {
  subStatusName?: string;
  description?: string | null;
  displayOrder?: number;
};

export function useProcessTypeSubStatuses(options?: {
  active?: "true" | "false" | "all";
  processTypeId?: number;
}): UseQueryResult<ProcessTypeSubStatusRow[], ApiError> {
  const active = options?.active ?? "true";
  const params = new URLSearchParams({ active });
  if (options?.processTypeId !== undefined) {
    params.set("processTypeId", String(options.processTypeId));
  }
  return useQuery({
    queryKey: ["process-type-sub-statuses", "list", { active, processTypeId: options?.processTypeId }],
    queryFn: () =>
      apiFetch<{ data: ProcessTypeSubStatusRow[] }>(
        `/api/v1/process-type-sub-statuses?${params}`
      ).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useProcessTypeSubStatus(
  id: number | null
): UseQueryResult<ProcessTypeSubStatusRow, ApiError> {
  return useQuery({
    queryKey: ["process-type-sub-statuses", "detail", id],
    queryFn: () =>
      apiFetch<ProcessTypeSubStatusRow>(`/api/v1/process-type-sub-statuses/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useProcessTypeSubStatusAuditLog(
  id: number | null,
  enabled: boolean
): UseQueryResult<AuditLogEntry[], ApiError> {
  return useQuery({
    queryKey: ["process-type-sub-statuses", "audit-log", id],
    queryFn: () =>
      apiFetch<{ data: AuditLogEntry[] }>(
        `/api/v1/process-type-sub-statuses/${id}/audit-log`
      ).then((r) => r.data),
    enabled: enabled && id !== null,
    staleTime: 30_000,
  });
}

export function useCreateProcessTypeSubStatus(): UseMutationResult<
  ProcessTypeSubStatusRow,
  ApiError,
  CreateProcessTypeSubStatusInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      apiFetch<ProcessTypeSubStatusRow>("/api/v1/process-type-sub-statuses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "list"] });
    },
  });
}

export function useUpdateProcessTypeSubStatus(): UseMutationResult<
  ProcessTypeSubStatusRow,
  ApiError,
  { id: number; input: UpdateProcessTypeSubStatusInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<ProcessTypeSubStatusRow>(`/api/v1/process-type-sub-statuses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "list"] });
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "detail", vars.id] });
    },
  });
}

export type ReorderProcessTypeSubStatusesInput = {
  processTypeId: number;
  updates: Array<{ id: number; displayOrder: number }>;
};

export function useReorderProcessTypeSubStatuses(): UseMutationResult<
  void,
  ApiError,
  ReorderProcessTypeSubStatusesInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ updates }) =>
      apiFetch<void>("/api/v1/process-type-sub-statuses/reorder", {
        method: "POST",
        body: JSON.stringify({ updates }),
      }),
    onMutate: async ({ processTypeId, updates }) => {
      await qc.cancelQueries({ queryKey: ["process-type-sub-statuses", "list"] });
      const previous = qc.getQueryData<ProcessTypeSubStatusRow[]>([
        "process-type-sub-statuses",
        "list",
        { active: "all", processTypeId },
      ]);

      // Optimistically update all matching list query keys
      qc.setQueriesData<ProcessTypeSubStatusRow[]>(
        { queryKey: ["process-type-sub-statuses", "list"] },
        (old) => {
          if (!old) return old;
          return old.map((s) => {
            const u = updates.find((u) => u.id === s.processTypeSubStatusId);
            return u ? { ...s, displayOrder: u.displayOrder } : s;
          });
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(["process-type-sub-statuses", "list"], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "list"] });
    },
  });
}

export function useDeactivateProcessTypeSubStatus(): UseMutationResult<
  ProcessTypeSubStatusRow,
  ApiError,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<ProcessTypeSubStatusRow>(
        `/api/v1/process-type-sub-statuses/${id}/deactivate`,
        { method: "POST" }
      ),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "list"] });
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "detail", id] });
    },
  });
}

export function useReactivateProcessTypeSubStatus(): UseMutationResult<
  ProcessTypeSubStatusRow,
  ApiError,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<ProcessTypeSubStatusRow>(
        `/api/v1/process-type-sub-statuses/${id}/reactivate`,
        { method: "POST" }
      ),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "list"] });
      qc.invalidateQueries({ queryKey: ["process-type-sub-statuses", "detail", id] });
    },
  });
}
