"use client";

import { useState } from "react";
import { ChevronRight, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { MOCK_PARTS } from "@/app/mockups/parts/_data";
import { validateTree, NodeValidation } from "../_lib/validation";
import { MockProjectTopLevelItem } from "../_data";

// ─── Types ─────────────────────────────────────────────────────────────────────

type TreeNode = {
  validation: NodeValidation;
  children: TreeNode[];
};

// Build a tree of NodeValidation objects for display
function buildDisplayTree(
  partId: number,
  effectiveQty: number,
  path: string[],
  depth: number,
  visited: Set<number>
): TreeNode | null {
  if (visited.has(partId)) return null;
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part) return null;

  const visited2 = new Set(visited);
  visited2.add(partId);

  const validations = validateTree(partId, effectiveQty, path, depth, new Set(visited));
  const node = validations[0];
  if (!node) return null;

  const children: TreeNode[] = [];
  if (part.childParts) {
    for (const child of part.childParts) {
      const childNode = buildDisplayTree(
        child.childPartId,
        effectiveQty * child.quantity,
        [...path, part.partNumber],
        depth + 1,
        visited2
      );
      if (childNode) children.push(childNode);
    }
  }

  return { validation: node, children };
}

// ─── Validation indicator ─────────────────────────────────────────────────────

function ValidationIndicator({ node }: { node: NodeValidation }) {
  const { result } = node;
  if (result.status === "pass") {
    return (
      <span title="Pass">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      </span>
    );
  }

  const reasons: Record<string, string> = {
    "no-template": "No routing template assigned",
    "template-inactive": `Template inactive${result.templateName ? ": " + result.templateName : ""}`,
    "part-inactive": "Part is inactive",
    "circular": "Circular BOM reference detected",
  };

  const tip = reasons[result.reason] ?? result.reason;
  const linkTarget = result.reason === "circular"
    ? `/mockups/bom-editor/${node.partId}`
    : `/mockups/parts?partId=${node.partId}`;
  const isDeadEnd = result.reason === "template-inactive";

  return (
    <span className="flex items-center gap-1">
      <span title={tip}><AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" /></span>
      <span className="text-xs text-destructive">{reasons[result.reason]?.split(":")[0] ?? result.reason}</span>
      {isDeadEnd ? (
        <span className="text-xs text-muted-foreground/60 italic">(Routing Template Editor — not yet built)</span>
      ) : (
        <a
          href={linkTarget}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-0.5 text-xs text-primary hover:underline"
          title={`Open ${node.partNumber} in ${result.reason === "circular" ? "BOM Editor" : "Parts"}`}
        >
          <ExternalLink className="h-3 w-3" />
          Fix
        </a>
      )}
    </span>
  );
}

// ─── Single tree row ──────────────────────────────────────────────────────────

const INDENT = 20;

function TreeRow({
  treeNode,
  depth,
  forceExpanded,
}: {
  treeNode: TreeNode;
  depth: number;
  forceExpanded: boolean | null;
}) {
  const { validation, children } = treeNode;
  const { partNumber, partName, partType, effectiveQty } = validation;
  const isAssembly = partType === "Assembly";
  const hasChildren = children.length > 0;

  const [selfExpanded, setSelfExpanded] = useState(depth === 0);
  const expanded = forceExpanded !== null ? forceExpanded : selfExpanded;

  const indentPx = depth * INDENT;
  const isFail = validation.result.status === "fail";

  return (
    <>
      <div
        className={`flex items-start gap-0 border-b border-border/30 py-1 transition-colors hover:bg-muted/30 ${
          !isAssembly ? "bg-muted/60" : ""
        } ${isFail ? "bg-destructive/5" : ""}`}
      >
        {/* Indent + chevron */}
        <div className="flex shrink-0 items-center" style={{ paddingLeft: 8 + indentPx }}>
          {isAssembly && hasChildren ? (
            <button
              onClick={() => forceExpanded === null && setSelfExpanded((v) => !v)}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted transition-colors"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
        </div>

        {/* Part info */}
        <div className="flex flex-1 items-start flex-wrap gap-x-3 gap-y-0.5 px-2 py-0.5">
          <span className="font-mono text-xs text-muted-foreground shrink-0 w-28 truncate" title={partNumber}>
            {partNumber}
          </span>
          <span className="text-sm text-foreground flex-1 min-w-0 truncate" title={partName}>
            {partName}
          </span>
          <span className="text-xs text-muted-foreground/60 shrink-0">{partType}</span>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
            ×{effectiveQty}
          </span>
          <ValidationIndicator node={validation} />
        </div>
      </div>

      {expanded &&
        children.map((child, idx) => (
          <TreeRow
            key={`${child.validation.partId}-${idx}`}
            treeNode={child}
            depth={depth + 1}
            forceExpanded={forceExpanded}
          />
        ))}
    </>
  );
}

// ─── BOM Tree Preview ─────────────────────────────────────────────────────────

type Props = {
  topLevelItems: MockProjectTopLevelItem[];
};

export default function BomTreePreview({ topLevelItems }: Props) {
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);

  if (topLevelItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No top-level items added yet.
      </div>
    );
  }

  // Build trees
  const trees: TreeNode[] = [];
  for (const tl of topLevelItems) {
    const suffix = `.${String(tl.topLevelIndex).padStart(2, "0")}`;
    const node = buildDisplayTree(tl.partId, tl.quantity, [suffix], 0, new Set());
    if (node) trees.push(node);
  }

  // Count total WOs (every node = 1 WO)
  function countNodes(tree: TreeNode): number {
    return 1 + tree.children.reduce((acc, c) => acc + countNodes(c), 0);
  }
  const totalWOs = trees.reduce((acc, t) => acc + countNodes(t), 0);

  // Count failures
  function countFails(tree: TreeNode): number {
    return (tree.validation.result.status === "fail" ? 1 : 0) +
      tree.children.reduce((acc, c) => acc + countFails(c), 0);
  }
  const totalFails = trees.reduce((acc, t) => acc + countFails(t), 0);

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium text-foreground">BOM Tree Preview</span>
        <span className="text-xs text-muted-foreground">
          {totalWOs} Work Order{totalWOs !== 1 ? "s" : ""} would be generated
        </span>
        {totalFails > 0 && (
          <span className="text-xs text-destructive">
            {totalFails} validation {totalFails === 1 ? "issue" : "issues"}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setForceExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Expand All
          </button>
          <button
            onClick={() => setForceExpanded(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Collapse All
          </button>
          {forceExpanded !== null && (
            <button
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
        <span className="w-12 shrink-0 text-right">Qty</span>
        <span className="ml-4">Validation</span>
      </div>

      {/* Rows */}
      <div className="max-h-96 overflow-y-auto">
        {trees.map((tree, i) => (
          <TreeRow key={i} treeNode={tree} depth={0} forceExpanded={forceExpanded} />
        ))}
      </div>
    </div>
  );
}
