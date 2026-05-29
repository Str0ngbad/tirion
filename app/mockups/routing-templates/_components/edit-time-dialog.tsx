"use client";

import { useState } from "react";
import { MockTemplate } from "../_data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import EditTimePartsView from "./edit-time-parts-view";
import EditTimeWosView from "./edit-time-wos-view";
import EditTimeStockView from "./edit-time-stock-view";

type ActiveView = "parts" | "wos" | "stock" | null;

type DialogMode = "edit" | "retire";

type Props = {
  template: MockTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
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

export default function EditTimeDialog({ template, open, onOpenChange, mode, onConfirm }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setActiveView(null);
    onOpenChange(next);
  }

  function toggleView(view: ActiveView) {
    setActiveView((prev) => (prev === view ? null : view));
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          {mode === "edit" ? (
            <>
              <DialogTitle>This change has downstream impact</DialogTitle>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{template.templateName}</span> is being
                edited. Review the affected work before proceeding.
              </p>
            </>
          ) : (
            <>
              <DialogTitle>Retire this template?</DialogTitle>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{template.templateName}</span> will no
                longer be available for new Parts. Existing Work Orders are unaffected. Parts
                referencing this template must be reassigned before new Work Orders can be compiled.
              </p>
            </>
          )}
        </DialogHeader>

        {/* Count card bar */}
        <div className="flex gap-3">
          <CountCard
            count={template.partsReferencingCount}
            label="Parts use this template"
            isActive={activeView === "parts"}
            onClick={() => toggleView("parts")}
          />
          <CountCard
            count={template.openWoCount}
            label="Open Work Orders will be flagged for review"
            isActive={activeView === "wos"}
            onClick={() => toggleView("wos")}
          />
          <CountCard
            count={template.affectedStockCount}
            label="Units of stock to review for conformity"
            isActive={activeView === "stock"}
            onClick={() => toggleView("stock")}
          />
        </div>

        {/* Expandable view */}
        {activeView !== null && (
          <ScrollArea className="max-h-[45vh] rounded-md border border-border px-4 py-2">
            {activeView === "parts" && (
              <EditTimePartsView parts={template.referencingParts} />
            )}
            {activeView === "wos" && (
              <EditTimeWosView wos={template.affectedWos} />
            )}
            {activeView === "stock" && (
              <EditTimeStockView parts={template.referencingParts} />
            )}
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {mode === "edit" ? (
            <Button onClick={onConfirm}>Confirm Change</Button>
          ) : (
            <Button variant="destructive" onClick={onConfirm}>
              Retire Template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
