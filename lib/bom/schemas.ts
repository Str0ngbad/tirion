import { z } from "zod";

export const CreateBomEdgeSchema = z.object({
  parentPartId: z.number().int().positive(),
  childPartId: z.number().int().positive(),
  quantity: z.number().positive(),
});

export const UpdateBomEdgeSchema = z.object({
  // quantity=0 is accepted here; the service interprets it as a remove request
  // per the spec's qty=0-as-remove semantics.
  quantity: z.number().nonnegative(),
});

export const BulkDeleteSchema = z.object({
  edgeIds: z.array(z.number().int().positive()).min(1).max(100),
});
