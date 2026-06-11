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

export type { ProjectColor };

export type ProjectStatus = "Draft" | "Active" | "Complete" | "Archived";

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
