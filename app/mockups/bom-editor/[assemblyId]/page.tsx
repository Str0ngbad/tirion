"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, ChevronDown, ChevronsUpDown } from "lucide-react";
import { MOCK_PARTS, MockPart } from "@/app/mockups/parts/_data";
import { buildBomTree, computeBuildable, computeCostRollup } from "../_lib/bom-utils";
import BomTreeRow from "../_components/bom-tree-row";
import BomPartSheet from "../_components/bom-part-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BomEditorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assemblyId = Number(params.assemblyId);

  const [expandState, setExpandState] = useState<boolean | null>(null); // null = self-managed
  const [sheetPart, setSheetPart] = useState<MockPart | null>(null);

  const assembly = MOCK_PARTS.find((p) => p.partId === assemblyId);
  const tree = useMemo(() => {
    if (!assembly || assembly.partType !== "Assembly") return [];
    return buildBomTree(assemblyId);
  }, [assembly, assemblyId]);

  function navigateAssembly(partId: number) {
    router.push(`/mockups/bom-editor/${partId}`);
  }

  if (!assembly) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg font-medium text-foreground">Assembly not found</p>
        <a href="/mockups/bom-editor" className="text-sm text-primary hover:underline">
          ← Back to Assembly Search
        </a>
      </div>
    );
  }

  if (assembly.partType !== "Assembly") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg font-medium text-foreground">
          {assembly.partNumber} is not an Assembly
        </p>
        <a href="/mockups/bom-editor" className="text-sm text-primary hover:underline">
          ← Back to Assembly Search
        </a>
      </div>
    );
  }

  const buildable = computeBuildable(tree);
  const costRollup = computeCostRollup(tree);
  const childCount = assembly.childParts.length;

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="shrink-0 border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — BOM Editor</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Header band */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-screen-2xl">
          {/* Breadcrumb / back */}
          <div className="mb-3 flex items-center gap-2">
            <a
              href="/mockups/bom-editor"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Search Assemblies
            </a>
          </div>

          {/* Assembly identity + actions */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-semibold">{assembly.partNumber}</span>
              <span className="text-base text-muted-foreground">{assembly.partName}</span>
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                Assembly
              </Badge>
            </div>
            <a
              href="/mockups/parts"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              Open in Parts Master
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
            <span>{childCount} direct component{childCount !== 1 ? "s" : ""}</span>
            <span>
              Buildable:{" "}
              <span className={`font-medium ${buildable === 0 ? "text-red-500" : "text-foreground"}`}>
                {buildable}
              </span>
            </span>
            {costRollup !== null && (
              <span>
                Cost rollup:{" "}
                <span className="font-medium text-foreground">${costRollup.toFixed(2)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="shrink-0 border-b border-border px-6 py-2">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setExpandState(true)}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setExpandState(false)}
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            Collapse All
          </Button>
          {expandState !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setExpandState(null)}
            >
              Self-manage
            </Button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-screen-2xl">
          {/* Column headers */}
          <div className="flex items-center border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
            <div className="flex-1 px-2 py-2 pl-8">Component</div>
            <div className="flex shrink-0 items-center">
              <div className="w-16 px-2 py-2 text-right">Qty</div>
              <div className="w-40 px-2 py-2 text-right">Stock / Buildable</div>
              <div className="w-24 px-2 py-2 text-right">Cost</div>
              <div className="w-8 py-2" />
            </div>
          </div>

          {tree.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {assembly.partName} has no components. Add the first component to get started.
            </div>
          ) : (
            tree.map((node) => (
              <BomTreeRow
                key={node.part.partId}
                node={node}
                depth={0}
                forceExpanded={expandState}
                onOpenPartSheet={setSheetPart}
                onNavigateAssembly={navigateAssembly}
              />
            ))
          )}
        </div>
      </div>

      {/* Part detail sheet */}
      <BomPartSheet
        part={sheetPart}
        onClose={() => setSheetPart(null)}
        onNavigateAssembly={navigateAssembly}
      />
    </div>
  );
}
