"use client";

import { useState } from "react";
import { MockPart } from "../_data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import DefinitionChangeFlagParentsView from "./definition-change-flag-parents-view";
import DefinitionChangeFlagWosView from "./definition-change-flag-wos-view";
import DefinitionChangeFlagStockView from "./definition-change-flag-stock-view";

type ActiveView = "parents" | "wos" | "stock" | null;

type Props = {
  part: MockPart;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

type CountCardProps = {
  count: number;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function CountCard({ count, label, isActive, onClick }: CountCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-1 flex-col items-center rounded-lg border px-4 py-3 text-center transition-all",
        "hover:shadow-sm hover:border-primary/40 hover:bg-accent/50",
        isActive
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card",
      ].join(" ")}
    >
      <span className={`text-2xl font-bold tabular-nums ${isActive ? "text-primary" : "text-foreground"}`}>
        {count}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground leading-snug">{label}</span>
    </button>
  );
}

export default function DefinitionChangeFlagDialog({ part, open, onOpenChange, onConfirm }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setActiveView(null);
    onOpenChange(next);
  }

  function toggleView(view: ActiveView) {
    setActiveView((prev) => (prev === view ? null : view));
  }

  function handleConfirm() {
    setActiveView(null);
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Definition change has downstream impact</DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {part.partNumber} — {part.partName}
            </span>{" "}
            is being edited. Review the affected work before saving.
          </p>
        </DialogHeader>

        {/* Count card bar */}
        <div className="flex gap-3">
          <CountCard
            count={part.parentAssemblies.length}
            label="Assemblies reference this part."
            isActive={activeView === "parents"}
            onClick={() => toggleView("parents")}
          />
          <CountCard
            count={part.openWos.length}
            label="Open Work Orders for this part will be flagged for review."
            isActive={activeView === "wos"}
            onClick={() => toggleView("wos")}
          />
          <CountCard
            count={part.stockCount}
            label="Units of stock to review for conformity."
            isActive={activeView === "stock"}
            onClick={() => toggleView("stock")}
          />
        </div>

        {/* Expandable view */}
        {activeView !== null && (
          <ScrollArea className="max-h-[45vh] rounded-md border border-border px-4 py-2">
            {activeView === "parents" && (
              <DefinitionChangeFlagParentsView parents={part.parentAssemblies} />
            )}
            {activeView === "wos" && (
              <DefinitionChangeFlagWosView wos={part.openWos} />
            )}
            {activeView === "stock" && (
              <DefinitionChangeFlagStockView
                partName={part.partName}
                stockCount={part.stockCount}
              />
            )}
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Change</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
