import { z } from "zod";

export const ListProcurementCategoriesQuerySchema = z.object({
  active: z.enum(["true", "false", "all"]).default("true"),
});

export const CreateProcurementCategorySchema = z.object({
  categoryCode: z.string().min(1).max(10),
  categoryName: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const UpdateProcurementCategorySchema = z
  .object({
    categoryCode: z.string().min(1).max(10).optional(),
    categoryName: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const ProcurementCategoryWithCountsSchema = z.object({
  procurementCategoryId: z.number().int(),
  categoryCode: z.string(),
  categoryName: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  usedByCount: z.number().int(),
});

export const ProcurementCategoryWithPartsSchema = ProcurementCategoryWithCountsSchema.extend({
  parts: z.array(
    z.object({
      partId: z.number().int(),
      partNumber: z.string(),
      partName: z.string(),
    })
  ),
});
