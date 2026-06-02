export type EditorMode =
  | { type: "idle" }
  | { type: "adding"; parentPartId: number }
  | { type: "removing"; parentPartId: number; selectedChildIds: Set<number> };
