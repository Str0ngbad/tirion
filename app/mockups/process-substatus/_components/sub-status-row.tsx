"use client";

import { useState, useEffect } from "react";
import { MockSubStatus } from "../_data";
import { useTruncatedTitle } from "@/app/_lib/use-truncated-title";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal } from "lucide-react";

type Props = {
  subStatus: MockSubStatus;
  onRowClick: (s: MockSubStatus) => void;
  onRetire: (s: MockSubStatus) => void;
  onReactivate: (s: MockSubStatus) => void;
  onUpdateOrder: (id: number, order: number) => void;
};

export default function SubStatusRow({
  subStatus,
  onRowClick,
  onRetire,
  onReactivate,
  onUpdateOrder,
}: Props) {
  const [inputValue, setInputValue] = useState(String(subStatus.displayOrder));
  const { ref: descRef, title: descTitle } = useTruncatedTitle<HTMLSpanElement>(
    subStatus.description ?? ""
  );

  useEffect(() => {
    setInputValue(String(subStatus.displayOrder));
  }, [subStatus.displayOrder]);

  function commitOrder() {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed !== subStatus.displayOrder) {
      onUpdateOrder(subStatus.subStatusId, parsed);
    }
  }

  return (
    <TableRow
      onClick={() => onRowClick(subStatus)}
      className={`cursor-pointer ${subStatus.isActive ? "" : "opacity-40 hover:opacity-60"}`}
    >
      <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">
        {subStatus.subStatusName}
      </TableCell>

      <TableCell className="px-3 py-2.5 max-w-[280px]">
        {subStatus.description ? (
          <span
            ref={descRef}
            title={descTitle}
            className="block truncate text-sm text-muted-foreground"
          >
            {subStatus.description}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </TableCell>

      <TableCell
        className="px-3 py-2.5 w-24"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitOrder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="w-16 h-7 text-right text-sm px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </TableCell>

      <TableCell className="px-3 py-2.5 w-16 text-center">
        {subStatus.isActive ? (
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="Inactive" />
        )}
      </TableCell>

      <TableCell
        className="px-1 py-2.5 w-10 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/40 hover:text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {subStatus.isActive ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onRetire(subStatus)}
              >
                Retire Sub-Status
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onReactivate(subStatus)}>
                Reactivate Sub-Status
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onRowClick(subStatus)}>
              View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
