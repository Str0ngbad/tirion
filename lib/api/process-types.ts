"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";

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
