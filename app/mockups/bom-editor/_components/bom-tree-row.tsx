"use client";

import { useState } from "react";
import { ChevronRight, AlertTriangle, Clock } from "lucide-react";
import {
  BomNode,
  computeBuildable,
  computeCostRollup,
  subtreeCostFreshness,
  CostFreshness,
} from "../_lib/bom-utils";
import { useTruncatedTitle } from "@/app/_lib/use-truncated-title";
import { MockPart } from "@/app/mockups/parts/_data";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  node: BomNode;
  depth: number;
  forceExpanded: boolean | null; // null = self-managed, true/false = externally controlled
  onOpenPartSheet: (part: MockPart) => void;
  onNavigateAssembly: (partId: number) => void;
};

// ─── Cost freshness indicator ────────────────────────────────────────────────

function FreshnessIndicator({ freshness }: { freshness: CostFreshness }) {
  if (freshness === "ok") return null;
  const icon =
    freshness === "missing" ? (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
    ) : (
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    );
  const tip =
    freshness === "missing"
      ? "One or more components has no cost set"
      : "One or more components has a cost older than 6 months";

  return (
    <span title={tip} className="inline-flex items-center">
      {icon}
    </span>
  );
}

// ─── Single tree row ──────────────────────────────────────────────────────────

export default function BomTreeRow({
  node,
  depth,
  forceExpanded,
  onOpenPartSheet,
  onNavigateAssembly,
}: Props) {
  const { part, quantity, children } = node;
  const isAssembly = part.partType === "Assembly";
  const hasChildren = children.length > 0;

  const [selfExpanded, setSelfExpanded] = useState(false);
  const expanded = forceExpanded !== null ? forceExpanded : selfExpanded;

  const { ref: nameRef, title: nameTitle } = useTruncatedTitle<HTMLSpanElement>(part.partName);

  // Cost / stock derivations
  const costRollup = isAssembly ? computeCostRollup(children) : part.cost;
  const buildable = isAssembly ? computeBuildable(children) : null;
  const freshness = isAssembly ? subtreeCostFreshness(children) : (part.cost === null ? "missing" : "ok" as CostFreshness);

  const INDENT = 24; // px per level
  const indentPx = depth * INDENT;

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (forceExpanded !== null) return; // controlled externally
    setSelfExpanded((v) => !v);
  }

  function handlePartNumberClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isAssembly) {
      onNavigateAssembly(part.partId);
    } else {
      onOpenPartSheet(part);
    }
  }

  function formatCost(c: number | null): string {
    if (c === null) return "—";
    return "$" + c.toFixed(2);
  }

  return (
    <>
      {/* Row */}
      <div
        className={`group flex items-center gap-0 border-b border-border/40 hover:bg-muted/50 transition-colors ${!isAssembly ? "dark:bg-muted/30" : ""}`}
        style={{ minHeight: 36 }}
      >
        {/* Left: tree zone — constrained width so data columns stay left-anchored */}
        <div className="flex w-[480px] max-w-[480px] shrink-0 items-center overflow-hidden">
          {/* Indent spacer with guide lines */}
          {depth > 0 && (
            <div
              className="shrink-0 self-stretch flex"
              style={{ width: indentPx }}
            >
              {Array.from({ length: depth }).map((_, i) => (
                <span
                  key={i}
                  className="self-stretch border-l border-border/30"
                  style={{ width: INDENT }}
                />
              ))}
            </div>
          )}

          {/* Chevron */}
          <div className="w-6 shrink-0 flex items-center justify-center">
            {isAssembly && hasChildren ? (
              <button
                onClick={handleChevronClick}
                className="flex items-center justify-center rounded hover:bg-muted transition-colors"
                style={{ width: 20, height: 20 }}
              >
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>
            ) : null}
          </div>

          {/* Part Number */}
          <button
            onClick={handlePartNumberClick}
            className="font-mono text-xs text-foreground hover:underline shrink-0 px-1"
          >
            {part.partNumber}
          </button>

          {/* Part Name */}
          <span
            ref={nameRef}
            title={nameTitle}
            className="ml-2 flex-1 truncate text-sm text-foreground"
          >
            {part.partName}
          </span>
        </div>

        {/* Right: data columns — fixed layout, left-anchored after tree zone */}
        <div className="flex shrink-0 items-center gap-0 text-right">
          {/* Qty */}
          <div className="w-16 px-2 text-right text-xs tabular-nums text-foreground">
            {quantity}
          </div>

          {/* Stock (own stock-on-hand for both Parts and Assemblies) */}
          <div className="w-20 px-2 text-right text-xs tabular-nums">
            <span className={part.stockCount === 0 ? "text-red-500" : "text-foreground"}>
              {part.stockCount ?? "—"}
            </span>
          </div>

          {/* Buildable (Assemblies only — subtree rollup) */}
          <div className="w-20 px-2 text-right text-xs tabular-nums">
            {isAssembly ? (
              buildable !== null ? (
                <span className={buildable === 0 ? "text-red-500" : "text-foreground"}>{buildable}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            ) : null}
          </div>

          {/* Cost */}
          <div className="w-24 px-2 text-right text-xs tabular-nums">
            {costRollup === null ? (
              <span className="text-amber-500">—</span>
            ) : (
              <span className="text-foreground">{formatCost(costRollup)}</span>
            )}
          </div>

          {/* Freshness */}
          <div className="w-8 flex items-center justify-center px-1">
            <FreshnessIndicator freshness={freshness} />
          </div>

          {/* Inventory Location */}
          <div className="w-24 px-2 text-left text-xs text-muted-foreground truncate">
            {part.inventoryLocation ?? "—"}
          </div>
        </div>
      </div>

      {/* Children (recursive) */}
      {expanded &&
        children.map((child) => (
          <BomTreeRow
            key={child.part.partId}
            node={child}
            depth={depth + 1}
            forceExpanded={forceExpanded}
            onOpenPartSheet={onOpenPartSheet}
            onNavigateAssembly={onNavigateAssembly}
          />
        ))}
    </>
  );
}
