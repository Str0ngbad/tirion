import type { MockPart } from '../_data';
import type { ColumnId } from './columns';
import type { ProcessTypeKey } from '@/app/mockups/users/_data';

// ─── Filter types ─────────────────────────────────────────────────────────────

export type FilterOperator =
  // text
  | 'contains' | 'equals' | 'startsWith' | 'endsWith'
  // numeric / date
  | 'eq' | 'neq' | 'gt' | 'lt' | 'between'
  // both text + numeric
  | 'isEmpty' | 'isNotEmpty'
  // categorical
  | 'isAnyOf'
  // boolean
  | 'isTrue' | 'isFalse'
  // link
  | 'hasLink' | 'missingLink'
  // routing
  | 'routingIncludesAndExcludes';

export type TextFilterValue = { text: string };
export type NumericFilterValue = { value: number } | { min: number; max: number };
export type DateFilterValue = { date: string } | { start: string; end: string };
export type CategoricalFilterValue = { values: string[] };
export type RoutingFilterValue = { includes: ProcessTypeKey[]; excludes: ProcessTypeKey[] };

export type Filter = {
  columnId: ColumnId;
  operator: FilterOperator;
  value: unknown;
};

// ─── Value extractors ─────────────────────────────────────────────────────────

function getString(part: MockPart, col: ColumnId): string | null {
  switch (col) {
    case 'partNumber':       return part.partNumber;
    case 'partName':         return part.partName;
    case 'location':         return part.inventoryLocation;
    case 'stockSize':        return part.stockSize;
    case 'vendorPartNumber': return part.vendorPartNumber;
    default:                 return null;
  }
}

function getNumber(part: MockPart, col: ColumnId): number | null {
  switch (col) {
    case 'stockCount':            return part.stockCount;
    case 'blankLength':           return part.blankLength;
    case 'binMin':                return part.binMin;
    case 'binMax':                return part.binMax;
    case 'cost':                  return part.cost;
    case 'assembliesUsedInCount': return part.assembliesUsedInCount;
    case 'machineCycleTime':      return part.machineCycleTime;
    case 'numberOfSetups':        return part.numberOfSetups;
    default:                      return null;
  }
}

function getDate(part: MockPart, col: ColumnId): string | null {
  if (col === 'costLastUpdated') return part.costLastUpdated;
  return null;
}

function getCategorical(part: MockPart, col: ColumnId): string | null {
  switch (col) {
    case 'partType':     return part.partType;
    case 'procurement':  return part.procurementType;
    case 'material':     return part.materialSpec?.materialName ?? null;
    case 'materialForm': return part.materialSpec?.form ?? null;
    case 'vendor':       return part.defaultVendor?.vendorName ?? null;
    default:             return null;
  }
}

// ─── Single filter application ────────────────────────────────────────────────

function applyFilter(part: MockPart, filter: Filter): boolean {
  const { columnId, operator, value } = filter;

  switch (operator) {
    // ── Text operators ──
    case 'contains': {
      const s = getString(part, columnId);
      if (s === null) return false;
      return s.toLowerCase().includes((value as TextFilterValue).text.toLowerCase());
    }
    case 'equals': {
      const s = getString(part, columnId);
      if (s === null) return false;
      return s.toLowerCase() === (value as TextFilterValue).text.toLowerCase();
    }
    case 'startsWith': {
      const s = getString(part, columnId);
      if (s === null) return false;
      return s.toLowerCase().startsWith((value as TextFilterValue).text.toLowerCase());
    }
    case 'endsWith': {
      const s = getString(part, columnId);
      if (s === null) return false;
      return s.toLowerCase().endsWith((value as TextFilterValue).text.toLowerCase());
    }

    // ── Numeric operators ──
    case 'eq': {
      const n = getNumber(part, columnId);
      if (n === null) return false;
      return n === (value as { value: number }).value;
    }
    case 'neq': {
      const n = getNumber(part, columnId);
      if (n === null) return true; // null ≠ anything
      return n !== (value as { value: number }).value;
    }
    case 'gt': {
      const n = getNumber(part, columnId);
      if (n !== null) return n > (value as { value: number }).value;
      const d = getDate(part, columnId);
      if (d !== null) return d > (value as { date: string }).date;
      return false;
    }
    case 'lt': {
      const n = getNumber(part, columnId);
      if (n !== null) return n < (value as { value: number }).value;
      const d = getDate(part, columnId);
      if (d !== null) return d < (value as { date: string }).date;
      return false;
    }
    case 'between': {
      const v = value as { min?: number; max?: number; start?: string; end?: string };
      if (v.min !== undefined && v.max !== undefined) {
        const n = getNumber(part, columnId);
        if (n === null) return false;
        return n >= v.min && n <= v.max;
      }
      if (v.start !== undefined && v.end !== undefined) {
        const d = getDate(part, columnId);
        if (!d) return false;
        return d >= v.start && d <= v.end;
      }
      return false;
    }

    // ── Empty/not-empty (shared) ──
    case 'isEmpty': {
      const s = getString(part, columnId);
      const n = getNumber(part, columnId);
      const d = getDate(part, columnId);
      const c = getCategorical(part, columnId);
      return (s ?? n ?? d ?? c) === null || s === '';
    }
    case 'isNotEmpty': {
      const s = getString(part, columnId);
      const n = getNumber(part, columnId);
      const d = getDate(part, columnId);
      const c = getCategorical(part, columnId);
      const val = s ?? n ?? d ?? c;
      return val !== null && val !== '';
    }

    // ── Date operators ──
    // before / after reuse gt / lt on date strings (ISO date strings sort lexicographically)
    // We encode them as gt/lt in the filter, so those cases handle them.
    // However the filter UI for dates uses 'before' / 'after' labels — we map those
    // to 'lt' / 'gt' at creation time, so they arrive here as 'gt'/'lt'.

    // ── Categorical ──
    case 'isAnyOf': {
      const c = getCategorical(part, columnId);
      if (c === null) return false;
      return (value as CategoricalFilterValue).values.includes(c);
    }

    // ── Boolean ──
    case 'isTrue': {
      if (columnId === 'active') return part.isActive;
      return false;
    }
    case 'isFalse': {
      if (columnId === 'active') return !part.isActive;
      return false;
    }

    // ── Link ──
    case 'hasLink': {
      if (columnId === 'modelLink')   return part.modelLink !== null;
      if (columnId === 'drawingLink') return part.drawingLink !== null;
      return false;
    }
    case 'missingLink': {
      if (columnId === 'modelLink')   return part.modelLink === null;
      if (columnId === 'drawingLink') return part.drawingLink === null;
      return false;
    }

    // ── Routing ──
    case 'routingIncludesAndExcludes': {
      const { includes, excludes } = value as RoutingFilterValue;
      const steps = part.routingTemplate?.steps ?? [];
      for (const inc of includes) {
        if (!steps.includes(inc)) return false;
      }
      for (const exc of excludes) {
        if (steps.includes(exc)) return false;
      }
      return true;
    }

    default: {
      const _never: never = operator;
      void _never;
      return true;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function applyFilters(parts: MockPart[], filters: Filter[]): MockPart[] {
  if (filters.length === 0) return parts;
  return parts.filter((p) => filters.every((f) => applyFilter(p, f)));
}

// ─── Filter description for tooltip ──────────────────────────────────────────

export function filterTooltip(filter: Filter): string {
  const { operator, value } = filter;
  const v = value as Record<string, unknown>;
  switch (operator) {
    case 'contains':    return `contains "${v.text}"`;
    case 'equals':      return `= "${v.text}"`;
    case 'startsWith':  return `starts with "${v.text}"`;
    case 'endsWith':    return `ends with "${v.text}"`;
    case 'eq':          return `= ${v.value}`;
    case 'neq':         return `≠ ${v.value}`;
    case 'gt':          return `> ${v.value ?? v.date}`;
    case 'lt':          return `< ${v.value ?? v.date}`;
    case 'between':
      if (v.min !== undefined) return `${v.min} to ${v.max}`;
      return `${v.start} to ${v.end}`;
    case 'isEmpty':     return 'is empty';
    case 'isNotEmpty':  return 'is not empty';
    case 'isAnyOf': {
      const vals = (v as unknown as CategoricalFilterValue).values;
      const label = vals.join(', ');
      return label.length > 50 ? label.slice(0, 47) + '…' : label;
    }
    case 'isTrue':      return 'Active only';
    case 'isFalse':     return 'Inactive only';
    case 'hasLink':     return 'has link';
    case 'missingLink': return 'missing link';
    case 'routingIncludesAndExcludes': {
      const r = value as RoutingFilterValue;
      const parts: string[] = [];
      if (r.includes.length > 0) parts.push(`Includes: ${r.includes.join(', ')}`);
      if (r.excludes.length > 0) parts.push(`Excludes: ${r.excludes.join(', ')}`);
      return parts.join(' / ') || 'no constraint';
    }
    default:
      return '';
  }
}
