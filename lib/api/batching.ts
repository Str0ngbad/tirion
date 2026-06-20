"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { BatchingViewData } from "@/lib/batching/types";
import type { ConfirmDraftInput } from "@/lib/batching/schemas";

const BATCHING_QUERY_KEY = "batchingViewData";

// Prisma Decimal fields come over JSON as strings
export type BatchingViewDataWire = {
  candidatesByPartId: Record<
    string,
    Array<{
      workOrderId: number;
      partId: number;
      partNumber: string;
      partName: string;
      demand: string;
      priority: number | null;
      dueDate: string | null;
      routingSteps: Array<{ stepIndex: number; processTypeName: string }>;
      bomPath: Array<{ partNumber: string; partName: string }>;
      topLevelRef: string;
      productionState: "case1" | "case2" | "case3";
      completedQty: string | null;
      lockState: "Locked" | "Unlocked";
      projectNumber?: string;
      projectColor?: string | null;
    }>
  >;
  openRowsByPartId: Record<
    string,
    Array<{
      workOrderId: number | null;
      batchId: number | null;
      batchDisplayId: string | null;
      partId: number;
      partNumber: string;
      partName: string;
      demand: string;
      plannedQty: string | null;
      available: string;
      dueDate?: string | null;
      productionState: "case1" | "case2" | "case3";
      completedQty: string | null;
      activeStepIndex?: number | null;
      projectColor?: string | null;
    }>
  >;
  partIds: number[];
};

export function useBatchingViewData() {
  return useQuery<BatchingViewDataWire>({
    queryKey: [BATCHING_QUERY_KEY],
    queryFn: () => apiFetch<BatchingViewDataWire>("/api/v1/batching"),
    staleTime: 0,
  });
}

export type ConfirmDraftPayload = {
  assignments: Array<{
    workOrderIds: number[];
    targetType: "new-batch" | "standalone" | "add-to-open-batch" | "add-to-open-wo";
    targetBatchId?: number;
    targetWorkOrderId?: number;
    plannedQty?: number;
  }>;
};

export function useConfirmDraft() {
  const qc = useQueryClient();
  return useMutation<void, Error, ConfirmDraftPayload>({
    mutationFn: (body) =>
      apiFetch("/api/v1/batching/confirm-draft", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BATCHING_QUERY_KEY] });
    },
  });
}

export function useUpdatePlannedQty() {
  const qc = useQueryClient();
  return useMutation<void, Error, { batchId: number; plannedQty: number }>({
    mutationFn: ({ batchId, plannedQty }) =>
      apiFetch(`/api/v1/batching/batches/${batchId}/planned-qty`, {
        method: "PATCH",
        body: JSON.stringify({ plannedQty }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BATCHING_QUERY_KEY] });
    },
  });
}
