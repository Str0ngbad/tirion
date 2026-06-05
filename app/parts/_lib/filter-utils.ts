import type { FilterObject } from "@/lib/views/types";

export function filterTooltip(filter: FilterObject, columnLabel: string): string {
  switch (filter.operator) {
    case "contains":           return `${columnLabel} contains "${filter.value}"`;
    case "not_contains":       return `${columnLabel} does not contain "${filter.value}"`;
    case "equals":             return `${columnLabel} = "${filter.value}"`;
    case "not_equals":         return `${columnLabel} ≠ "${filter.value}"`;
    case "starts_with":        return `${columnLabel} starts with "${filter.value}"`;
    case "ends_with":          return `${columnLabel} ends with "${filter.value}"`;
    case "is_empty":           return `${columnLabel} is empty`;
    case "is_not_empty":       return `${columnLabel} is not empty`;
    case "num_equals":         return `${columnLabel} = ${filter.value}`;
    case "num_not_equals":     return `${columnLabel} ≠ ${filter.value}`;
    case "greater_than":       return `${columnLabel} > ${filter.value}`;
    case "greater_than_or_eq": return `${columnLabel} ≥ ${filter.value}`;
    case "less_than":          return `${columnLabel} < ${filter.value}`;
    case "less_than_or_eq":    return `${columnLabel} ≤ ${filter.value}`;
    case "between":            return `${columnLabel} between ${filter.value.from} and ${filter.value.to}`;
    case "num_is_empty":       return `${columnLabel} is empty`;
    case "num_is_not_empty":   return `${columnLabel} is not empty`;
    case "is_true":            return `${columnLabel} is true`;
    case "is_false":           return `${columnLabel} is false`;
    case "is_any_of":          return `${columnLabel} is any of: ${filter.value.join(", ")}`;
    case "is_none_of":         return `${columnLabel} is none of: ${filter.value.join(", ")}`;
    case "date_equals":        return `${columnLabel} = ${filter.value}`;
    case "before":             return `${columnLabel} before ${filter.value}`;
    case "after":              return `${columnLabel} after ${filter.value}`;
    case "date_between":       return `${columnLabel} between ${filter.value.from} and ${filter.value.to}`;
    case "date_is_empty":      return `${columnLabel} is empty`;
    case "date_is_not_empty":  return `${columnLabel} is not empty`;
    case "routing_matrix": {
      const includes = Object.entries(filter.value)
        .filter(([, v]) => v === "include").map(([k]) => k);
      const excludes = Object.entries(filter.value)
        .filter(([, v]) => v === "exclude").map(([k]) => k);
      const parts: string[] = [];
      if (includes.length) parts.push(`incl: ${includes.join(", ")}`);
      if (excludes.length) parts.push(`excl: ${excludes.join(", ")}`);
      return `Routing: ${parts.join("; ")}`;
    }
  }
}
