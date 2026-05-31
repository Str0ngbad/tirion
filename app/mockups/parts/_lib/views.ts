import type { ColumnId } from './columns';
import type { Filter } from './filter-engine';

export type { Filter } from './filter-engine';

export type SortDirection = 'asc' | 'desc';

export type Sort = {
  columnId: ColumnId;
  direction: SortDirection;
};

export type View = {
  viewId: number;
  name: string;
  isDefault: boolean;
  visibleColumns: ColumnId[];
  defaultSort: Sort;
  filters: Filter[];
};

export function nextViewId(views: View[]): number {
  return views.reduce((max, v) => Math.max(max, v.viewId), 0) + 1;
}

export function updateView(views: View[], updated: View): View[] {
  return views.map((v) => (v.viewId === updated.viewId ? updated : v));
}

export function setDefaultView(views: View[], viewId: number): View[] {
  return views.map((v) => ({ ...v, isDefault: v.viewId === viewId }));
}

export function deleteViewById(views: View[], viewId: number): View[] {
  return views.filter((v) => v.viewId !== viewId);
}

export function duplicateView(views: View[], viewId: number): View[] {
  const source = views.find((v) => v.viewId === viewId);
  if (!source) return views;
  const newView: View = {
    ...source,
    viewId: nextViewId(views),
    name: `${source.name} copy`,
    isDefault: false,
  };
  return [...views, newView];
}

export const SEEDED_VIEWS: View[] = [
  {
    viewId: 1,
    name: 'All Parts',
    isDefault: true,
    visibleColumns: [
      'partNumber', 'partName', 'partType', 'procurement', 'material',
      'materialForm', 'vendor', 'vendorPartNumber', 'routing',
      'stockSize', 'blankLength', 'stockCount', 'location',
      'modelLink', 'drawingLink', 'binMin', 'binMax', 'cost',
      'costLastUpdated', 'assembliesUsedInCount', 'machineCycleTime',
      'numberOfSetups', 'active',
    ],
    defaultSort: { columnId: 'partNumber', direction: 'asc' },
    filters: [],
  },
  {
    viewId: 2,
    name: 'Material Audit',
    isDefault: false,
    visibleColumns: [
      'partNumber', 'partName', 'material', 'materialForm', 'stockSize',
      'blankLength', 'stockCount', 'binMin', 'binMax', 'active',
    ],
    defaultSort: { columnId: 'material', direction: 'asc' },
    filters: [
      { columnId: 'active', operator: 'isTrue', value: null },
    ],
  },
  {
    viewId: 3,
    name: 'Vendor Audit',
    isDefault: false,
    visibleColumns: [
      'partNumber', 'partName', 'vendor', 'vendorPartNumber',
      'procurement', 'cost', 'costLastUpdated', 'stockCount', 'active',
    ],
    defaultSort: { columnId: 'vendor', direction: 'asc' },
    filters: [
      { columnId: 'active', operator: 'isTrue', value: null },
    ],
  },
  {
    viewId: 4,
    name: 'Inventory Check',
    isDefault: false,
    visibleColumns: [
      'partName', 'partNumber', 'stockCount', 'location', 'active',
    ],
    defaultSort: { columnId: 'location', direction: 'asc' },
    filters: [
      { columnId: 'active', operator: 'isTrue', value: null },
      { columnId: 'stockCount', operator: 'lt', value: { value: 5 } },
    ],
  },
  {
    viewId: 5,
    name: 'Part Identification',
    isDefault: false,
    visibleColumns: [
      'partName', 'partNumber', 'modelLink', 'drawingLink',
      'vendorPartNumber', 'stockSize', 'blankLength', 'material',
      'materialForm', 'vendor', 'routing',
    ],
    defaultSort: { columnId: 'partNumber', direction: 'asc' },
    filters: [],
  },
];
