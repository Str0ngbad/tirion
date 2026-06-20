import { z } from "zod";

/** One cell in the Composition Column: one or more candidate WO ids assigned together */
const AssignmentSchema = z.object({
  /** Candidate work order ids being confirmed together */
  workOrderIds: z.array(z.number().int().positive()).min(1),
  /**
   * Target for the assignment:
   * - "new-batch": create a new ProductionBatch
   * - "standalone": confirm each WO as standalone Open (no batch)
   * - "add-to-open-batch": merge into an existing Open batch
   * - "add-to-open-wo": create new batch from Open standalone WO + candidates
   */
  targetType: z.enum(["new-batch", "standalone", "add-to-open-batch", "add-to-open-wo"]),
  /** Required when targetType is "add-to-open-batch" */
  targetBatchId: z.number().int().positive().optional(),
  /** Required when targetType is "add-to-open-wo" */
  targetWorkOrderId: z.number().int().positive().optional(),
  /** Optional planned quantity override (must satisfy BL-9) */
  plannedQty: z.number().positive().optional(),
});

export const BatchAssignmentSchema = AssignmentSchema;
export type BatchAssignment = z.infer<typeof AssignmentSchema>;

export const ConfirmDraftSchema = z.object({
  assignments: z.array(AssignmentSchema).min(1),
});
export type ConfirmDraftInput = z.infer<typeof ConfirmDraftSchema>;

export const UpdatePlannedQtySchema = z.object({
  plannedQty: z.number().positive(),
});
export type UpdatePlannedQtyInput = z.infer<typeof UpdatePlannedQtySchema>;
