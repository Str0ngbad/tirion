import { z } from "zod";

export const ListUsersQuerySchema = z.object({
  active: z.enum(["true", "false", "all"]).default("true"),
});

export const RoleSchema = z.enum(["Operator", "Lead", "Manager", "Admin"]);

export const CreateUserSchema = z
  .object({
    userName: z.string().min(1).max(50),
    displayName: z.string().min(1).max(100),
    role: RoleSchema,
    defaultStation: z.string().max(100).nullable().optional(),
    assignedProcessTypeIds: z.array(z.number().int()).optional(),
  })
  .refine(
    (data) => {
      if (data.role !== "Operator" && data.defaultStation != null) return false;
      return true;
    },
    { message: "Default station is only allowed for Operator role" }
  )
  .refine(
    (data) => {
      if (
        (data.role === "Manager" || data.role === "Admin") &&
        (data.assignedProcessTypeIds?.length ?? 0) > 0
      )
        return false;
      return true;
    },
    { message: "Assigned process types must be empty for Manager and Admin roles" }
  )
  .refine(
    (data) => {
      if (
        (data.role === "Operator" || data.role === "Lead") &&
        (data.assignedProcessTypeIds?.length ?? 0) === 0
      )
        return false;
      return true;
    },
    { message: "Assigned process types are required for Operator and Lead roles" }
  );

export const UpdateUserSchema = z
  .object({
    userName: z.string().min(1).max(50).optional(),
    displayName: z.string().min(1).max(100).optional(),
    role: RoleSchema.optional(),
    defaultStation: z.string().max(100).nullable().optional(),
    assignedProcessTypeIds: z.array(z.number().int()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(
    (data) => {
      if (data.role === undefined) return true;
      if (data.role !== "Operator" && data.defaultStation != null) return false;
      return true;
    },
    { message: "Default station is only allowed for Operator role" }
  )
  .refine(
    (data) => {
      if (data.role === undefined) return true;
      if (
        (data.role === "Manager" || data.role === "Admin") &&
        (data.assignedProcessTypeIds?.length ?? 0) > 0
      )
        return false;
      return true;
    },
    { message: "Assigned process types must be empty for Manager and Admin roles" }
  )
  .refine(
    (data) => {
      if (data.role === undefined) return true;
      if (
        (data.role === "Operator" || data.role === "Lead") &&
        data.assignedProcessTypeIds !== undefined &&
        data.assignedProcessTypeIds.length === 0
      )
        return false;
      return true;
    },
    { message: "Assigned process types are required for Operator and Lead roles" }
  );

export const UserWithProcessTypesSchema = z.object({
  userId: z.number().int(),
  userName: z.string(),
  displayName: z.string(),
  role: RoleSchema,
  isActive: z.boolean(),
  defaultStation: z.string().nullable(),
  assignedProcessTypes: z.array(
    z.object({
      processTypeId: z.number().int(),
      processCode: z.string(),
      processName: z.string(),
    })
  ),
});
