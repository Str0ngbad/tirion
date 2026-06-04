"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";
import type { RoutingTemplateRow, RoutingTemplateDetail } from "@/lib/routing-templates/types";

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
  id: number
): UseQueryResult<RoutingTemplateDetail, ApiError> {
  return useQuery({
    queryKey: ["routing-templates", "detail", id],
    queryFn: () =>
      apiFetch<RoutingTemplateDetail>(`/api/v1/routing-templates/${id}`),
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
