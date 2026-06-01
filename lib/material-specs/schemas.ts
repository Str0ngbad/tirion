import { z } from "zod";

export const ListMaterialSpecsQuerySchema = z.object({
  active: z.enum(["true", "false", "all"]).default("true"),
});

export const CreateMaterialSpecSchema = z.object({
  materialName: z.string().min(1).max(100),
  form: z.string().min(1).max(50),
});

export const UpdateMaterialSpecSchema = z
  .object({
    materialName: z.string().min(1).max(100).optional(),
    form: z.string().min(1).max(50).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const MaterialSpecWithCountsSchema = z.object({
  materialSpecId: z.number().int(),
  materialName: z.string(),
  form: z.string(),
  isActive: z.boolean(),
  usedByCount: z.number().int(),
});

export const MaterialSpecWithPartsSchema = MaterialSpecWithCountsSchema.extend({
  parts: z.array(
    z.object({
      partId: z.number().int(),
      partNumber: z.string(),
      partName: z.string(),
    })
  ),
});
