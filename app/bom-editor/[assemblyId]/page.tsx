"use client";

import { use, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBomTree } from "@/lib/api/bom";
import { usePart } from "@/lib/api/parts";
import { BomEditorChrome } from "../_components/bom-editor-chrome";
import { AssemblyIdentityBand } from "../_components/assembly-identity-band";
import { ControlsBar } from "../_components/controls-bar";
import { BomTree } from "../_components/bom-tree";
import PartFormSheet, { SECTION_IDS } from "@/app/parts/_components/part-form-sheet";
import type { EditMode } from "../_components/bom-tree-row";

interface BomEditorAssemblyPageProps {
  params: Promise<{ assemblyId: string }>;
}

// Wrapper that fetches the part and renders the Sheet.
function PartSheetPanel({
  partId,
  onClose,
  onNavigateToPart,
  onUpdate,
}: {
  partId: number;
  onClose: () => void;
  onNavigateToPart: (id: number) => void;
  onUpdate: () => void;
}) {
  const { data: part, isLoading } = usePart(partId);

  if (isLoading || !part) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <PartFormSheet
      mode="edit"
      part={part}
      initialSection={SECTION_IDS.parents}
      onClose={onClose}
      onUpdate={onUpdate}
      onNavigateToPart={onNavigateToPart}
    />
  );
}

export default function BomEditorAssemblyPage({ params }: BomEditorAssemblyPageProps) {
  const { assemblyId: assemblyIdStr } = use(params);
  const assemblyId = parseInt(assemblyIdStr, 10);
  const { data: tree, isLoading, error } = useBomTree(isNaN(assemblyId) ? null : assemblyId);
  const [expandState, setExpandState] = useState<boolean | null>(null);
  const [editMode, setEditMode] = useState<EditMode>({ type: "idle" });
  const [sheetPartId, setSheetPartId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const handleOpenPartSheet = useCallback((partId: number) => {
    setSheetPartId(partId);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetPartId(null);
  }, []);

  const handleSheetNavigate = useCallback((partId: number) => {
    setSheetPartId(partId);
  }, []);

  const handleSheetUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bom", "tree", assemblyId] });
  }, [queryClient, assemblyId]);

  if (isNaN(assemblyId)) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <BomEditorChrome />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Invalid assembly ID
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <BomEditorChrome selectedAssemblyId={assemblyId} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <BomEditorChrome selectedAssemblyId={assemblyId} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Assembly not found
        </div>
      </div>
    );
  }

  const directChildCount = tree.children?.length ?? 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      <BomEditorChrome selectedAssemblyId={assemblyId} />
      <AssemblyIdentityBand
        partId={tree.partId}
        partNumber={tree.partNumber}
        partName={tree.partName}
        directChildCount={directChildCount}
      />
      <ControlsBar
        onExpandAll={() => setExpandState(true)}
        onCollapseAll={() => setExpandState(false)}
        expandState={expandState}
        onSelfManage={() => setExpandState(null)}
      />

      {/* Push-tree layout: tree + Sheet side by side */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          <BomTree
            root={tree}
            expandState={expandState}
            editMode={editMode}
            setEditMode={setEditMode}
            onOpenPartSheet={handleOpenPartSheet}
          />
        </div>

        {sheetPartId !== null && (
          <div className="w-[400px] shrink-0 border-l border-border flex flex-col overflow-hidden bg-background">
            <PartSheetPanel
              key={sheetPartId}
              partId={sheetPartId}
              onClose={handleCloseSheet}
              onNavigateToPart={handleSheetNavigate}
              onUpdate={handleSheetUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
