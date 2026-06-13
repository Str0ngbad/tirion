"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

// ─── Wire types (Prisma Decimal → string over JSON) ───────────────────────────

export type CandidateWO = {
  workOrderId: number;
  projectId: number;
  projectNumber: string;
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  quantity: string;
  stockCount: string;
  dueDate: string | null;
  topLevelIndex: number | null;
  parentWoId: number | null;
  inventoryLocation: string | null;
  bomPath: string[];
  cumulativeDemand: string;
};

export type ProjectStats = {
  projectId: number;
  projectNumber: string;
  customerName: string | null;
  dueDate: string | null;
  color: string | null;
  candidateCount: number;
  pendingReleaseCount: number;
  unreleasedCount: number;
};

export type SfViewData = {
  candidates: CandidateWO[];
  projectStats: ProjectStats[];
};

export type SfFilters = {
  projectId?: number;
  competingOnly?: boolean;
};

export type FulfillResult = {
  fulfilledWoId: number;
  cascadedWoIds: number[];
  autoPassedWoIds: number[];
};

export type ReleaseResult = {
  releasedWoIds: number[];
  woCount: number;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const SF_QUERY_KEY = "sfViewData";
export const PROJECTS_QUERY_KEY = "projects";

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSfViewData(filters?: SfFilters) {
  const params = new URLSearchParams();
  if (filters?.projectId !== undefined) {
    params.set("projectId", String(filters.projectId));
  }
  if (filters?.competingOnly) {
    params.set("competingOnly", "true");
  }
  const qs = params.toString();
  const url = `/api/v1/stock-fulfillment${qs ? `?${qs}` : ""}`;

  return useQuery<SfViewData>({
    queryKey: [SF_QUERY_KEY, filters],
    queryFn: () => apiFetch<SfViewData>(url),
    staleTime: 0,
  });
}

export function useFulfillFromStock() {
  const qc = useQueryClient();
  return useMutation<FulfillResult, Error, { workOrderId: number }>({
    mutationFn: (body) =>
      apiFetch<FulfillResult>("/api/v1/stock-fulfillment/fulfill", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SF_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    },
  });
}

export function usePassThrough() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { workOrderId: number }>({
    mutationFn: (body) =>
      apiFetch("/api/v1/stock-fulfillment/pass-through", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SF_QUERY_KEY] });
    },
  });
}

export function useReconcileStock() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { partId: number; newStockCount: number; reason: string }
  >({
    mutationFn: (body) =>
      apiFetch("/api/v1/stock-fulfillment/reconcile-stock", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SF_QUERY_KEY] });
    },
  });
}

export function useReleaseProject() {
  const qc = useQueryClient();
  return useMutation<ReleaseResult, Error, { projectId: number }>({
    mutationFn: (body) =>
      apiFetch<ReleaseResult>("/api/v1/stock-fulfillment/release-project", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SF_QUERY_KEY] });
    },
  });
}

export function useReleaseAll() {
  const qc = useQueryClient();
  return useMutation<ReleaseResult, Error, { projectIds?: number[] }>({
    mutationFn: (body) =>
      apiFetch<ReleaseResult>("/api/v1/stock-fulfillment/release-all", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SF_QUERY_KEY] });
    },
  });
}
