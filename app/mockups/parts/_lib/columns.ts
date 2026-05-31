export type ColumnId =
  | 'partNumber'
  | 'partName'
  | 'partType'
  | 'procurement'
  | 'material'
  | 'materialForm'
  | 'vendor'
  | 'vendorPartNumber'
  | 'routing'
  | 'stockCount'
  | 'location'
  | 'stockSize'
  | 'blankLength'
  | 'modelLink'
  | 'drawingLink'
  | 'binMin'
  | 'binMax'
  | 'cost'
  | 'costLastUpdated'
  | 'assembliesUsedInCount'
  | 'machineCycleTime'
  | 'numberOfSetups'
  | 'active';

export type ColumnDataType =
  | 'text'
  | 'number'
  | 'date'
  | 'currency'
  | 'categorical'
  | 'boolean'
  | 'link'
  | 'routing';

export type ColumnMeta = {
  id: ColumnId;
  label: string;
  dataType: ColumnDataType;
  defaultWidth: string;
};

export const SORTABLE_COLUMNS = new Set<ColumnId>([
  'partNumber',
  'partName',
  'material',
  'vendor',
  'stockCount',
  'location',
  'cost',
  'costLastUpdated',
  'assembliesUsedInCount',
]);

export const RIGHT_ALIGNED_COLUMNS = new Set<ColumnId>([
  'stockCount',
  'blankLength',
  'binMin',
  'binMax',
  'cost',
  'assembliesUsedInCount',
  'machineCycleTime',
  'numberOfSetups',
]);

export const CENTER_COLUMNS = new Set<ColumnId>([
  'active',
  'modelLink',
  'drawingLink',
]);

export const ALL_COLUMNS: ColumnMeta[] = [
  { id: 'partNumber',            label: 'Part Number',  dataType: 'text',        defaultWidth: 'min-w-[120px] max-w-[160px]' },
  { id: 'partName',              label: 'Part Name',    dataType: 'text',        defaultWidth: 'min-w-[200px] max-w-[280px]' },
  { id: 'partType',              label: 'Type',         dataType: 'categorical', defaultWidth: 'w-24' },
  { id: 'procurement',           label: 'Procurement',  dataType: 'categorical', defaultWidth: 'w-28' },
  { id: 'material',              label: 'Material',     dataType: 'categorical', defaultWidth: 'min-w-[140px]' },
  { id: 'materialForm',          label: 'Form',         dataType: 'categorical', defaultWidth: 'w-24' },
  { id: 'vendor',                label: 'Vendor',       dataType: 'categorical', defaultWidth: 'min-w-[140px]' },
  { id: 'vendorPartNumber',      label: 'Vendor Part #', dataType: 'text',       defaultWidth: 'min-w-[120px]' },
  { id: 'routing',               label: 'Routing',      dataType: 'routing',     defaultWidth: 'flex-1 min-w-[160px]' },
  { id: 'stockCount',            label: 'Stock',        dataType: 'number',      defaultWidth: 'w-20' },
  { id: 'location',              label: 'Location',     dataType: 'text',        defaultWidth: 'min-w-[120px] max-w-[180px]' },
  { id: 'stockSize',             label: 'Stock Size',   dataType: 'text',        defaultWidth: 'min-w-[120px]' },
  { id: 'blankLength',           label: 'Blank Length', dataType: 'number',      defaultWidth: 'w-24' },
  { id: 'modelLink',             label: 'Model',        dataType: 'link',        defaultWidth: 'w-20' },
  { id: 'drawingLink',           label: 'Drawing',      dataType: 'link',        defaultWidth: 'w-20' },
  { id: 'binMin',                label: 'Bin Min',      dataType: 'number',      defaultWidth: 'w-20' },
  { id: 'binMax',                label: 'Bin Max',      dataType: 'number',      defaultWidth: 'w-20' },
  { id: 'cost',                  label: 'Cost',         dataType: 'currency',    defaultWidth: 'w-24' },
  { id: 'costLastUpdated',       label: 'Cost Updated', dataType: 'date',        defaultWidth: 'w-28' },
  { id: 'assembliesUsedInCount', label: 'Used In',      dataType: 'number',      defaultWidth: 'w-16' },
  { id: 'machineCycleTime',      label: 'Cycle Time',   dataType: 'number',      defaultWidth: 'w-24' },
  { id: 'numberOfSetups',        label: 'Setups',       dataType: 'number',      defaultWidth: 'w-16' },
  { id: 'active',                label: 'Active',       dataType: 'boolean',     defaultWidth: 'w-16' },
];

export const COLUMN_BY_ID = new Map<ColumnId, ColumnMeta>(
  ALL_COLUMNS.map((c) => [c.id, c])
);
