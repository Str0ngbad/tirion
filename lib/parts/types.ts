import { z } from "zod";
import {
  CreatePartSchema,
  UpdatePartSchema,
  UpdateStockCountSchema,
  UpdateInventoryLocationSchema,
  ListPartsQuerySchema,
  PartRowSchema,
  PartDetailSchema,
} from "@/lib/parts/schemas";

export type ListPartsQuery = z.infer<typeof ListPartsQuerySchema>;
export type CreatePartInput = z.infer<typeof CreatePartSchema>;
export type UpdatePartInput = z.infer<typeof UpdatePartSchema>;
export type UpdateStockCountInput = z.infer<typeof UpdateStockCountSchema>;
export type UpdateInventoryLocationInput = z.infer<typeof UpdateInventoryLocationSchema>;
export type PartRow = z.infer<typeof PartRowSchema>;
export type PartDetail = z.infer<typeof PartDetailSchema>;
