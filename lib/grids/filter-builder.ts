import type { Prisma } from "@prisma/client";
import type { FilterObject } from "@/lib/views/types";

// ─── Column path resolution ───────────────────────────────────────────────────

type ColumnPath =
  | { kind: "scalar"; field: string }
  | { kind: "relation"; relation: string; field: string };

// Maps column IDs to their Prisma path. Relation columns require a join.
// Returns null for columns with fully custom handling (processTypes, routing_matrix).
function resolveColumnPath(column: string): ColumnPath | null {
  switch (column) {
    // Relation-backed display columns
    case "materialName":
      return { kind: "relation", relation: "materialSpec", field: "materialName" };
    case "materialForm":
      return { kind: "relation", relation: "materialSpec", field: "form" };
    case "defaultVendorName":
      return { kind: "relation", relation: "defaultVendor", field: "vendorName" };
    // Both column IDs in use: seed views use "procurementCategory"; PartRow uses "procurementCategoryName".
    case "procurementCategory":
    case "procurementCategoryName":
      return { kind: "relation", relation: "procurementCategory", field: "categoryName" };
    case "routingTemplateName":
      return { kind: "relation", relation: "routingTemplate", field: "templateName" };
    // Custom-handled columns — caller must handle these before calling resolveColumnPath.
    case "processTypes":
      return null;
    // All other columns are scalar fields on Part.
    default:
      return { kind: "scalar", field: column };
  }
}

// Wraps a leaf where condition in a relation object if required.
// Use applyColumnPathNull for null (IS NULL) conditions.
function applyColumnPath(
  path: ColumnPath,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leafCondition: any
): Prisma.PartWhereInput {
  if (path.kind === "scalar") {
    return { [path.field]: leafCondition } as Prisma.PartWhereInput;
  }
  return {
    [path.relation]: { [path.field]: leafCondition },
  } as Prisma.PartWhereInput;
}

function applyColumnPathNull(path: ColumnPath): Prisma.PartWhereInput {
  if (path.kind === "scalar") {
    return { [path.field]: null } as Prisma.PartWhereInput;
  }
  return {
    [path.relation]: { [path.field]: null },
  } as Prisma.PartWhereInput;
}

// ─── Routing matrix ───────────────────────────────────────────────────────────

function buildRoutingMatrixClauses(
  value: Record<string, "include" | "exclude">
): Prisma.PartWhereInput[] {
  const clauses: Prisma.PartWhereInput[] = [];
  for (const [processTypeId, constraint] of Object.entries(value)) {
    const id = parseInt(processTypeId, 10);
    if (constraint === "include") {
      // Part's routing template must have at least one step of this process type.
      // Parts with no routing template (null routingTemplateDefinitionId) will not
      // match `some` — Prisma treats null relations as empty, so they naturally
      // fail an include constraint.
      clauses.push({
        routingTemplate: { steps: { some: { processTypeId: id } } },
      });
    } else {
      // constraint === "exclude"
      // Part's routing template must have no steps of this process type.
      // Parts with null routingTemplateDefinitionId trivially satisfy exclude
      // (no template → no steps of any type), which is the intended behavior.
      clauses.push({
        routingTemplate: { steps: { none: { processTypeId: id } } },
      });
    }
  }
  return clauses;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function buildPartWhereClause(
  filters: FilterObject[]
): Prisma.PartWhereInput {
  if (filters.length === 0) return {};

  const clauses: Prisma.PartWhereInput[] = [];

  for (const filter of filters) {
    switch (filter.operator) {
      // ── String operators ────────────────────────────────────────────────── //
      case "contains": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "contains" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { contains: filter.value, mode: "insensitive" }));
        break;
      }
      case "not_contains": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "not_contains" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { not: { contains: filter.value }, mode: "insensitive" }));
        break;
      }
      case "equals": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "equals" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { equals: filter.value, mode: "default" }));
        break;
      }
      case "not_equals": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "not_equals" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { not: { equals: filter.value } }));
        break;
      }
      case "starts_with": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "starts_with" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { startsWith: filter.value, mode: "insensitive" }));
        break;
      }
      case "ends_with": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "ends_with" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { endsWith: filter.value, mode: "insensitive" }));
        break;
      }

      // ── Null checks (string) ────────────────────────────────────────────── //
      case "is_empty": {
        // Special case: is_empty on processTypes means "no routing template assigned".
        // This is a null check on routingTemplateDefinitionId, not on processTypes itself.
        if (filter.column === "processTypes") {
          clauses.push({ routingTemplateDefinitionId: null });
        } else {
          const path = resolveColumnPath(filter.column);
          if (path === null) throw new Error(`Operator "is_empty" is not supported on column "${filter.column}"`);
          clauses.push(applyColumnPathNull(path));
        }
        break;
      }
      case "is_not_empty": {
        if (filter.column === "processTypes") {
          clauses.push({ routingTemplateDefinitionId: { not: null } });
        } else {
          const path = resolveColumnPath(filter.column);
          if (path === null) throw new Error(`Operator "is_not_empty" is not supported on column "${filter.column}"`);
          clauses.push(applyColumnPath(path, { not: null }));
        }
        break;
      }

      // ── Numeric operators ───────────────────────────────────────────────── //
      case "num_equals": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "num_equals" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, filter.value));
        break;
      }
      case "num_not_equals": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "num_not_equals" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { not: filter.value }));
        break;
      }
      case "greater_than": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "greater_than" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { gt: filter.value }));
        break;
      }
      case "greater_than_or_eq": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "greater_than_or_eq" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { gte: filter.value }));
        break;
      }
      case "less_than": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "less_than" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { lt: filter.value }));
        break;
      }
      case "less_than_or_eq": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "less_than_or_eq" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { lte: filter.value }));
        break;
      }
      case "between": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "between" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { gte: filter.value.from, lte: filter.value.to }));
        break;
      }
      case "num_is_empty": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "num_is_empty" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPathNull(path));
        break;
      }
      case "num_is_not_empty": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "num_is_not_empty" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { not: null }));
        break;
      }

      // ── Boolean operators ───────────────────────────────────────────────── //
      case "is_true": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "is_true" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, true));
        break;
      }
      case "is_false": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "is_false" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, false));
        break;
      }

      // ── Categorical operator ─────────────────────────────────────────────── //
      case "is_any_of": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "is_any_of" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { in: filter.value }));
        break;
      }

      // ── Datetime operators ──────────────────────────────────────────────── //
      case "date_equals": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "date_equals" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, filter.value));
        break;
      }
      case "before": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "before" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { lt: filter.value }));
        break;
      }
      case "after": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "after" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { gt: filter.value }));
        break;
      }
      case "date_between": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "date_between" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { gte: filter.value.from, lte: filter.value.to }));
        break;
      }
      case "date_is_empty": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "date_is_empty" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPathNull(path));
        break;
      }
      case "date_is_not_empty": {
        const path = resolveColumnPath(filter.column);
        if (path === null) throw new Error(`Operator "date_is_not_empty" is not supported on column "${filter.column}"`);
        clauses.push(applyColumnPath(path, { not: null }));
        break;
      }

      // ── Routing matrix ──────────────────────────────────────────────────── //
      case "routing_matrix": {
        const matrixClauses = buildRoutingMatrixClauses(filter.value);
        clauses.push(...matrixClauses);
        break;
      }

      default: {
        const _exhaustive: never = filter;
        throw new Error(`Unhandled filter operator: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  if (clauses.length === 1) return clauses[0]!;
  return { AND: clauses };
}
