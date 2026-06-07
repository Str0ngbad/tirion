import { z } from "zod";

export const ListProcessTypeSubStatusesQuerySchema = z.object({
  active: z.enum(["true", "false", "all"]).default("true"),
  processTypeId: z.coerce.number().int().positive().optional(),
});

export const CreateProcessTypeSubStatusSchema = z.object({
  processTypeId: z.number().int().positive(),
  subStatusName: z.string().min(1).max(50),
  description: z.string().max(200).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const UpdateProcessTypeSubStatusSchema = z
  .object({
    subStatusName: z.string().min(1).max(50).optional(),
    description: z.string().max(200).nullable().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const ProcessTypeSubStatusSchema = z.object({
  processTypeSubStatusId: z.number().int(),
  processTypeId: z.number().int(),
  processCode: z.string(),
  processName: z.string(),
  subStatusName: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  usedByCount: z.number().int(),
});
