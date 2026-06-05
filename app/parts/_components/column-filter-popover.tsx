"use client";

import type { FilterObject } from "@/lib/views/types";
import type { ColumnDataType } from "@/app/parts/_lib/columns";
import ColumnFilterText from "./column-filter-text";
import ColumnFilterNumeric from "./column-filter-numeric";
import ColumnFilterDate from "./column-filter-date";
import ColumnFilterCategorical from "./column-filter-categorical";
import ColumnFilterBoolean from "./column-filter-boolean";
import ColumnFilterRouting from "./column-filter-routing";

type Props = {
  column: string;
  dataType: ColumnDataType;
  existing: FilterObject | null;
  onApply: (filter: FilterObject) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterPopover({ column, dataType, existing, onApply, onRemove, onCancel }: Props) {
  const shared = { column, existing, onApply, onRemove, onCancel };

  switch (dataType) {
    case "text":
      return <ColumnFilterText {...shared} />;
    case "numeric":
      return <ColumnFilterNumeric {...shared} />;
    case "currency":
      return <ColumnFilterNumeric {...shared} isCurrency />;
    case "date":
      return <ColumnFilterDate {...shared} />;
    case "categorical":
      return <ColumnFilterCategorical {...shared} />;
    case "boolean":
      return <ColumnFilterBoolean {...shared} />;
    case "routing":
      return <ColumnFilterRouting {...shared} />;
    default: {
      const _never: never = dataType;
      void _never;
      return null;
    }
  }
}
