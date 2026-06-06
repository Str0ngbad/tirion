"use client";

import { useState } from "react";
import { useBomTree } from "@/lib/api/bom";
import { BomEditorChrome } from "../_components/bom-editor-chrome";
import { AssemblyIdentityBand } from "../_components/assembly-identity-band";
import { ControlsBar } from "../_components/controls-bar";

interface BomEditorAssemblyPageProps {
  params: { assemblyId: string };
}

export default function BomEditorAssemblyPage({ params }: BomEditorAssemblyPageProps) {
  const assemblyId = parseInt(params.assemblyId, 10);
  const { data: tree, isLoading, error } = useBomTree(isNaN(assemblyId) ? null : assemblyId);
  const [, setExpandState] = useState<boolean | null>(null);

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
      />

      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {directChildCount === 0
          ? `${tree.partName} has no components`
          : "Tree visualization coming in next commit"}
      </div>
    </div>
  );
}
