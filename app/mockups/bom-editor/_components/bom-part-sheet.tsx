"use client";

import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { MockPart } from "@/app/mockups/parts/_data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  part: MockPart | null;
  onClose: () => void;
  onNavigateAssembly: (partId: number) => void;
};

export default function BomPartSheet({ part, onClose, onNavigateAssembly }: Props) {
  useEffect(() => {
    if (!part) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [part, onClose]);

  if (!part) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-card shadow-xl border-l border-border">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{part.partNumber}</span>
              <Badge variant="secondary" className="text-xs">
                {part.partType}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">{part.partName}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">
          {/* Description */}
          {part.description && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
              <p className="text-foreground leading-snug">{part.description}</p>
            </div>
          )}

          {/* Material */}
          {part.materialSpec && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Material</div>
              <span className="text-foreground">
                {part.materialSpec.materialName} — {part.materialSpec.form}
                {part.stockSize ? ` (${part.stockSize})` : ""}
              </span>
            </div>
          )}

          {/* Inventory */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Inventory</div>
            <div className="flex gap-6">
              <div>
                <div className="text-[10px] text-muted-foreground">Stock</div>
                <div className="font-medium">{part.stockCount ?? "—"}</div>
              </div>
              {part.inventoryLocation && (
                <div>
                  <div className="text-[10px] text-muted-foreground">Location</div>
                  <div className="font-medium">{part.inventoryLocation}</div>
                </div>
              )}
            </div>
          </div>

          {/* Parent assemblies */}
          {part.parentAssemblies.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Used In ({part.parentAssemblies.length})
              </div>
              <div className="space-y-1">
                {part.parentAssemblies.map((pa) => (
                  <button
                    key={pa.assemblyPartId}
                    onClick={() => {
                      onClose();
                      onNavigateAssembly(pa.assemblyPartId);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted transition-colors"
                  >
                    <span className="font-mono text-xs text-primary">{pa.partNumber}</span>
                    <span className="flex-1 truncate text-xs text-foreground">{pa.partName}</span>
                    <span className="text-[10px] text-muted-foreground">×{pa.quantityInParent}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <a
            href="/mockups/parts"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Open in Parts Master
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </>
  );
}
