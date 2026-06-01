import { z } from "zod";
import { FilterSchema, SortSpecSchema } from "@/lib/views/schemas";

const ActiveFilterSchema = z.enum(["true", "false", "all"]).optional();

// viewId form: apply a saved View's filters and sort.
// ad-hoc form: inline filters and sort from the client.
export const GridQueryBodySchema = z.union([
  z.object({
    viewId: z.number().int().positive(),
    activeFilter: ActiveFilterSchema,
  }),
  z.object({
    filters: z.array(FilterSchema),
    sort: z.array(SortSpecSchema),
    activeFilter: ActiveFilterSchema,
  }),
]);

export type GridQueryBody = z.infer<typeof GridQueryBodySchema>;
