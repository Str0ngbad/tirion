"use client";

import type { ColumnId, ColumnDataType } from "../_lib/columns";
import type { Filter } from "../_lib/filter-engine";
import type { MockPart } from "../_data";
import ColumnFilterText from "./column-filter-text";
import ColumnFilterNumeric from "./column-filter-numeric";
import ColumnFilterDate from "./column-filter-date";
import ColumnFilterCategorical from "./column-filter-categorical";
import ColumnFilterBoolean from "./column-filter-boolean";
import ColumnFilterLink from "./column-filter-link";
import ColumnFilterRouting from "./column-filter-routing";

type Props = {
  columnId: ColumnId;
  dataType: ColumnDataType;
  allParts: MockPart[];
  existing: Filter | null;
  onApply: (filter: Filter) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterPopover({
  columnId,
  dataType,
  allParts,
  existing,
  onApply,
  onRemove,
  onCancel,
}: Props) {
  const shared = { columnId, existing, onApply, onRemove, onCancel };

  switch (dataType) {
    case "text":
      return <ColumnFilterText {...shared} />;
    case "number":
      return <ColumnFilterNumeric {...shared} />;
    case "currency":
      return <ColumnFilterNumeric {...shared} isCurrency />;
    case "date":
      return <ColumnFilterDate {...shared} />;
    case "categorical":
      return <ColumnFilterCategorical {...shared} allParts={allParts} />;
    case "boolean":
      return <ColumnFilterBoolean {...shared} />;
    case "link":
      return <ColumnFilterLink {...shared} />;
    case "routing":
      return <ColumnFilterRouting {...shared} />;
    default: {
      const _never: never = dataType;
      void _never;
      return null;
    }
  }
}
