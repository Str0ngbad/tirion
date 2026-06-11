"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { ChevronRight, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import type { TopLevelItemDetail, ValidationFailure, BomTreeNode } from "@/lib/api/projects";

// ─── Effective-qty tree ───────────────────────────────────────────────────────

type DisplayNode = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  effectiveQty: number;
  children: DisplayNode[];
};

function buildDisplayTree(bomNode: BomTreeNode, parentQty: number): DisplayNode {
  const ownQty = bomNode.quantity !== null ? parentQty * bomNode.quantity : parentQty;
  return {
    partId: bomNode.partId,
    partNumber: bomNode.partNumber,
    partName: bomNode.partName,
    partType: bomNode.partType,
    effectiveQty: ownQty,
    children: bomNode.children.map((c) => buildDisplayTree(c, ownQty)),
  };
}

function countNodes(node: DisplayNode): number {
  return 1 + node.children.reduce((s, c) => s + countNodes(c), 0);
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isFailingNode(partId: number, failures: ValidationFailure[]): ValidationFailure | null {
  return failures.find((f) => f.partId === partId) ?? null;
}

function deepLinkFor(failure: ValidationFailure): string {
  switch (failure.failureType) {
    case "no-template":    return `/parts/${failure.partId}?section=routing`;
    case "template-inactive": return failure.templateId ? `/routing-templates/${failure.templateId}` : "#";
    case "part-inactive":  return `/parts/${failure.partId}`;
    default:               return "#";
  }
}

const FAILURE_LABEL: Record<ValidationFailure["failureType"], string> = {
  "no-template":       "No template",
  "template-inactive": "Template inactive",
  "part-inactive":     "Part inactive",
};

// ─── Single tree row ──────────────────────────────────────────────────────────

const INDENT = 20;

function TreeRow({
  node,
  depth,
  failures,
  forceExpanded,
}: {
  node: DisplayNode;
  depth: number;
  failures: ValidationFailure[];
  forceExpanded: boolean | null;
}) {
  const [selfExpanded, setSelfExpanded] = useState(depth === 0);
  const expanded = forceExpanded !== null ? forceExpanded : selfExpanded;

  const failure = isFailingNode(node.partId, failures);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className={`flex items-center border-b border-border/30 py-1 hover:bg-muted/20 transition-colors ${
          failure ? "bg-destructive/5" : ""
        }`}
      >
        {/* Indent + chevron */}
        <div
          className="flex shrink-0 items-center"
          style={{ paddingLeft: 8 + depth * INDENT }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => forceExpanded === null && setSelfExpanded((v) => !v)}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-5" />
          )}
        </div>

        {/* Part info */}
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 px-2">
          <span className="w-28 shrink-0 truncate font-mono text-xs text-muted-foreground">
            {node.partNumber}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{node.partName}</span>
          <span className="shrink-0 text-xs text-muted-foreground/60">{node.partType}</span>
          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
            ×{node.effectiveQty}
          </span>

          {/* Validation indicator */}
          {failure ? (
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              <span className="text-xs text-destructive">{FAILURE_LABEL[failure.failureType]}</span>
              <a
                href={deepLinkFor(failure)}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Fix
              </a>
            </span>
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          )}
        </div>
      </div>

      {expanded &&
        node.children.map((child, i) => (
          <TreeRow
            key={`${child.partId}-${i}`}
            node={child}
            depth={depth + 1}
            failures={failures}
            forceExpanded={forceExpanded}
          />
        ))}
    </>
  );
}

// ─── BOM Tree Preview ─────────────────────────────────────────────────────────

type Props = {
  topLevelItems: TopLevelItemDetail[];
  failures: ValidationFailure[];
};

export function BomTreePreview({ topLevelItems, failures }: Props) {
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);

  // Fetch BOM tree for each Assembly top-level item
  const assemblyItems = topLevelItems.filter((tl) => tl.part.partType === "Assembly");
  const bomQueries = useQueries({
    queries: assemblyItems.map((tl) => ({
      queryKey: ["bom-tree", tl.partId],
      queryFn: () => apiFetch<BomTreeNode>(`/api/v1/parts/${tl.partId}/bom-tree`),
      staleTime: 60_000,
    })),
  });

  const anyLoading = bomQueries.some((q) => q.isLoading);

  if (topLevelItems.length === 0) {
    return (
      <div className="rounded-md border border-border/40 bg-muted/20 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Add top-level items to see the BOM tree preview.
        </p>
      </div>
    );
  }

  // Build display tree for each top-level item
  const trees: DisplayNode[] = topLevelItems.map((tl, idx) => {
    const qty = parseFloat(tl.quantity);
    if (tl.part.partType !== "Assembly") {
      // Part with no children
      return {
        partId: tl.partId,
        partNumber: tl.part.partNumber,
        partName: tl.part.partName,
        partType: tl.part.partType,
        effectiveQty: qty,
        children: [],
      };
    }
    const query = bomQueries[assemblyItems.indexOf(tl)];
    if (!query?.data) {
      return {
        partId: tl.partId,
        partNumber: tl.part.partNumber,
        partName: tl.part.partName,
        partType: tl.part.partType,
        effectiveQty: qty,
        children: [],
      };
    }
    // The bom-tree root already represents this part; build children at qty
    return {
      partId: query.data.partId,
      partNumber: query.data.partNumber,
      partName: query.data.partName,
      partType: query.data.partType,
      effectiveQty: qty,
      children: query.data.children.map((c) => buildDisplayTree(c, qty)),
    };
  });

  const totalWOs = trees.reduce((s, t) => s + countNodes(t), 0);

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium">BOM Tree Preview</span>
        {anyLoading ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {totalWOs} Work Order{totalWOs !== 1 ? "s" : ""} would be generated
          </span>
        )}
        {failures.length > 0 && (
          <span className="text-xs text-destructive">
            {failures.length} validation {failures.length === 1 ? "issue" : "issues"}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setForceExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() => setForceExpanded(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Collapse All
          </button>
          {forceExpanded !== null && (
            <button
              type="button"
              onClick={() => setForceExpanded(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex border-b border-border/60 bg-background px-8 py-1 text-xs text-muted-foreground">
        <span className="w-28 shrink-0">Part #</span>
        <span className="flex-1">Part Name</span>
        <span className="w-20 shrink-0">Type</span>
        <span className="w-10 shrink-0 text-right">Qty</span>
        <span className="ml-4">Validation</span>
      </div>

      {/* Rows */}
      <div className="max-h-96 overflow-y-auto">
        {trees.map((tree, i) => (
          <TreeRow
            key={`${tree.partId}-${i}`}
            node={tree}
            depth={0}
            failures={failures}
            forceExpanded={forceExpanded}
          />
        ))}
      </div>
    </div>
  );
}
