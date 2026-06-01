import { z } from "zod";

export const RoutingTemplateStepInputSchema = z.object({
  processTypeId: z.number().int().positive(),
  stepIndex: z.number().int().min(1).max(10),
});

export const CreateRoutingTemplateSchema = z.object({
  templateName: z.string().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
  steps: z.array(RoutingTemplateStepInputSchema).min(1).max(10),
});

export const UpdateRoutingTemplateSchema = z
  .object({
    templateName: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).nullable().optional(),
    steps: z.array(RoutingTemplateStepInputSchema).min(1).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const ListRoutingTemplatesQuerySchema = z.object({
  active: z.enum(["true", "false", "all"]).default("true"),
});
