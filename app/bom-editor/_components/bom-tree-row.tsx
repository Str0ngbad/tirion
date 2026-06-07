"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronRight, ChevronDown, MoreVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sortBomChildren } from "@/lib/bom/sort-helpers";
import {
  computeBuildable,
  computeCostRollup,
  computeFreshness,
  computePartFreshness,
} from "@/lib/bom/rollup-helpers";
import { FreshnessIndicator } from "./freshness-indicator";
import { QtyEditCell } from "./qty-edit-cell";
import { AddChildInputRow } from "./add-child-input-row";
import { RemoveChildrenConfirmDialog } from "./remove-children-confirm-dialog";
import { useBulkRemoveBomChildren } from "@/lib/api/bom";
import { toast } from "sonner";
import type { BomNode } from "@/lib/bom/types";

export type EditMode =
  | { type: "idle" }
  | { type: "adding"; parentPartId: number }
  | { type: "removing"; parentPartId: number; selectedChildIds: Set<number> };

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
  // Remove-mode selection context (passed by parent when it's in remove mode)
  isInRemoveSelection?: boolean;
  isRemoveSelected?: boolean;
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
  isInRemoveSelection = false,
  isRemoveSelected = false,
}: BomTreeRowProps) {
  const [selfExpanded, setSelfExpanded] = useState(isRoot);
  const expanded = forceExpanded ?? selfExpanded;
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const isAssembly = node.partType === "Assembly";
  const hasChildren = isAssembly && (node.children?.length ?? 0) > 0;
  const isInAddMode = editMode.type === "adding" && editMode.parentPartId === node.partId;
  const isInRemoveMode = editMode.type === "removing" && editMode.parentPartId === node.partId;

  const removeSelectedIds =
    editMode.type === "removing" && editMode.parentPartId === node.partId
      ? editMode.selectedChildIds
      : null;

  // Auto-expand when entering add or remove mode for this node
  useEffect(() => {
    if ((isInAddMode || isInRemoveMode) && !selfExpanded) {
      setSelfExpanded(true);
    }
  }, [isInAddMode, isInRemoveMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedChildren = useMemo(
    () => sortBomChildren(node.children ?? []),
    [node.children]
  );

  const selectedRemoveChildren = useMemo(
    () =>
      removeSelectedIds !== null
        ? sortedChildren.filter(
            (c) => c.bomId !== null && removeSelectedIds.has(c.bomId)
          )
        : [],
    [removeSelectedIds, sortedChildren]
  );

  const buildable = isAssembly ? computeBuildable(node) : null;
  const costRollup = isAssembly ? computeCostRollup(node) : node.cost;
  const freshness = isAssembly
    ? computeFreshness(node, now)
    : computePartFreshness(node, now);

  const partRowClass = node.partType === "Part" ? "bg-muted/80" : "bg-background";
  const inactiveClass = node.isActive ? "" : "opacity-40 hover:opacity-60";
  const menuDisabled = editMode.type !== "idle";

  const bulkRemove = useBulkRemoveBomChildren();

  function handleToggleChild() {
    if (editMode.type !== "removing" || node.bomId === null) return;
    const next = new Set(editMode.selectedChildIds);
    if (next.has(node.bomId)) next.delete(node.bomId);
    else next.add(node.bomId);
    setEditMode({ ...editMode, selectedChildIds: next });
  }

  function handleConfirmBulkRemove() {
    if (editMode.type !== "removing") return;
    const edgeIds = selectedRemoveChildren
      .map((c) => c.bomId)
      .filter((id): id is number => id !== null);

    bulkRemove.mutate(
      { edgeIds, parentPartId: node.partId },
      {
        onSuccess: () => {
          setBulkConfirmOpen(false);
          setEditMode({ type: "idle" });
        },
        onError: () => {
          toast.error("Failed to remove children");
          setBulkConfirmOpen(false);
        },
      }
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center text-sm hover:bg-muted/50 border-b border-border/30",
          partRowClass,
          inactiveClass,
          isInRemoveSelection && isRemoveSelected && "bg-destructive/5"
        )}
      >
        {/* Tree zone */}
        <div className="flex shrink-0 items-center overflow-hidden self-stretch w-[424px]">
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
                onClick={() => {
                  if (isInAddMode || isInRemoveMode) return;
                  setSelfExpanded(() => !expanded);
                }}
                disabled={isInAddMode || isInRemoveMode}
                className="p-0.5 hover:bg-muted rounded disabled:cursor-not-allowed disabled:opacity-50"
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
            {isInRemoveSelection && (
              <Checkbox
                checked={isRemoveSelected}
                onCheckedChange={handleToggleChild}
                aria-label={`Select ${node.partNumber} for removal`}
                className="h-3.5 w-3.5 shrink-0"
              />
            )}
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

            {/* ⋮ menu — right edge of Component column, Assembly rows only */}
            {isAssembly && (
              <div className="shrink-0 ml-auto">
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
                      onClick={() => {
                        setSelfExpanded(true);
                        setEditMode({ type: "adding", parentPartId: node.partId });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add Child
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelfExpanded(true);
                        setEditMode({
                          type: "removing",
                          parentPartId: node.partId,
                          selectedChildIds: new Set(),
                        });
                      }}
                      disabled={!hasChildren}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Remove Children
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>{/* end tree zone */}

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

      {/* Remove-children action bar */}
      {isInRemoveMode && (
        <div className="flex items-center gap-2 border-b border-border/40 bg-destructive/5 px-3 py-1.5">
          <Button
            size="sm"
            variant="destructive"
            className="h-6 px-3 text-xs"
            disabled={selectedRemoveChildren.length === 0}
            onClick={() => setBulkConfirmOpen(true)}
          >
            Remove Selected ({selectedRemoveChildren.length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setEditMode({ type: "idle" })}
          >
            Cancel
          </Button>
        </div>
      )}

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
            isInRemoveSelection={isInRemoveMode}
            isRemoveSelected={removeSelectedIds?.has(child.bomId ?? -1) ?? false}
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

      {/* Bulk remove confirmation dialog */}
      {isInRemoveMode && (
        <RemoveChildrenConfirmDialog
          open={bulkConfirmOpen}
          parentPartNumber={node.partNumber}
          items={selectedRemoveChildren
            .filter((c) => c.bomId !== null)
            .map((c) => ({
              bomId: c.bomId as number,
              partNumber: c.partNumber,
              partName: c.partName,
              quantity: c.quantity ?? 0,
            }))}
          onCancel={() => setBulkConfirmOpen(false)}
          onConfirm={handleConfirmBulkRemove}
        />
      )}
    </>
  );
}
