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
import type { BomNode, BomEdgeRow, SaveResponse } from "@/lib/bom/types";

export type { BomNode, BomEdgeRow, SaveResponse };

// ─── BOM tree ─────────────────────────────────────────────────────────────────

export function useBomTree(
  assemblyId: number | null
): UseQueryResult<BomNode, ApiError> {
  return useQuery({
    queryKey: ["bom", "tree", assemblyId],
    queryFn: () => apiFetch<BomNode>(`/api/v1/parts/${assemblyId}/bom-tree`),
    enabled: assemblyId !== null,
    staleTime: 0,
  });
}

// ─── Add child ────────────────────────────────────────────────────────────────

type AddBomChildVars = {
  parentPartId: number;
  childPartId: number;
  quantity: number;
};

export function useAddBomChild(): UseMutationResult<SaveResponse, ApiError, AddBomChildVars> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: AddBomChildVars) =>
      apiFetch<SaveResponse>("/api/v1/bom-edges", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bom", "tree", vars.parentPartId] });
      qc.invalidateQueries({ queryKey: ["parts", "grid"] });
      qc.invalidateQueries({ queryKey: ["parts", "bom-children", vars.parentPartId] });
    },
  });
}

// ─── Update quantity ──────────────────────────────────────────────────────────

type UpdateBomQuantityVars = {
  bomId: number;
  parentPartId: number;
  quantity: number;
};

type UpdateBomQuantityResult = SaveResponse | { deleted: true };

function updateNodeQty(tree: BomNode, bomId: number, quantity: number): BomNode {
  if (tree.bomId === bomId) return { ...tree, quantity };
  if (!tree.children?.length) return tree;
  return { ...tree, children: tree.children.map((c) => updateNodeQty(c, bomId, quantity)) };
}

export function useUpdateBomQuantity(): UseMutationResult<
  UpdateBomQuantityResult,
  ApiError,
  UpdateBomQuantityVars
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bomId, quantity }: UpdateBomQuantityVars) =>
      apiFetch<UpdateBomQuantityResult>(`/api/v1/bom-edges/${bomId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      }),
    onMutate: async ({ bomId, quantity, parentPartId }) => {
      await qc.cancelQueries({ queryKey: ["bom", "tree", parentPartId] });
      const previous = qc.getQueryData<BomNode>(["bom", "tree", parentPartId]);
      if (previous) {
        qc.setQueryData(["bom", "tree", parentPartId], updateNodeQty(previous, bomId, quantity));
      }
      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["bom", "tree", vars.parentPartId], context.previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["bom", "tree", vars.parentPartId] });
      qc.invalidateQueries({ queryKey: ["parts", "grid"] });
      qc.invalidateQueries({ queryKey: ["parts", "bom-children", vars.parentPartId] });
    },
  });
}

// ─── Remove single child ──────────────────────────────────────────────────────

type RemoveBomChildVars = {
  bomId: number;
  parentPartId: number;
};

function removeNodeFromTree(tree: BomNode, bomId: number): BomNode {
  if (!tree.children?.length) return tree;
  return {
    ...tree,
    children: tree.children
      .filter((c) => c.bomId !== bomId)
      .map((c) => removeNodeFromTree(c, bomId)),
  };
}

export function useRemoveBomChild(): UseMutationResult<void, ApiError, RemoveBomChildVars> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bomId }: RemoveBomChildVars) =>
      apiFetch<void>(`/api/v1/bom-edges/${bomId}`, { method: "DELETE" }),
    onMutate: async ({ bomId, parentPartId }) => {
      await qc.cancelQueries({ queryKey: ["bom", "tree", parentPartId] });
      const previous = qc.getQueryData<BomNode>(["bom", "tree", parentPartId]);
      if (previous) {
        qc.setQueryData(["bom", "tree", parentPartId], removeNodeFromTree(previous, bomId));
      }
      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["bom", "tree", vars.parentPartId], context.previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["bom", "tree", vars.parentPartId] });
      qc.invalidateQueries({ queryKey: ["parts", "grid"] });
      qc.invalidateQueries({ queryKey: ["parts", "bom-children", vars.parentPartId] });
    },
  });
}

// ─── Bulk remove children ─────────────────────────────────────────────────────

type BulkRemoveBomChildrenVars = {
  edgeIds: number[];
  parentPartId: number;
};

export function useBulkRemoveBomChildren(): UseMutationResult<
  { deletedCount: number },
  ApiError,
  BulkRemoveBomChildrenVars
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ edgeIds }: BulkRemoveBomChildrenVars) =>
      apiFetch<{ deletedCount: number }>("/api/v1/bom-edges/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ edgeIds }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bom", "tree", vars.parentPartId] });
      qc.invalidateQueries({ queryKey: ["parts", "grid"] });
      qc.invalidateQueries({ queryKey: ["parts", "bom-children", vars.parentPartId] });
    },
  });
}
