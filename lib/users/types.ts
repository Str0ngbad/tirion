import { z } from "zod";
import {
  ListUsersQuerySchema,
  RoleSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserWithProcessTypesSchema,
} from "@/lib/users/schemas";

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
export type Role = z.infer<typeof RoleSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserWithProcessTypes = z.infer<typeof UserWithProcessTypesSchema>;
