"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type RoutingTemplateDetail } from "@/lib/routing-templates/types";

type PanelKey = "parts" | "wos" | "stock" | null;

interface EditTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "retire";
  template: RoutingTemplateDetail;
  onConfirm: () => void;
}

function CountCard({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col gap-1 rounded-md border px-4 py-3 text-left transition-colors hover:bg-accent ${
        active ? "border-primary bg-accent" : "border-border"
      }`}
    >
      <span className="text-2xl font-semibold tabular-nums">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

export function EditTimeDialog({
  open,
  onOpenChange,
  mode,
  template,
  onConfirm,
}: EditTimeDialogProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>(null);

  function togglePanel(key: Exclude<PanelKey, null>) {
    setActivePanel((prev) => (prev === key ? null : key));
  }

  const partsForStock = template.referencingParts
    .filter((p) => p.stockCount > 0)
    .sort((a, b) => b.stockCount - a.stockCount);

  const affectedWos = (template as unknown as { affectedWos?: unknown[] }).affectedWos ?? [];

  const title = mode === "edit" ? "This change has downstream impact" : "Retire this template?";
  const subtitle =
    mode === "edit"
      ? `${template.templateName} is being edited. Review the affected work before proceeding.`
      : `${template.templateName} will no longer be available for new Parts. Existing Work Orders are unaffected. Parts referencing this template must be reassigned before new Work Orders can be compiled.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {/* Count cards */}
        <div className="flex gap-3">
          <CountCard
            label="Parts use this template"
            count={template.partsReferencingCount}
            active={activePanel === "parts"}
            onClick={() => togglePanel("parts")}
          />
          <CountCard
            label="Open Work Orders will be flagged for review"
            count={template.openWorkOrderCount}
            active={activePanel === "wos"}
            onClick={() => togglePanel("wos")}
          />
          <CountCard
            label="Units of stock to review for conformity"
            count={template.affectedStockCount}
            active={activePanel === "stock"}
            onClick={() => togglePanel("stock")}
          />
        </div>

        {/* Detail panels */}
        {activePanel === "parts" && (
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Part Number
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Part Name
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Stock On Hand
                  </th>
                </tr>
              </thead>
              <tbody>
                {template.referencingParts.map((p) => (
                  <tr key={p.partId} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{p.partNumber}</td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs">{p.partName}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {p.stockCount === 0 ? (
                        <span className="text-muted-foreground/40">—</span>
                      ) : (
                        p.stockCount
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activePanel === "wos" && (
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            {affectedWos.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No entries</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {affectedWos.map((wo, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-xs">{JSON.stringify(wo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activePanel === "stock" && (
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Part Number
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Part Name
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Stock On Hand
                  </th>
                </tr>
              </thead>
              <tbody>
                {partsForStock.map((p) => (
                  <tr key={p.partId} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{p.partNumber}</td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs">{p.partName}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{p.stockCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Existing stock may not conform to the updated template. Review and reconcile as needed.
            </p>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
