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
import type { AuditLogEntry } from "./parts";

export type UserRole = "Operator" | "Lead" | "Manager" | "Admin";

export type AssignedProcessType = {
  processTypeId: number;
  processCode: string;
  processName: string;
};

export type UserRow = {
  userId: number;
  userName: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  defaultStation: string | null;
  assignedProcessTypes: AssignedProcessType[];
};

export type CreateUserInput = {
  userName: string;
  displayName: string;
  role: UserRole;
  defaultStation?: string | null;
  assignedProcessTypeIds?: number[];
};

export type UpdateUserInput = {
  userName?: string;
  displayName?: string;
  role?: UserRole;
  defaultStation?: string | null;
  assignedProcessTypeIds?: number[];
};

export function useUsers(options?: {
  active?: "true" | "false" | "all";
}): UseQueryResult<UserRow[], ApiError> {
  const active = options?.active ?? "true";
  return useQuery({
    queryKey: ["users", "list", { active }],
    queryFn: () =>
      apiFetch<{ data: UserRow[] }>(`/api/v1/users?active=${active}`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useUser(id: number | null): UseQueryResult<UserRow, ApiError> {
  return useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => apiFetch<UserRow>(`/api/v1/users/${id}`),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useUserAuditLog(
  id: number | null,
  enabled: boolean
): UseQueryResult<AuditLogEntry[], ApiError> {
  return useQuery({
    queryKey: ["users", "audit-log", id],
    queryFn: () =>
      apiFetch<{ data: AuditLogEntry[] }>(`/api/v1/users/${id}/audit-log`).then(
        (r) => r.data
      ),
    enabled: enabled && id !== null,
    staleTime: 30_000,
  });
}

export function useCreateUser(): UseMutationResult<UserRow, ApiError, CreateUserInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      apiFetch<UserRow>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}

export function useUpdateUser(): UseMutationResult<
  UserRow,
  ApiError,
  { id: number; input: UpdateUserInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      apiFetch<UserRow>(`/api/v1/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["users", "list"] });
      qc.invalidateQueries({ queryKey: ["users", "detail", vars.id] });
    },
  });
}

export function useDeactivateUser(): UseMutationResult<UserRow, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<UserRow>(`/api/v1/users/${id}/deactivate`, { method: "POST" }),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["users", "list"] });
      qc.invalidateQueries({ queryKey: ["users", "detail", id] });
    },
  });
}

export function useReactivateUser(): UseMutationResult<UserRow, ApiError, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<UserRow>(`/api/v1/users/${id}/reactivate`, { method: "POST" }),
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["users", "list"] });
      qc.invalidateQueries({ queryKey: ["users", "detail", id] });
    },
  });
}
