"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { ApiError } from "./client-error";
import type { AuditLogEntry } from "./parts";

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

export type VendorDetail = VendorRow & {
  parts: Array<{ partId: number; partNumber: string; partName: string }>;
};

export type CreateVendorInput = {
  vendorName: string;
  contactInfo?: string | null;
  location?: string | null;
  website?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
};

export type UpdateVendorInput = {
  vendorName?: string;
  contactInfo?: string | null;
  location?: string | null;
  website?: string | null;
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

export function useVendor(id: number | null): UseQueryResult<VendorDetail, ApiError> {
  return useQuery({
    queryKey: ["vendors", "detail", id],
    queryFn: () => apiFetch<VendorDetail>(`/api/v1/vendors/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useVendorAuditLog(
  id: number | null,
  enabled: boolean
): UseQueryResult<AuditLogEntry[], ApiError> {
  return useQuery({
    queryKey: ["vendors", "audit-log", id],
    queryFn: () =>
      apiFetch<{ data: AuditLogEntry[] }>(`/api/v1/vendors/${id}/audit-log`).then((r) => r.data),
    enabled: enabled && id !== null,
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

export function useUpdateVendor(): UseMutationResult<
  VendorRow,
  ApiError,
  { id: number; input: UpdateVendorInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<VendorRow>(`/api/v1/vendors/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["vendors", "list"] });
      qc.invalidateQueries({ queryKey: ["vendors", "detail", vars.id] });
    },
  });
}

export function useDeactivateVendor(): UseMutationResult<VendorRow, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<VendorRow>(`/api/v1/vendors/${id}/deactivate`, { method: "POST" }),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["vendors", "list"] });
      qc.invalidateQueries({ queryKey: ["vendors", "detail", id] });
    },
  });
}

export function useReactivateVendor(): UseMutationResult<VendorRow, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<VendorRow>(`/api/v1/vendors/${id}/reactivate`, { method: "POST" }),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["vendors", "list"] });
      qc.invalidateQueries({ queryKey: ["vendors", "detail", id] });
    },
  });
}
