import { z } from "zod";

export const ListVendorsQuerySchema = z.object({
  active: z.enum(["true", "false", "all"]).default("true"),
});

export const CreateVendorSchema = z.object({
  vendorName: z.string().min(1).max(100),
  contactInfo: z.string().max(500).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  website: z.string().url("Website must be a valid URL").max(500).nullable().optional(),
  leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateVendorSchema = z
  .object({
    vendorName: z.string().min(1).max(100).optional(),
    contactInfo: z.string().max(500).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    website: z.string().url("Website must be a valid URL").max(500).nullable().optional(),
    leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const VendorWithCountsSchema = z.object({
  vendorId: z.number().int(),
  vendorName: z.string(),
  contactInfo: z.string().nullable(),
  location: z.string().nullable(),
  website: z.string().nullable(),
  leadTimeDays: z.number().int().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  defaultVendorForCount: z.number().int(),
  openSupplyOrderCount: z.number().int(),
});
