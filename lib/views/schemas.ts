import { z } from "zod";

export const SortSpecSchema = z.object({
  column: z.string(),
  direction: z.enum(["asc", "desc"]),
});

// Discriminated union on `operator` — one variant per operator in the
// Filter Operator Inventory (spec/parts_master_grid_spec.md).

const FilterSchema = z.discriminatedUnion("operator", [
  // String / URL
  z.object({ column: z.string(), operator: z.literal("contains"),           value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("not_contains"),       value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("equals"),             value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("not_equals"),         value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("starts_with"),        value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("ends_with"),          value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("is_empty") }),
  z.object({ column: z.string(), operator: z.literal("is_not_empty") }),

  // Numeric (int / decimal)
  z.object({ column: z.string(), operator: z.literal("num_equals"),         value: z.number() }),
  z.object({ column: z.string(), operator: z.literal("num_not_equals"),     value: z.number() }),
  z.object({ column: z.string(), operator: z.literal("greater_than"),       value: z.number() }),
  z.object({ column: z.string(), operator: z.literal("greater_than_or_eq"), value: z.number() }),
  z.object({ column: z.string(), operator: z.literal("less_than"),          value: z.number() }),
  z.object({ column: z.string(), operator: z.literal("less_than_or_eq"),    value: z.number() }),
  z.object({ column: z.string(), operator: z.literal("between"),            value: z.object({ from: z.number(), to: z.number() }) }),
  z.object({ column: z.string(), operator: z.literal("num_is_empty") }),
  z.object({ column: z.string(), operator: z.literal("num_is_not_empty") }),

  // Boolean
  z.object({ column: z.string(), operator: z.literal("is_true") }),
  z.object({ column: z.string(), operator: z.literal("is_false") }),

  // Categorical
  z.object({ column: z.string(), operator: z.literal("is_any_of"),          value: z.array(z.string()) }),

  // Datetime
  z.object({ column: z.string(), operator: z.literal("date_equals"),        value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("before"),             value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("after"),              value: z.string() }),
  z.object({ column: z.string(), operator: z.literal("date_between"),       value: z.object({ from: z.string(), to: z.string() }) }),
  z.object({ column: z.string(), operator: z.literal("date_is_empty") }),
  z.object({ column: z.string(), operator: z.literal("date_is_not_empty") }),

  // Routing matrix — value maps process type ID → "include" | "exclude"
  z.object({
    column: z.string(),
    operator: z.literal("routing_matrix"),
    value: z.record(z.string(), z.enum(["include", "exclude"])),
  }),
]);

export const CreateViewSchema = z.object({
  name: z.string().min(1).max(30),
  visibleColumns: z.array(z.string()).min(1),
  defaultSort: z.array(SortSpecSchema),
  filters: z.array(FilterSchema),
});

export const UpdateViewSchema = z
  .object({
    name: z.string().min(1).max(30).optional(),
    visibleColumns: z.array(z.string()).min(1).optional(),
    defaultSort: z.array(SortSpecSchema).optional(),
    filters: z.array(FilterSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type { z };
