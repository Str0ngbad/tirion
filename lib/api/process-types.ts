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
import type { ProcessTypeDetail, UpdateProcessTypeInput } from "@/lib/process-types/service";

export type { ProcessTypeDetail };

export type ProcessTypeRow = {
  processTypeId: number;
  processName: string;
  processCode: string;
};

export function useProcessTypes(): UseQueryResult<ProcessTypeRow[], ApiError> {
  return useQuery({
    queryKey: ["process-types", "list"],
    queryFn: () =>
      apiFetch<{ data: ProcessTypeRow[] }>("/api/v1/process-types").then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useProcessTypeDetail(
  id: number | null
): UseQueryResult<ProcessTypeDetail, ApiError> {
  return useQuery({
    queryKey: ["process-types", "detail", id],
    queryFn: () => apiFetch<ProcessTypeDetail>(`/api/v1/process-types/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useUpdateProcessType(): UseMutationResult<
  ProcessTypeDetail,
  ApiError,
  { id: number; input: UpdateProcessTypeInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<ProcessTypeDetail>(`/api/v1/process-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["process-types", "detail", vars.id] });
    },
  });
}

export function useProcessTypeAuditLog(
  id: number | null,
  enabled: boolean
): UseQueryResult<AuditLogEntry[], ApiError> {
  return useQuery({
    queryKey: ["process-types", "audit-log", id],
    queryFn: () =>
      apiFetch<{ data: AuditLogEntry[] }>(`/api/v1/process-types/${id}/audit-log`).then(
        (r) => r.data
      ),
    enabled: enabled && id !== null,
    staleTime: 30_000,
  });
}
