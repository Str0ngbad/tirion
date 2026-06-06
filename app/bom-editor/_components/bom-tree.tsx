"use client";

import { useMemo } from "react";
import { BomTreeColumnHeader } from "./bom-tree-column-header";
import { BomTreeRow } from "./bom-tree-row";
import type { BomNode } from "@/lib/bom/types";

interface BomTreeProps {
  root: BomNode;
  expandState: boolean | null;
  onOpenPartSheet?: (partId: number) => void;
}

export function BomTree({ root, expandState, onOpenPartSheet }: BomTreeProps) {
  const now = useMemo(() => new Date(), []);

  return (
    <div className="flex-1 overflow-auto">
      <BomTreeColumnHeader />
      <BomTreeRow
        node={root}
        depth={0}
        forceExpanded={expandState}
        isRoot={true}
        now={now}
        onOpenPartSheet={onOpenPartSheet}
      />
    </div>
  );
}
