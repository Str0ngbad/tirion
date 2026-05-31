import type { ColumnId } from './columns';

export type SortDirection = 'asc' | 'desc';

export type Sort = {
  columnId: ColumnId;
  direction: SortDirection;
};

export type Filter = {
  columnId: ColumnId;
  operator: string;
  value: unknown;
};

export type View = {
  viewId: number;
  name: string;
  isDefault: boolean;
  visibleColumns: ColumnId[];
  defaultSort: Sort;
  filters: Filter[];
};

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
    filters: [],
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
    filters: [],
  },
  {
    viewId: 4,
    name: 'Inventory Check',
    isDefault: false,
    visibleColumns: [
      'partName', 'partNumber', 'stockCount', 'location', 'active',
    ],
    defaultSort: { columnId: 'location', direction: 'asc' },
    filters: [],
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
