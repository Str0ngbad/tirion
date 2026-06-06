"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { sortBomChildren } from "@/lib/bom/sort-helpers";
import {
  computeBuildable,
  computeCostRollup,
  computeFreshness,
} from "@/lib/bom/rollup-helpers";
import { FreshnessIndicator } from "./freshness-indicator";
import type { BomNode } from "@/lib/bom/types";

interface BomTreeRowProps {
  node: BomNode;
  depth: number;
  forceExpanded: boolean | null;
  isRoot: boolean;
  now: Date;
  onOpenPartSheet?: (partId: number) => void;
}

const INDENT = 24;

export function BomTreeRow({
  node,
  depth,
  forceExpanded,
  isRoot,
  now,
  onOpenPartSheet,
}: BomTreeRowProps) {
  const [selfExpanded, setSelfExpanded] = useState(isRoot);
  const expanded = forceExpanded ?? selfExpanded;

  const isAssembly = node.partType === "Assembly";
  const hasChildren = isAssembly && (node.children?.length ?? 0) > 0;

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

  return (
    <>
      <div
        className={cn(
          "flex items-center text-sm hover:bg-muted/50 border-b border-border/30",
          partRowClass,
          inactiveClass
        )}
      >
        {/* Indent with connector lines */}
        <div style={{ width: depth * INDENT }} className="flex shrink-0 self-stretch">
          {Array.from({ length: depth }).map((_, i) => (
            <div
              key={i}
              style={{ width: INDENT }}
              className="border-l border-border/30"
            />
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
        </div>

        {/* Qty */}
        <div className="w-16 shrink-0 text-right tabular-nums px-2 text-sm">
          {node.quantity ?? "—"}
        </div>

        {/* Stock */}
        <div
          className={cn(
            "w-20 shrink-0 text-right tabular-nums px-2 text-sm",
            (node.stockCount ?? 0) === 0 && "text-destructive"
          )}
        >
          {node.stockCount ?? 0}
        </div>

        {/* Buildable */}
        <div
          className={cn(
            "w-20 shrink-0 text-right tabular-nums px-2 text-sm",
            buildable === 0 && "text-destructive"
          )}
        >
          {isAssembly ? buildable : ""}
        </div>

        {/* Cost */}
        <div
          className={cn(
            "w-24 shrink-0 text-right tabular-nums px-2 text-sm",
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

        {/* Spacer for future ⋮ menu */}
        <div className="w-8 shrink-0" />
      </div>

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
            onOpenPartSheet={onOpenPartSheet}
          />
        ))}
    </>
  );
}
