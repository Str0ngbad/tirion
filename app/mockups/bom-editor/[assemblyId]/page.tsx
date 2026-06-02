"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronsUpDown, ExternalLink } from "lucide-react";
import {
  MOCK_PARTS,
  MOCK_MATERIAL_SPECS,
  MOCK_VENDORS,
  MockPart,
  MockMinimalMaterialSpec,
  MockMinimalVendor,
} from "@/app/mockups/parts/_data";
import { buildBomTree } from "../_lib/bom-utils";
import BomEditorChrome from "../_components/bom-editor-chrome";
import BomTreeRow from "../_components/bom-tree-row";
import PartFormSheet, { SECTION_IDS } from "@/app/mockups/parts/_components/part-form-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BomEditorDetailPage() {
  const params = useParams();
  const assemblyId = Number(params.assemblyId);

  const [expandState, setExpandState] = useState<boolean | null>(null);
  const [sheetPart, setSheetPart] = useState<MockPart | null>(null);
  const [materialSpecs, setMaterialSpecs] = useState<MockMinimalMaterialSpec[]>(MOCK_MATERIAL_SPECS);
  const [vendors, setVendors] = useState<MockMinimalVendor[]>(MOCK_VENDORS);
  // treeVersion forces the memoized tree to recompute after MOCK_PARTS mutation
  const [treeVersion, setTreeVersion] = useState(0);

  // ESC closes the sheet (unless a dialog inside the sheet captured it first)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && sheetPart) setSheetPart(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetPart]);

  const assembly = MOCK_PARTS.find((p) => p.partId === assemblyId);

  const tree = useMemo(() => {
    if (!assembly || assembly.partType !== "Assembly") return [];
    return buildBomTree(assemblyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembly?.partId, treeVersion]);

  function handlePartUpdate(updated: MockPart) {
    const idx = MOCK_PARTS.findIndex((p) => p.partId === updated.partId);
    if (idx !== -1) MOCK_PARTS[idx] = updated;
    setSheetPart(updated);
    setTreeVersion((v) => v + 1);
  }

  function handleNavigateToPart(partId: number) {
    const part = MOCK_PARTS.find((p) => p.partId === partId);
    if (part) setSheetPart(part);
  }

  if (!assembly) {
    return (
      <div className="flex h-screen flex-col bg-background font-sans text-foreground">
        <BomEditorChrome />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-base font-medium text-foreground">Assembly not found</p>
          <a href="/mockups/bom-editor" className="text-sm text-primary hover:underline">
            ← Search Assemblies
          </a>
        </div>
      </div>
    );
  }

  if (assembly.partType !== "Assembly") {
    return (
      <div className="flex h-screen flex-col bg-background font-sans text-foreground">
        <BomEditorChrome />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-base font-medium text-foreground">
            {assembly.partNumber} is not an Assembly
          </p>
          <a href="/mockups/bom-editor" className="text-sm text-primary hover:underline">
            ← Search Assemblies
          </a>
        </div>
      </div>
    );
  }

  const childCount = assembly.childParts.length;

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      {/* Shared chrome — banner + page header + Assembly search */}
      <BomEditorChrome currentAssemblyId={assemblyId} />

      {/* Assembly identity band */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-3">
        <div className="mx-auto max-w-screen-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-semibold">{assembly.partNumber}</span>
            <span className="text-sm text-muted-foreground">{assembly.partName}</span>
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            >
              Assembly
            </Badge>
            <span className="text-xs text-muted-foreground">
              {childCount} direct component{childCount !== 1 ? "s" : ""}
            </span>
          </div>
          <a
            href="/mockups/parts"
            className="flex items-center gap-1.5 text-xs text-foreground hover:underline"
          >
            Open in Parts Master
            <ExternalLink className="h-3 w-3" />
          </a>
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

      {/* Body — tree + optional Part Form Sheet side panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* BOM tree */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {/* Column headers */}
          <div className="flex items-center border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
            <div className="w-[480px] shrink-0 px-2 py-2 pl-8">Component</div>
            <div className="flex shrink-0 items-center">
              <div className="w-16 px-2 py-2 text-right">Qty</div>
              <div className="w-20 px-2 py-2 text-right">Stock</div>
              <div className="w-20 px-2 py-2 text-right">Buildable</div>
              <div className="w-24 px-2 py-2 text-right">Cost</div>
              <div className="w-8 py-2" />
              <div className="w-24 px-2 py-2 text-left">Location</div>
            </div>
          </div>

          {tree.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {assembly.partName} has no components.
            </div>
          ) : (
            tree.map((node) => (
              <BomTreeRow
                key={node.part.partId}
                node={node}
                depth={0}
                forceExpanded={expandState}
                onOpenPartSheet={setSheetPart}
              />
            ))
          )}
        </div>

        {/* Part Form Sheet panel — pushes tree to ~67% */}
        {sheetPart && (
          <div className="flex w-1/3 shrink-0 flex-col border-l border-border">
            {/* Open in Parts Master strip */}
            <div className="shrink-0 border-b border-border px-4 py-2">
              <a
                href="/mockups/parts"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Open in Parts Master
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* PartFormSheet fills remaining height */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <PartFormSheet
                part={sheetPart}
                actorName="Tony"
                scrollToSectionId={SECTION_IDS.parents}
                materialSpecs={materialSpecs}
                vendors={vendors}
                onClose={() => setSheetPart(null)}
                onUpdate={handlePartUpdate}
                onAddMaterialSpec={(spec) => setMaterialSpecs((prev) => [...prev, spec])}
                onAddVendor={(vendor) => setVendors((prev) => [...prev, vendor])}
                onNavigateToPart={handleNavigateToPart}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
