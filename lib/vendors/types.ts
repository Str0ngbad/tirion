import { z } from "zod";
import {
  CreateVendorSchema,
  ListVendorsQuerySchema,
  UpdateVendorSchema,
  VendorWithCountsSchema,
} from "@/lib/vendors/schemas";

export type ListVendorsQuery = z.infer<typeof ListVendorsQuerySchema>;
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;
export type VendorWithCounts = z.infer<typeof VendorWithCountsSchema>;
