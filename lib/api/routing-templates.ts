"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";
import type {
  RoutingTemplateRow,
  RoutingTemplateDetail,
  CreateRoutingTemplateInput,
  UpdateRoutingTemplateInput,
  SaveResponse,
} from "@/lib/routing-templates/types";

export type ProcessTypeListItem = {
  processTypeId: number;
  processName: string;
  processCode: string;
};

export function useRoutingTemplates(options?: {
  active?: "true" | "false" | "all";
}): UseQueryResult<RoutingTemplateRow[], ApiError> {
  const active = options?.active ?? "true";
  return useQuery({
    queryKey: ["routing-templates", "list", { active }],
    queryFn: () =>
      apiFetch<{ data: RoutingTemplateRow[] }>(
        `/api/v1/routing-templates?active=${active}`
      ).then((r) => r.data),
  });
}

export function useRoutingTemplate(
  id: number,
  options?: { enabled?: boolean }
): UseQueryResult<RoutingTemplateDetail, ApiError> {
  return useQuery({
    queryKey: ["routing-templates", "detail", id],
    queryFn: () =>
      apiFetch<RoutingTemplateDetail>(`/api/v1/routing-templates/${id}`),
    enabled: options?.enabled ?? true,
  });
}

export function useProcessTypes(): UseQueryResult<ProcessTypeListItem[], ApiError> {
  return useQuery({
    queryKey: ["process-types", "list"],
    queryFn: () =>
      apiFetch<{ data: ProcessTypeListItem[] }>("/api/v1/process-types").then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useCreateRoutingTemplate(): UseMutationResult<
  SaveResponse,
  ApiError,
  CreateRoutingTemplateInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoutingTemplateInput) =>
      apiFetch<SaveResponse>("/api/v1/routing-templates", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routing-templates", "list"] });
    },
  });
}

export function useUpdateRoutingTemplate(): UseMutationResult<
  SaveResponse,
  ApiError,
  { id: number; input: UpdateRoutingTemplateInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<SaveResponse>(`/api/v1/routing-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["routing-templates", "list"] });
      qc.invalidateQueries({ queryKey: ["routing-templates", "detail", variables.id] });
    },
  });
}

export function useDeactivateRoutingTemplate(): UseMutationResult<
  RoutingTemplateRow,
  ApiError,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<RoutingTemplateRow>(`/api/v1/routing-templates/${id}/deactivate`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["routing-templates", "list"] });
      qc.invalidateQueries({
        queryKey: ["routing-templates", "detail", data.routingTemplateDefinitionId],
      });
    },
  });
}

export function useReactivateRoutingTemplate(): UseMutationResult<
  RoutingTemplateRow,
  ApiError,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<RoutingTemplateRow>(`/api/v1/routing-templates/${id}/reactivate`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["routing-templates", "list"] });
      qc.invalidateQueries({
        queryKey: ["routing-templates", "detail", data.routingTemplateDefinitionId],
      });
    },
  });
}
