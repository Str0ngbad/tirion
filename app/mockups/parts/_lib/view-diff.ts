import type { Filter } from './filter-engine';
import type { Sort, View } from './views';
import type { ColumnId } from './columns';

export type GridState = {
  visibleColumns: ColumnId[];
  sort: Sort;
  filters: Filter[];
};

function filtersEqual(a: Filter[], b: Filter[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((fa, i) => {
    const fb = b[i]!;
    return (
      fa.columnId === fb.columnId &&
      fa.operator === fb.operator &&
      JSON.stringify(fa.value) === JSON.stringify(fb.value)
    );
  });
}

export function isViewDirty(view: View, state: GridState): boolean {
  if (
    state.visibleColumns.length !== view.visibleColumns.length ||
    state.visibleColumns.some((id, i) => id !== view.visibleColumns[i])
  ) return true;
  if (
    state.sort.columnId !== view.defaultSort.columnId ||
    state.sort.direction !== view.defaultSort.direction
  ) return true;
  return !filtersEqual(state.filters, view.filters);
}
