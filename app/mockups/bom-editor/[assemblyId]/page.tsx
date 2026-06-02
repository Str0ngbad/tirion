"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronsUpDown, ExternalLink } from "lucide-react";
import {
  MOCK_PARTS,
  MockPart,
  MockMinimalMaterialSpec,
  MockMinimalVendor,
  MOCK_MATERIAL_SPECS,
  MOCK_VENDORS,
} from "@/app/mockups/parts/_data";
import { buildBomTree, BomNode } from "../_lib/bom-utils";
import { EditorMode } from "../_lib/types";
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
  const [treeVersion, setTreeVersion] = useState(0);
  const [editorMode, setEditorMode] = useState<EditorMode>({ type: "idle" });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // ESC unwinds topmost: sheet first, then edit mode
        if (sheetPart) {
          setSheetPart(null);
        } else if (editorMode.type !== "idle") {
          setEditorMode({ type: "idle" });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetPart, editorMode]);

  const assembly = MOCK_PARTS.find((p) => p.partId === assemblyId);

  const rootNode = useMemo<BomNode | null>(() => {
    if (!assembly || assembly.partType !== "Assembly") return null;
    const children = buildBomTree(assemblyId);
    return { part: assembly, quantity: 0, displayOrder: 0, children };
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

  function handleQtyChange(parentPartId: number, childPartId: number, newQty: number) {
    const parent = MOCK_PARTS.find((p) => p.partId === parentPartId);
    if (!parent) return;
    const rel = parent.childParts.find((c) => c.childPartId === childPartId);
    if (!rel) return;
    const oldQty = rel.quantity;
    rel.quantity = newQty;
    parent.auditLog.unshift({
      timestamp: new Date().toISOString(),
      userName: "Marcus Hill",
      action: "BomChildQtyChanged",
      changedFields: [
        {
          field: `BOM child [${rel.childPartNumber}] quantity`,
          before: String(oldQty),
          after: String(newQty),
        },
      ],
    });
    setTreeVersion((v) => v + 1);
  }

  function handleChildRemove(parentPartId: number, childPartId: number, removedQty: number) {
    const parent = MOCK_PARTS.find((p) => p.partId === parentPartId);
    if (!parent) return;
    const rel = parent.childParts.find((c) => c.childPartId === childPartId);
    if (!rel) return;
    parent.auditLog.unshift({
      timestamp: new Date().toISOString(),
      userName: "Marcus Hill",
      action: "BomChildRemoved",
      changedFields: [
        {
          field: `BOM child [${rel.childPartNumber}]`,
          before: `qty ${removedQty}`,
          after: "removed",
        },
      ],
    });
    parent.childParts = parent.childParts.filter((c) => c.childPartId !== childPartId);
    // Update child's parentAssemblies reciprocal
    const child = MOCK_PARTS.find((p) => p.partId === childPartId);
    if (child) {
      child.parentAssemblies = child.parentAssemblies.filter(
        (a) => a.assemblyPartId !== parentPartId
      );
    }
    setTreeVersion((v) => v + 1);
  }

  // ─── Editor mode handlers ───────────────────────────────────────────────────

  function handleStartAdd(parentPartId: number) {
    setEditorMode({ type: "adding", parentPartId });
  }

  function handleStartRemove(parentPartId: number) {
    setEditorMode({ type: "removing", parentPartId, selectedChildIds: new Set() });
  }

  function handleCancelEdit() {
    setEditorMode({ type: "idle" });
  }

  function handleToggleRemoveChild(childPartId: number) {
    if (editorMode.type !== "removing") return;
    const next = new Set(editorMode.selectedChildIds);
    if (next.has(childPartId)) {
      next.delete(childPartId);
    } else {
      next.add(childPartId);
    }
    setEditorMode({ ...editorMode, selectedChildIds: next });
  }

  function handleCommitAdd(parentPartId: number, childPartId: number, qty: number) {
    const parent = MOCK_PARTS.find((p) => p.partId === parentPartId);
    const childPart = MOCK_PARTS.find((p) => p.partId === childPartId);
    if (!parent || !childPart) return;

    const existing = parent.childParts.find((c) => c.childPartId === childPartId);
    if (existing) {
      // Increment existing
      const oldQty = existing.quantity;
      existing.quantity += qty;
      parent.auditLog.unshift({
        timestamp: new Date().toISOString(),
        userName: "Marcus Hill",
        action: "BomChildQtyChanged",
        changedFields: [
          {
            field: `BOM child [${existing.childPartNumber}]`,
            before: `qty ${oldQty}`,
            after: `qty ${existing.quantity}`,
          },
        ],
      });
      // Update reciprocal quantity
      const reciprocal = childPart.parentAssemblies.find((a) => a.assemblyPartId === parentPartId);
      if (reciprocal) reciprocal.quantityInParent = existing.quantity;
    } else {
      // Add new
      parent.childParts.push({
        childPartId,
        childPartNumber: childPart.partNumber,
        childPartName: childPart.partName,
        quantity: qty,
      });
      parent.auditLog.unshift({
        timestamp: new Date().toISOString(),
        userName: "Marcus Hill",
        action: "BomChildAdded",
        changedFields: [
          {
            field: `BOM child [${childPart.partNumber}]`,
            before: "not in BOM",
            after: `qty ${qty}`,
          },
        ],
      });
      // Update child's parentAssemblies reciprocal
      if (!childPart.parentAssemblies.find((a) => a.assemblyPartId === parentPartId)) {
        childPart.parentAssemblies.push({
          assemblyPartId: parentPartId,
          partNumber: parent.partNumber,
          partName: parent.partName,
          quantityInParent: qty,
        });
        childPart.assembliesUsedInCount = childPart.parentAssemblies.length;
      }
    }

    setEditorMode({ type: "idle" });
    setTreeVersion((v) => v + 1);
  }

  function handleBulkRemove(parentPartId: number, childIds: number[]) {
    const parent = MOCK_PARTS.find((p) => p.partId === parentPartId);
    if (!parent) return;

    for (const childId of childIds) {
      const rel = parent.childParts.find((c) => c.childPartId === childId);
      if (!rel) continue;
      parent.auditLog.unshift({
        timestamp: new Date().toISOString(),
        userName: "Marcus Hill",
        action: "BomChildRemoved",
        changedFields: [
          {
            field: `BOM child [${rel.childPartNumber}]`,
            before: `qty ${rel.quantity}`,
            after: "removed",
          },
        ],
      });
      // Reciprocal update
      const child = MOCK_PARTS.find((p) => p.partId === childId);
      if (child) {
        child.parentAssemblies = child.parentAssemblies.filter(
          (a) => a.assemblyPartId !== parentPartId
        );
        child.assembliesUsedInCount = child.parentAssemblies.length;
      }
    }

    parent.childParts = parent.childParts.filter((c) => !childIds.includes(c.childPartId));

    setEditorMode({ type: "idle" });
    setTreeVersion((v) => v + 1);
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
  const hasChildren = rootNode ? rootNode.children.length > 0 : false;

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
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

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {/* Column headers */}
          <div className="sticky top-0 z-10 flex items-center border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
            <div className="w-[424px] shrink-0 px-2 py-2 pl-8">Component</div>
            <div className="flex shrink-0 items-center">
              <div className="w-16 px-2 py-2 text-right">Qty</div>
              <div className="w-20 px-2 py-2 text-right">Stock</div>
              <div className="w-20 px-2 py-2 text-right">Buildable</div>
              <div className="w-24 px-2 py-2 text-right">Cost</div>
              <div className="w-8 py-2" />
              <div className="w-24 px-2 py-2 text-left">Location</div>
              <div className="w-8 py-2" />
            </div>
          </div>

          {!hasChildren ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {assembly.partName} has no components.
            </div>
          ) : rootNode ? (
            <BomTreeRow
              key={rootNode.part.partId}
              node={rootNode}
              depth={0}
              forceExpanded={expandState}
              onOpenPartSheet={setSheetPart}
              isRoot={true}
              initialExpanded={true}
              onQtyChange={handleQtyChange}
              onChildRemove={handleChildRemove}
              editorMode={editorMode}
              onStartAdd={handleStartAdd}
              onStartRemove={handleStartRemove}
              onCancelEdit={handleCancelEdit}
              onCommitAdd={handleCommitAdd}
              onBulkRemove={handleBulkRemove}
              onToggleRemoveChild={handleToggleRemoveChild}
            />
          ) : null}
        </div>

        {/* Part Form Sheet panel */}
        {sheetPart && (
          <div className="flex w-1/3 shrink-0 flex-col border-l border-border">
            <div className="shrink-0 border-b border-border px-4 py-2">
              <a
                href="/mockups/parts"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Open in Parts Master
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
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
