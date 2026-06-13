import { z } from "zod";

export const FulfillFromStockSchema = z.object({
  workOrderId: z.number().int().positive(),
});

export const PassThroughSchema = z.object({
  workOrderId: z.number().int().positive(),
});

export const ReconcileStockSchema = z.object({
  partId: z.number().int().positive(),
  newStockCount: z.number().min(0),
  reason: z.string().min(1),
});

export const ReleaseProjectSchema = z.object({
  projectId: z.number().int().positive(),
});

export const ReleaseAllSchema = z.object({
  projectIds: z.array(z.number().int().positive()).optional(),
});

export const SfFiltersSchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  competingOnly: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});
