import { z } from "zod";
import {
  CreateProcurementCategorySchema,
  ListProcurementCategoriesQuerySchema,
  ProcurementCategoryWithCountsSchema,
  ProcurementCategoryWithPartsSchema,
  UpdateProcurementCategorySchema,
} from "@/lib/procurement-categories/schemas";

export type ListProcurementCategoriesQuery = z.infer<typeof ListProcurementCategoriesQuerySchema>;
export type CreateProcurementCategoryInput = z.infer<typeof CreateProcurementCategorySchema>;
export type UpdateProcurementCategoryInput = z.infer<typeof UpdateProcurementCategorySchema>;
export type ProcurementCategoryWithCounts = z.infer<typeof ProcurementCategoryWithCountsSchema>;
export type ProcurementCategoryWithParts = z.infer<typeof ProcurementCategoryWithPartsSchema>;
