"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronRight, ChevronDown, MoreVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { sortBomChildren } from "@/lib/bom/sort-helpers";
import {
  computeBuildable,
  computeCostRollup,
  computeFreshness,
} from "@/lib/bom/rollup-helpers";
import { FreshnessIndicator } from "./freshness-indicator";
import { QtyEditCell } from "./qty-edit-cell";
import { AddChildInputRow } from "./add-child-input-row";
import type { BomNode } from "@/lib/bom/types";

export type EditMode =
  | { type: "idle" }
  | { type: "adding"; parentPartId: number };

interface BomTreeRowProps {
  node: BomNode;
  depth: number;
  forceExpanded: boolean | null;
  isRoot: boolean;
  now: Date;
  rootTree: BomNode;
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;
  onOpenPartSheet?: (partId: number) => void;
  parentPartId?: number;
  parentPartNumber?: string;
}

const INDENT = 24;

export function BomTreeRow({
  node,
  depth,
  forceExpanded,
  isRoot,
  now,
  rootTree,
  editMode,
  setEditMode,
  onOpenPartSheet,
  parentPartId,
  parentPartNumber,
}: BomTreeRowProps) {
  const [selfExpanded, setSelfExpanded] = useState(isRoot);
  const expanded = forceExpanded ?? selfExpanded;

  const isAssembly = node.partType === "Assembly";
  const hasChildren = isAssembly && (node.children?.length ?? 0) > 0;
  const isInAddMode = editMode.type === "adding" && editMode.parentPartId === node.partId;

  // Auto-expand when entering add mode for this node
  useEffect(() => {
    if (isInAddMode && !selfExpanded) {
      setSelfExpanded(true);
    }
  }, [isInAddMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedChildren = useMemo(
    () => sortBomChildren(node.children ?? []),
    [node.children]
  );

  const buildable = isAssembly ? computeBuildable(node) : null;
  const costRollup = isAssembly ? computeCostRollup(node) : node.cost;
  const freshness = isAssembly
    ? computeFreshness(node, now)
    : node.cost === null
    ? "missing"
    : "ok";

  const partRowClass = node.partType === "Part" ? "bg-muted/80" : "bg-background";
  const inactiveClass = node.isActive ? "" : "opacity-40 hover:opacity-60";

  const menuDisabled = editMode.type !== "idle";

  return (
    <>
      <div
        className={cn(
          "flex items-center text-sm hover:bg-muted/50 border-b border-border/30",
          partRowClass,
          inactiveClass
        )}
      >
        {/* Indent */}
        <div style={{ width: depth * INDENT }} className="flex shrink-0 self-stretch">
          {Array.from({ length: depth }).map((_, i) => (
            <div key={i} style={{ width: INDENT }} className="border-l border-border/30" />
          ))}
        </div>

        {/* Chevron */}
        <div className="w-6 shrink-0 flex items-center justify-center">
          {hasChildren && (
            <button
              onClick={() => setSelfExpanded(() => !expanded)}
              className="p-0.5 hover:bg-muted rounded"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
              ) : (
                <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
              )}
            </button>
          )}
        </div>

        {/* Component column */}
        <div className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5">
          <button
            onClick={() => onOpenPartSheet?.(node.partId)}
            className="font-mono text-xs hover:underline text-foreground shrink-0"
          >
            {node.partNumber}
          </button>
          <span className="text-sm truncate" title={node.partName}>
            {node.partName}
          </span>
          {!node.isActive && (
            <Badge variant="outline" className="text-[10px] uppercase shrink-0">
              Inactive
            </Badge>
          )}

          {/* ⋮ menu adjacent to Part Name, before data columns (Assembly rows only) */}
          {isAssembly && (
            <div className="shrink-0 ml-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={menuDisabled}
                    aria-label="Row actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => setEditMode({ type: "adding", parentPartId: node.partId })}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Add Child
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Qty */}
        {isRoot || node.bomId === null || parentPartId === undefined || parentPartNumber === undefined ? (
          <div className="w-16 shrink-0 text-right tabular-nums px-2 text-xs text-muted-foreground">
            —
          </div>
        ) : (
          <QtyEditCell
            bomId={node.bomId}
            parentPartId={parentPartId}
            parentPartNumber={parentPartNumber}
            childPartNumber={node.partNumber}
            currentQty={node.quantity ?? 0}
          />
        )}

        {/* Stock */}
        <div
          className={cn(
            "w-20 shrink-0 text-right tabular-nums px-2 text-xs",
            (node.stockCount ?? 0) === 0 && "text-destructive"
          )}
        >
          {node.stockCount ?? 0}
        </div>

        {/* Buildable */}
        <div
          className={cn(
            "w-20 shrink-0 text-right tabular-nums px-2 text-xs",
            buildable === 0 && "text-destructive"
          )}
        >
          {isAssembly ? buildable : ""}
        </div>

        {/* Cost */}
        <div
          className={cn(
            "w-24 shrink-0 text-right tabular-nums px-2 text-xs",
            costRollup === null && "text-amber-500"
          )}
        >
          {costRollup === null ? "—" : `$${costRollup.toFixed(2)}`}
        </div>

        {/* Freshness */}
        <div className="w-8 shrink-0 flex items-center justify-center">
          <FreshnessIndicator freshness={freshness} />
        </div>

        {/* Location */}
        <div className="w-24 shrink-0 text-xs text-muted-foreground truncate px-2">
          {node.inventoryLocation ?? "—"}
        </div>

        {/* trailing spacer to balance column header */}
        <div className="w-8 shrink-0" />
      </div>

      {/* Children */}
      {expanded &&
        hasChildren &&
        sortedChildren.map((child) => (
          <BomTreeRow
            key={child.bomId ?? child.partId}
            node={child}
            depth={depth + 1}
            forceExpanded={forceExpanded}
            isRoot={false}
            now={now}
            rootTree={rootTree}
            editMode={editMode}
            setEditMode={setEditMode}
            onOpenPartSheet={onOpenPartSheet}
            parentPartId={node.partId}
            parentPartNumber={node.partNumber}
          />
        ))}

      {/* Add child input row */}
      {isInAddMode && (
        <AddChildInputRow
          parentPartId={node.partId}
          parentPartNumber={parentPartNumber ?? node.partNumber}
          depth={depth}
          rootTree={rootTree}
          existingChildren={node.children ?? []}
          onSuccess={() => setEditMode({ type: "idle" })}
          onCancel={() => setEditMode({ type: "idle" })}
        />
      )}
    </>
  );
}
