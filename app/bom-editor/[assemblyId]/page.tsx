"use client";

import { use, useState } from "react";
import { useBomTree } from "@/lib/api/bom";
import { BomEditorChrome } from "../_components/bom-editor-chrome";
import { AssemblyIdentityBand } from "../_components/assembly-identity-band";
import { ControlsBar } from "../_components/controls-bar";
import { BomTree } from "../_components/bom-tree";

interface BomEditorAssemblyPageProps {
  params: Promise<{ assemblyId: string }>;
}

export default function BomEditorAssemblyPage({ params }: BomEditorAssemblyPageProps) {
  const { assemblyId: assemblyIdStr } = use(params);
  const assemblyId = parseInt(assemblyIdStr, 10);
  const { data: tree, isLoading, error } = useBomTree(isNaN(assemblyId) ? null : assemblyId);
  const [expandState, setExpandState] = useState<boolean | null>(null);

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

      {directChildCount === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {tree.partName} has no components.
        </div>
      ) : (
        <BomTree root={tree} expandState={expandState} />
      )}
    </div>
  );
}
