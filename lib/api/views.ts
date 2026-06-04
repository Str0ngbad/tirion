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
import type { ViewRow, CreateViewInput, UpdateViewInput } from "@/lib/views/types";

export type { ViewRow };

export function useViews(): UseQueryResult<ViewRow[], ApiError> {
  return useQuery({
    queryKey: ["views", "list"],
    queryFn: () =>
      apiFetch<{ data: ViewRow[] }>("/api/v1/views").then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useCreateView(): UseMutationResult<ViewRow, ApiError, CreateViewInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateViewInput) =>
      apiFetch<ViewRow>("/api/v1/views", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "list"] });
      qc.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}

export function useUpdateView(): UseMutationResult<
  ViewRow,
  ApiError,
  { id: number; input: UpdateViewInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<ViewRow>(`/api/v1/views/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "list"] });
      qc.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}

export function useDeleteView(): UseMutationResult<void, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/api/v1/views/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", "list"] });
      qc.invalidateQueries({ queryKey: ["parts", "grid"] });
    },
  });
}
