import { z } from "zod";
import {
  ListMaterialSpecsQuerySchema,
  CreateMaterialSpecSchema,
  UpdateMaterialSpecSchema,
  MaterialSpecWithCountsSchema,
  MaterialSpecWithPartsSchema,
} from "@/lib/material-specs/schemas";

export type ListMaterialSpecsQuery = z.infer<typeof ListMaterialSpecsQuerySchema>;
export type CreateMaterialSpecInput = z.infer<typeof CreateMaterialSpecSchema>;
export type UpdateMaterialSpecInput = z.infer<typeof UpdateMaterialSpecSchema>;
export type MaterialSpecWithCounts = z.infer<typeof MaterialSpecWithCountsSchema>;
export type MaterialSpecWithParts = z.infer<typeof MaterialSpecWithPartsSchema>;
