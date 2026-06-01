import { z } from "zod";
import {
  ListProcessTypeSubStatusesQuerySchema,
  CreateProcessTypeSubStatusSchema,
  UpdateProcessTypeSubStatusSchema,
  ProcessTypeSubStatusSchema,
} from "@/lib/process-type-sub-statuses/schemas";

export type ListProcessTypeSubStatusesQuery = z.infer<typeof ListProcessTypeSubStatusesQuerySchema>;
export type CreateProcessTypeSubStatusInput = z.infer<typeof CreateProcessTypeSubStatusSchema>;
export type UpdateProcessTypeSubStatusInput = z.infer<typeof UpdateProcessTypeSubStatusSchema>;
export type ProcessTypeSubStatus = z.infer<typeof ProcessTypeSubStatusSchema>;
