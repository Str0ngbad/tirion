import { z } from "zod";

export const ListPartsQuerySchema = z.object({
  active: z.enum(["true", "false", "all"]).default("all"),
  partType: z.enum(["Part", "Assembly"]).optional(),
});

export const CreatePartSchema = z.object({
  partNumber: z.string().min(1).max(50),
  partName: z.string().min(1).max(200),
  partType: z.enum(["Part", "Assembly"]),
  description: z.string().max(2000).nullable().optional(),
  modelLink: z.string().max(500).nullable().optional(),
  drawingLink: z.string().max(500).nullable().optional(),
  defaultVendorId: z.number().int().positive().nullable().optional(),
  vendorPartNumber: z.string().max(100).nullable().optional(),
  materialSpecId: z.number().int().positive().nullable().optional(),
  stockSize: z.string().max(100).nullable().optional(),
  routingTemplateDefinitionId: z.number().int().positive().nullable().optional(),
  blankLength: z.number().nonnegative().nullable().optional(),
  machineCycleTime: z.number().int().nonnegative().nullable().optional(),
  numberOfSetups: z.number().int().nonnegative().nullable().optional(),
  procurementCategoryId: z.number().int().positive().nullable().optional(),
  binMin: z.number().int().nonnegative().nullable().optional(),
  binMax: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  partCost: z.number().nonnegative().nullable().optional(),
});

// stockCount and inventoryLocation are explicitly absent — those have dedicated endpoints.
export const UpdatePartSchema = z
  .object({
    partNumber: z.string().min(1).max(50).optional(),
    partName: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    modelLink: z.string().max(500).nullable().optional(),
    drawingLink: z.string().max(500).nullable().optional(),
    defaultVendorId: z.number().int().positive().nullable().optional(),
    vendorPartNumber: z.string().max(100).nullable().optional(),
    materialSpecId: z.number().int().positive().nullable().optional(),
    stockSize: z.string().max(100).nullable().optional(),
    routingTemplateDefinitionId: z.number().int().positive().nullable().optional(),
    blankLength: z.number().nonnegative().nullable().optional(),
    machineCycleTime: z.number().int().nonnegative().nullable().optional(),
    numberOfSetups: z.number().int().nonnegative().nullable().optional(),
    procurementCategoryId: z.number().int().positive().nullable().optional(),
    binMin: z.number().int().nonnegative().nullable().optional(),
    binMax: z.number().int().nonnegative().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    partCost: z.number().nonnegative().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const UpdateStockCountSchema = z.object({
  stockCount: z.number().nonnegative(),
});

export const UpdateInventoryLocationSchema = z.object({
  inventoryLocation: z.string().min(1).max(100).nullable(),
});

export const PartRowSchema = z.object({
  partId: z.number().int(),
  partNumber: z.string(),
  partName: z.string(),
  partType: z.enum(["Part", "Assembly"]),
  description: z.string().nullable(),
  modelLink: z.string().nullable(),
  drawingLink: z.string().nullable(),
  defaultVendorId: z.number().int().nullable(),
  defaultVendorName: z.string().nullable(),
  vendorPartNumber: z.string().nullable(),
  materialSpecId: z.number().int().nullable(),
  materialName: z.string().nullable(),
  stockSize: z.string().nullable(),
  routingTemplateDefinitionId: z.number().int().nullable(),
  routingTemplateName: z.string().nullable(),
  blankLength: z.number().nullable(),
  machineCycleTime: z.number().int().nullable(),
  numberOfSetups: z.number().int().nullable(),
  procurementCategoryId: z.number().int().nullable(),
  procurementCategoryName: z.string().nullable(),
  inventoryLocation: z.string().nullable(),
  stockCount: z.number().nullable(),
  binMin: z.number().int().nullable(),
  binMax: z.number().int().nullable(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  partCost: z.number().nullable(),
  partCostUpdatedAt: z.date().nullable(),
  buildableCount: z.number().int().nullable(),
  materialForm: z.string().nullable(),
  assembliesUsedInCount: z.number().int().min(0),
  directChildCount: z.number().int().min(0),
  processTypes: z.array(z.string()),
});

export const PartDetailSchema = PartRowSchema.extend({
  bomParentCount: z.number().int(),
  bomChildCount: z.number().int().nullable(),
});
