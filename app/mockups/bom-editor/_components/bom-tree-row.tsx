"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, AlertTriangle, Clock } from "lucide-react";
import {
  BomNode,
  computeBuildable,
  computeCostRollup,
  subtreeCostFreshness,
  CostFreshness,
} from "../_lib/bom-utils";
import { sortBomChildren } from "../_lib/sort";
import { useTruncatedTitle } from "@/app/_lib/use-truncated-title";
import { MockPart } from "@/app/mockups/parts/_data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  node: BomNode;
  depth: number;
  forceExpanded: boolean | null;
  onOpenPartSheet: (part: MockPart) => void;
  isRoot?: boolean;
  initialExpanded?: boolean;
  parentPartId?: number;
  parentPartNumber?: string;
  onQtyChange?: (parentPartId: number, childPartId: number, newQty: number) => void;
  onChildRemove?: (parentPartId: number, childPartId: number, removedQty: number) => void;
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
  isRoot = false,
  initialExpanded = false,
  parentPartId,
  parentPartNumber,
  onQtyChange,
  onChildRemove,
}: Props) {
  const { part, quantity, children } = node;
  const isAssembly = part.partType === "Assembly";
  const hasChildren = children.length > 0;

  const [selfExpanded, setSelfExpanded] = useState(initialExpanded);
  const expanded = forceExpanded !== null ? forceExpanded : selfExpanded;

  // Inline qty edit state
  const [editingQty, setEditingQty] = useState(false);
  // Sync ref guards against double-commit when blur fires after Enter
  const isEditingRef = useRef(false);
  const [qtyInput, setQtyInput] = useState("");
  const [qtyError, setQtyError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 0-as-remove confirmation dialog
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const { ref: nameRef, title: nameTitle } = useTruncatedTitle<HTMLSpanElement>(part.partName);

  const costRollup = isAssembly ? computeCostRollup(children) : part.cost;
  const buildable = isAssembly ? computeBuildable(children) : null;
  const freshness = isAssembly
    ? subtreeCostFreshness(children)
    : (part.cost === null ? "missing" : ("ok" as CostFreshness));

  const INDENT = 24;
  const indentPx = depth * INDENT;

  const sortedChildren = sortBomChildren(children);

  useEffect(() => {
    if (editingQty) inputRef.current?.select();
  }, [editingQty]);

  function startEditing() {
    isEditingRef.current = true;
    setEditingQty(true);
  }

  function stopEditing() {
    isEditingRef.current = false;
    setEditingQty(false);
  }

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (forceExpanded !== null) return;
    setSelfExpanded((v) => !v);
  }

  function handlePartNumberClick(e: React.MouseEvent) {
    e.stopPropagation();
    onOpenPartSheet(part);
  }

  function handleQtyCellClick() {
    if (isRoot || parentPartId === undefined) return;
    setQtyInput(String(quantity));
    setQtyError(null);
    startEditing();
  }

  function commitQty() {
    // Guard: if blur fires after Enter already committed, skip
    if (!isEditingRef.current || parentPartId === undefined) return;
    stopEditing();

    const raw = qtyInput.trim();
    if (raw === "" || raw === String(quantity)) {
      setQtyError(null);
      return;
    }

    const parsed = Number(raw);

    if (isNaN(parsed) || !isFinite(parsed)) {
      setQtyError(null); // reject silently — non-numeric
      return;
    }

    const asInt = Math.trunc(parsed);

    if (asInt < 0) {
      setQtyError("Quantity must be a positive integer");
      return;
    }

    if (asInt === 0) {
      setConfirmRemoveOpen(true);
      return;
    }

    onQtyChange?.(parentPartId, part.partId, asInt);
  }

  function handleQtyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitQty();
    if (e.key === "Escape") {
      stopEditing();
      setQtyError(null);
    }
  }

  function handleConfirmRemove() {
    setConfirmRemoveOpen(false);
    if (parentPartId !== undefined) {
      onChildRemove?.(parentPartId, part.partId, quantity);
    }
  }

  function handleCancelRemove() {
    setConfirmRemoveOpen(false);
  }

  function formatCost(c: number | null): string {
    if (c === null) return "—";
    return "$" + c.toFixed(2);
  }

  return (
    <>
      {/* Row */}
      <div
        className={`group flex items-center gap-0 border-b border-border/40 hover:bg-muted/50 transition-colors ${!isAssembly ? "bg-muted/80" : ""}`}
        style={{ minHeight: 36 }}
      >
        {/* Left: tree zone */}
        <div className="flex w-[424px] max-w-[424px] shrink-0 items-center overflow-hidden">
          {depth > 0 && (
            <div className="shrink-0 self-stretch flex" style={{ width: indentPx }}>
              {Array.from({ length: depth }).map((_, i) => (
                <span
                  key={i}
                  className="self-stretch border-l border-border/30"
                  style={{ width: INDENT }}
                />
              ))}
            </div>
          )}

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

          <button
            onClick={handlePartNumberClick}
            className="font-mono text-xs text-foreground hover:underline shrink-0 px-1"
          >
            {part.partNumber}
          </button>

          <span
            ref={nameRef}
            title={nameTitle}
            className="ml-2 flex-1 truncate text-sm text-foreground"
          >
            {part.partName}
          </span>
        </div>

        {/* Right: data columns */}
        <div className="flex shrink-0 items-center gap-0 text-right">
          {/* Qty */}
          <div className="w-16 px-2 text-right text-xs tabular-nums text-foreground">
            {isRoot ? (
              <span className="text-muted-foreground">—</span>
            ) : editingQty ? (
              <Input
                ref={inputRef}
                value={qtyInput}
                onChange={(e) => { setQtyInput(e.target.value); setQtyError(null); }}
                onBlur={commitQty}
                onKeyDown={handleQtyKeyDown}
                className="h-6 w-14 px-1 text-right text-xs tabular-nums"
                autoComplete="off"
              />
            ) : (
              <span
                onClick={parentPartId !== undefined ? handleQtyCellClick : undefined}
                className={parentPartId !== undefined ? "cursor-pointer rounded px-0.5 hover:bg-muted" : ""}
                title={parentPartId !== undefined ? "Click to edit quantity" : undefined}
              >
                {quantity}
              </span>
            )}
          </div>

          {/* Stock */}
          <div className="w-20 px-2 text-right text-xs tabular-nums">
            <span className={part.stockCount === 0 ? "text-red-500" : "text-foreground"}>
              {part.stockCount ?? "—"}
            </span>
          </div>

          {/* Buildable (Assemblies only) */}
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

      {/* Inline qty validation error */}
      {qtyError && (
        <div className="flex items-center border-b border-border/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {qtyError}
        </div>
      )}

      {/* 0-as-remove confirmation dialog */}
      <Dialog open={confirmRemoveOpen} onOpenChange={(open) => { if (!open) handleCancelRemove(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Remove {part.partNumber} from {parentPartNumber ?? "this assembly"}?
            </DialogTitle>
            <DialogDescription>
              Setting quantity to 0 will remove this child from the BOM. This cannot be undone here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRemove}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Children (recursive, sorted) */}
      {expanded &&
        sortedChildren.map((child) => (
          <BomTreeRow
            key={child.part.partId}
            node={child}
            depth={depth + 1}
            forceExpanded={forceExpanded}
            onOpenPartSheet={onOpenPartSheet}
            parentPartId={part.partId}
            parentPartNumber={part.partNumber}
            onQtyChange={onQtyChange}
            onChildRemove={onChildRemove}
          />
        ))}
    </>
  );
}
