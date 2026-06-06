"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";

export type VendorRow = {
  vendorId: number;
  vendorName: string;
  contactInfo: string | null;
  location: string | null;
  website: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  defaultVendorForCount: number;
  openSupplyOrderCount: number;
};

export type CreateVendorInput = {
  vendorName: string;
  contactInfo?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
};

export function useVendors(options?: {
  active?: "true" | "false" | "all";
}): UseQueryResult<VendorRow[], ApiError> {
  const active = options?.active ?? "true";
  return useQuery({
    queryKey: ["vendors", "list", { active }],
    queryFn: () =>
      apiFetch<{ data: VendorRow[] }>(`/api/v1/vendors?active=${active}`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreateVendor(): UseMutationResult<VendorRow, ApiError, CreateVendorInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorInput) =>
      apiFetch<VendorRow>("/api/v1/vendors", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["vendors", "list"] });
    },
  });
}
