import { Prisma, UserRole } from "@prisma/client";
import { ZodError, ZodIssueCode } from "zod";
import { prisma } from "@/lib/db/client";
import { isP2002OnField } from "@/lib/db/p2002";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  UserNotFoundError,
  UserAlreadyActiveError,
  UserAlreadyInactiveError,
  UserNameCollisionError,
  UserLockoutError,
} from "@/lib/errors/user";
import type {
  ListUsersQuery,
  CreateUserInput,
  UpdateUserInput,
  UserWithProcessTypes,
  Role,
} from "@/lib/users/types";

// ─── Internal types ───────────────────────────────────────────────────────────

type AssignedProcessTypeRaw = {
  processType: {
    processTypeId: number;
    processCode: string;
    processName: string;
  };
};

type UserWithProcessTypesRaw = {
  userId: number;
  userName: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  defaultStation: string | null;
  assignedProcessTypes: AssignedProcessTypeRaw[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUserWithProcessTypes(raw: UserWithProcessTypesRaw): UserWithProcessTypes {
  return {
    userId: raw.userId,
    userName: raw.userName,
    displayName: raw.displayName,
    role: raw.role as Role,
    isActive: raw.isActive,
    defaultStation: raw.defaultStation,
    assignedProcessTypes: raw.assignedProcessTypes.map((a) => ({
      processTypeId: a.processType.processTypeId,
      processCode: a.processType.processCode,
      processName: a.processType.processName,
    })),
  };
}

async function fetchWithProcessTypes(
  tx: Prisma.TransactionClient,
  userId: number
): Promise<UserWithProcessTypesRaw> {
  return tx.user.findUniqueOrThrow({
    where: { userId },
    include: {
      assignedProcessTypes: {
        include: {
          processType: {
            select: { processTypeId: true, processCode: true, processName: true },
          },
        },
        orderBy: { processType: { processCode: "asc" } },
      },
    },
  }) as Promise<UserWithProcessTypesRaw>;
}

function isNameCollision(err: unknown): boolean {
  return isP2002OnField(err, "userName");
}

async function countActiveAdmins(
  tx: Prisma.TransactionClient,
  excludeUserId?: number
): Promise<number> {
  return tx.user.count({
    where: {
      role: "Admin",
      isActive: true,
      ...(excludeUserId !== undefined ? { userId: { not: excludeUserId } } : {}),
    },
  });
}

function validateRoleConditionals(effectiveRole: Role, input: Partial<CreateUserInput>): void {
  if (effectiveRole !== "Operator" && input.defaultStation != null) {
    throw new ZodError([
      {
        code: ZodIssueCode.custom,
        path: ["defaultStation"],
        message: "Default station is only allowed for Operator role",
      },
    ]);
  }
  if (
    (effectiveRole === "Manager" || effectiveRole === "Admin") &&
    (input.assignedProcessTypeIds?.length ?? 0) > 0
  ) {
    throw new ZodError([
      {
        code: ZodIssueCode.custom,
        path: ["assignedProcessTypeIds"],
        message: "Assigned process types must be empty for Manager and Admin roles",
      },
    ]);
  }
  if (
    (effectiveRole === "Operator" || effectiveRole === "Lead") &&
    input.assignedProcessTypeIds !== undefined &&
    input.assignedProcessTypeIds.length === 0
  ) {
    throw new ZodError([
      {
        code: ZodIssueCode.custom,
        path: ["assignedProcessTypeIds"],
        message: "Assigned process types are required for Operator and Lead roles",
      },
    ]);
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listUsers(query: ListUsersQuery): Promise<UserWithProcessTypes[]> {
  let where: Prisma.UserWhereInput;

  switch (query.active) {
    case "true":
      where = { isActive: true };
      break;
    case "false":
      where = { isActive: false };
      break;
    case "all":
      where = {};
      break;
    default: {
      const _exhaustive: never = query.active;
      throw new Error(`Unhandled active filter: ${String(_exhaustive)}`);
    }
  }

  const rows = await prisma.user.findMany({
    where,
    include: {
      assignedProcessTypes: {
        include: {
          processType: {
            select: { processTypeId: true, processCode: true, processName: true },
          },
        },
        orderBy: { processType: { processCode: "asc" } },
      },
    },
    orderBy: { userName: "asc" },
  });

  return rows.map((r) => toUserWithProcessTypes(r as UserWithProcessTypesRaw));
}

export async function getUser(userId: number): Promise<UserWithProcessTypes> {
  const raw = await prisma.user.findUnique({
    where: { userId },
    include: {
      assignedProcessTypes: {
        include: {
          processType: {
            select: { processTypeId: true, processCode: true, processName: true },
          },
        },
        orderBy: { processType: { processCode: "asc" } },
      },
    },
  });

  if (raw === null) throw new UserNotFoundError(userId);

  return toUserWithProcessTypes(raw as UserWithProcessTypesRaw);
}

export async function createUser(
  input: CreateUserInput,
  actorUserId: number
): Promise<UserWithProcessTypes> {
  try {
    return await mutateWithAudit<UserWithProcessTypes>({
      userId: actorUserId,
      entityType: "User",
      action: "UserCreated",
      work: async (tx) => {
        validateRoleConditionals(input.role, input);

        const created = await tx.user.create({
          data: {
            userName: input.userName,
            displayName: input.displayName,
            role: input.role,
            defaultStation: input.defaultStation ?? null,
          },
        });

        if ((input.assignedProcessTypeIds?.length ?? 0) > 0) {
          await tx.userProcessTypeAssignment.createMany({
            data: input.assignedProcessTypeIds!.map((processTypeId) => ({
              userId: created.userId,
              processTypeId,
            })),
          });
        }

        const result = toUserWithProcessTypes(
          await fetchWithProcessTypes(tx, created.userId)
        );

        return {
          entityId: created.userId,
          previousValue: null,
          newValue: {
            userName: created.userName,
            displayName: created.displayName,
            role: created.role,
            isActive: created.isActive,
            defaultStation: created.defaultStation,
            assignedProcessTypeIds: input.assignedProcessTypeIds ?? [],
          },
          result,
        };
      },
    });
  } catch (err) {
    if (isNameCollision(err)) throw new UserNameCollisionError(input.userName);
    throw err;
  }
}

export async function updateUser(
  userId: number,
  input: UpdateUserInput,
  actorUserId: number
): Promise<UserWithProcessTypes> {
  try {
    return await mutateWithAudit<UserWithProcessTypes>({
      userId: actorUserId,
      entityType: "User",
      action: "UserUpdated",
      work: async (tx) => {
        const existing = await tx.user.findUnique({
          where: { userId },
          include: {
            assignedProcessTypes: { select: { processTypeId: true } },
          },
        });
        if (existing === null) throw new UserNotFoundError(userId);

        const effectiveRole = (input.role ?? existing.role) as Role;
        // Only validate fields that are explicitly in the input.
        // Implicit clears (defaultStation when role leaves Operator,
        // assignedProcessTypeIds when role becomes Manager/Admin) are handled
        // below by the service, not rejected here.
        validateRoleConditionals(effectiveRole, {
          role: effectiveRole,
          defaultStation: input.defaultStation !== undefined
            ? input.defaultStation
            : undefined,
          assignedProcessTypeIds: input.assignedProcessTypeIds,
        });

        const previousValue = {
          userName: existing.userName,
          displayName: existing.displayName,
          role: existing.role,
          defaultStation: existing.defaultStation,
          assignedProcessTypeIds: existing.assignedProcessTypes.map((a) => a.processTypeId),
        };

        // Admin lockout check: changing role away from Admin
        if (
          input.role !== undefined &&
          input.role !== "Admin" &&
          existing.role === "Admin"
        ) {
          const otherAdmins = await countActiveAdmins(tx, userId);
          if (otherAdmins === 0) throw new UserLockoutError(userId, "roleChange");
        }

        const newRole = input.role ?? existing.role;

        // When role changes away from Operator, implicitly clear defaultStation
        // unless the caller explicitly provided a new value.
        const clearDefaultStation =
          input.role !== undefined &&
          input.role !== "Operator" &&
          existing.role === "Operator" &&
          input.defaultStation === undefined;

        // Clear junction rows when role changes to Manager or Admin
        if (newRole === "Manager" || newRole === "Admin") {
          await tx.userProcessTypeAssignment.deleteMany({ where: { userId } });
        } else if (input.assignedProcessTypeIds !== undefined) {
          await tx.userProcessTypeAssignment.deleteMany({ where: { userId } });
          if (input.assignedProcessTypeIds.length > 0) {
            await tx.userProcessTypeAssignment.createMany({
              data: input.assignedProcessTypeIds.map((processTypeId) => ({
                userId,
                processTypeId,
              })),
            });
          }
        }

        await tx.user.update({
          where: { userId },
          data: {
            ...(input.userName !== undefined && { userName: input.userName }),
            ...(input.displayName !== undefined && { displayName: input.displayName }),
            ...(input.role !== undefined && { role: input.role }),
            ...(input.defaultStation !== undefined
              ? { defaultStation: input.defaultStation }
              : clearDefaultStation
              ? { defaultStation: null }
              : {}),
          },
        });

        const refreshed = await fetchWithProcessTypes(tx, userId);
        const result = toUserWithProcessTypes(refreshed);

        return {
          entityId: userId,
          previousValue,
          newValue: {
            userName: refreshed.userName,
            displayName: refreshed.displayName,
            role: refreshed.role,
            defaultStation: refreshed.defaultStation,
            assignedProcessTypeIds: refreshed.assignedProcessTypes.map(
              (a) => a.processType.processTypeId
            ),
          },
          result,
        };
      },
    });
  } catch (err) {
    if (isNameCollision(err)) throw new UserNameCollisionError(input.userName ?? "");
    throw err;
  }
}

export async function deactivateUser(
  userId: number,
  actorUserId: number
): Promise<UserWithProcessTypes> {
  return mutateWithAudit<UserWithProcessTypes>({
    userId: actorUserId,
    entityType: "User",
    action: "UserDeactivated",
    work: async (tx) => {
      const existing = await tx.user.findUnique({ where: { userId } });
      if (existing === null) throw new UserNotFoundError(userId);
      if (!existing.isActive) throw new UserAlreadyInactiveError(userId);

      if (existing.role === "Admin") {
        const otherAdmins = await countActiveAdmins(tx, userId);
        if (otherAdmins === 0) throw new UserLockoutError(userId, "deactivate");
      }

      await tx.user.update({ where: { userId }, data: { isActive: false } });

      const result = toUserWithProcessTypes(await fetchWithProcessTypes(tx, userId));
      return {
        entityId: userId,
        previousValue: { isActive: true },
        newValue: { isActive: false },
        result,
      };
    },
  });
}

export async function reactivateUser(
  userId: number,
  actorUserId: number
): Promise<UserWithProcessTypes> {
  return mutateWithAudit<UserWithProcessTypes>({
    userId: actorUserId,
    entityType: "User",
    action: "UserReactivated",
    work: async (tx) => {
      const existing = await tx.user.findUnique({ where: { userId } });
      if (existing === null) throw new UserNotFoundError(userId);
      if (existing.isActive) throw new UserAlreadyActiveError(userId);

      await tx.user.update({ where: { userId }, data: { isActive: true } });

      const result = toUserWithProcessTypes(await fetchWithProcessTypes(tx, userId));
      return {
        entityId: userId,
        previousValue: { isActive: false },
        newValue: { isActive: true },
        result,
      };
    },
  });
}
