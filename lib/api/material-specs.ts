"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";

export type MaterialSpecRow = {
  materialSpecId: number;
  materialName: string;
  form: string;
  isActive: boolean;
  usedByCount: number;
};

export type CreateMaterialSpecInput = {
  materialName: string;
  form: string;
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
