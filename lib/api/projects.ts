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
import type { ProjectColor } from "@/components/project/project-id-pill";
import type { ValidationFailure } from "@/lib/errors/project";

export type { ProjectColor };
export type { ValidationFailure };

export type ProjectStatus = "Draft" | "Active" | "Complete" | "Archived";

export type TopLevelItemDetail = {
  topLevelItemId: number;
  partId: number;
  quantity: string;
  topLevelIndex: number;
  part: {
    partNumber: string;
    partName: string;
    partType: "Part" | "Assembly";
  };
};

export type ProjectRow = {
  projectId: number;
  projectNumber: string;
  projectName: string;
  status: ProjectStatus;
  customerName: string | null;
  dueDate: string | null;
  color: ProjectColor | null;
  priority: number | null;
  notes: string | null;
  createdAt: string;
  creatorUserId: number;
  lastEditedAt: string;
  lastEditedUserId: number;
  creator: { displayName: string };
  lastEditedBy: { displayName: string };
  topLevelItems: Array<{
    topLevelItemId: number;
    partId: number;
    quantity: string;
    topLevelIndex: number;
  }>;
};

export type ProjectDetail = {
  projectId: number;
  projectNumber: string;
  projectName: string;
  status: ProjectStatus;
  customerName: string | null;
  dueDate: string | null;
  color: ProjectColor | null;
  priority: number | null;
  notes: string | null;
  nextTopLevelIndex: number;
  createdAt: string;
  creatorUserId: number;
  lastEditedAt: string;
  lastEditedUserId: number;
  topLevelItems: TopLevelItemDetail[];
};

export type ValidationResult = {
  valid: boolean;
  failures: ValidationFailure[];
};

export type CompileResult = {
  project: ProjectDetail;
  workOrderCount: number;
};

// ─── List + Delete (existing) ─────────────────────────────────────────────────

export function useProjects(statuses?: ProjectStatus[]): UseQueryResult<ProjectRow[], ApiError> {
  const params = new URLSearchParams();
  (statuses ?? ["Draft", "Active", "Complete"]).forEach((s) => params.append("status", s));

  return useQuery({
    queryKey: ["projects", "list", { statuses: statuses ?? ["Draft", "Active", "Complete"] }],
    queryFn: () =>
      apiFetch<{ data: ProjectRow[] }>(`/api/v1/projects?${params.toString()}`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useDeleteProject(): UseMutationResult<void, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId) =>
      apiFetch<void>(`/api/v1/projects/${projectId}`, { method: "DELETE" }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects", "list"] });
    },
  });
}

// ─── Single project ───────────────────────────────────────────────────────────

export function useProject(projectId: number | null): UseQueryResult<ProjectDetail, ApiError> {
  return useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => apiFetch<ProjectDetail>(`/api/v1/projects/${projectId}`),
    enabled: projectId !== null,
    staleTime: 0,
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

type CreateProjectInput = {
  projectNumber: string;
  projectName: string;
};

export function useCreateProject(): UseMutationResult<ProjectDetail, ApiError, CreateProjectInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      apiFetch<ProjectDetail>("/api/v1/projects", { method: "POST", body: JSON.stringify(input) }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects", "list"] });
    },
  });
}

// ─── Update (PATCH) ───────────────────────────────────────────────────────────

type UpdateProjectInput = {
  projectNumber?: string;
  projectName?: string;
  customerName?: string | null;
  dueDate?: string | null;
  priority?: number | null;
  color?: ProjectColor | null;
  notes?: string | null;
};

export function useUpdateProject(): UseMutationResult<
  ProjectDetail,
  ApiError,
  { projectId: number; data: UpdateProjectInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }) =>
      apiFetch<ProjectDetail>(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      qc.setQueryData(["projects", "detail", result.projectId], result);
    },
  });
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export function useValidateProject(): UseMutationResult<
  ValidationResult,
  ApiError,
  number
> {
  return useMutation({
    mutationFn: (projectId) =>
      apiFetch<ValidationResult>(`/api/v1/projects/${projectId}/validate`, { method: "POST" }),
  });
}

// ─── Compile ──────────────────────────────────────────────────────────────────

export function useCompileProject(): UseMutationResult<
  CompileResult,
  ApiError & { failures?: ValidationFailure[] },
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId) =>
      apiFetch<CompileResult>(`/api/v1/projects/${projectId}/compile`, { method: "POST" }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects", "list"] });
    },
  });
}

// ─── Top-level items ──────────────────────────────────────────────────────────

type AddedTopLevelItem = {
  topLevelItemId: number;
  projectId: number;
  partId: number;
  quantity: string;
  topLevelIndex: number;
};

export function useAddTopLevelItem(): UseMutationResult<
  AddedTopLevelItem,
  ApiError,
  { projectId: number; partId: number; quantity: number }
> {
  return useMutation({
    mutationFn: ({ projectId, partId, quantity }) =>
      apiFetch<AddedTopLevelItem>(`/api/v1/projects/${projectId}/top-level-items`, {
        method: "POST",
        body: JSON.stringify({ partId, quantity }),
      }),
  });
}

export function useUpdateTopLevelItem(): UseMutationResult<
  AddedTopLevelItem,
  ApiError,
  { projectId: number; itemId: number; quantity: number }
> {
  return useMutation({
    mutationFn: ({ projectId, itemId, quantity }) =>
      apiFetch<AddedTopLevelItem>(
        `/api/v1/projects/${projectId}/top-level-items/${itemId}`,
        { method: "PATCH", body: JSON.stringify({ quantity }) }
      ),
  });
}

export function useRemoveTopLevelItem(): UseMutationResult<
  void,
  ApiError,
  { projectId: number; itemId: number }
> {
  return useMutation({
    mutationFn: ({ projectId, itemId }) =>
      apiFetch<void>(`/api/v1/projects/${projectId}/top-level-items/${itemId}`, {
        method: "DELETE",
      }),
  });
}

// ─── BOM children (for tree preview) ─────────────────────────────────────────

export type BomChild = {
  bomId: number;
  childPartId: number;
  partNumber: string;
  partName: string;
  isActive: boolean;
  quantity: number;
};

export type BomTreeNode = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  isActive: boolean;
  quantity: number | null;
  children: BomTreeNode[];
};

export function useBomTree(partId: number | null, enabled: boolean): UseQueryResult<BomTreeNode, ApiError> {
  return useQuery({
    queryKey: ["bom-tree", partId],
    queryFn: () => apiFetch<BomTreeNode>(`/api/v1/parts/${partId}/bom-tree`),
    enabled: enabled && partId !== null,
    staleTime: 60_000,
  });
}
