"use client";

import { useState } from "react";
import type { ColumnId } from "../_lib/columns";
import { ALL_COLUMNS } from "../_lib/columns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Columns2Icon } from "lucide-react";

type Props = {
  visibleColumns: ColumnId[];
  onToggle: (col: ColumnId) => void;
};

export default function ColumnsButton({ visibleColumns, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const visibleSet = new Set(visibleColumns);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Columns2Icon className="h-3.5 w-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          Toggle columns
        </p>
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.id}
              className="flex items-center gap-2 rounded px-1 py-1 text-xs cursor-pointer hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={visibleSet.has(col.id)}
                onChange={() => onToggle(col.id)}
                className="h-3.5 w-3.5 accent-foreground"
              />
              <span>{col.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
