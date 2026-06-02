"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { MOCK_PARTS, MockPart } from "@/app/mockups/parts/_data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  wouldCreateCycle,
  findCycleChain,
  computeAddDepth,
  partMatchesQuery,
  DEPTH_SOFT,
  DEPTH_HARD,
} from "../_lib/validation";
import CycleErrorDialog from "./cycle-error-dialog";
import DepthWarningDialog from "./depth-warning-dialog";
import DepthBlockDialog from "./depth-block-dialog";

const INDENT = 24;

type Props = {
  parentPartId: number;
  parentPartNumber: string;
  depth: number; // depth of parent — child row indented at depth+1
  onCommit: (childPartId: number, qty: number) => void;
  onCancel: () => void;
};

type ValidationDialog =
  | { kind: "none" }
  | { kind: "cycle"; chain: number[] }
  | { kind: "depthWarn"; depth: number; childPartNumber: string }
  | { kind: "depthBlock"; depth: number };

export default function AddChildInputRow({
  parentPartId,
  parentPartNumber,
  depth,
  onCommit,
  onCancel,
}: Props) {
  const [comboOpen, setComboOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPart, setSelectedPart] = useState<MockPart | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [dialog, setDialog] = useState<ValidationDialog>({ kind: "none" });

  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dialog.kind === "none" && !comboOpen) {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog.kind, comboOpen, onCancel]);

  const indentPx = (depth + 1) * INDENT;

  const parsedQty = parseInt(qtyInput, 10);
  const qtyValid = !isNaN(parsedQty) && parsedQty > 0 && String(parsedQty) === qtyInput.trim();
  const canSave = selectedPart !== null && qtyValid;

  // Filtered and ranked parts for the combobox
  const filteredParts = MOCK_PARTS.filter(
    (p) =>
      p.isActive &&
      p.partId !== parentPartId &&
      (query === "" || partMatchesQuery(p.partNumber, p.partName, query))
  ).slice(0, 50);

  function handleSelect(part: MockPart) {
    setSelectedPart(part);
    setQuery("");
    setComboOpen(false);
    qtyRef.current?.focus();
  }

  function attemptSave() {
    if (!canSave || !selectedPart) return;
    const qty = parsedQty;

    // Cycle check
    if (wouldCreateCycle(parentPartId, selectedPart.partId)) {
      const chain = findCycleChain(parentPartId, selectedPart.partId);
      setDialog({ kind: "cycle", chain: chain ?? [parentPartId, selectedPart.partId] });
      return;
    }

    // Depth check
    const totalDepth = computeAddDepth(parentPartId, selectedPart.partId);
    if (totalDepth > DEPTH_HARD) {
      setDialog({ kind: "depthBlock", depth: totalDepth });
      return;
    }
    if (totalDepth > DEPTH_SOFT) {
      setDialog({
        kind: "depthWarn",
        depth: totalDepth,
        childPartNumber: selectedPart.partNumber,
      });
      return;
    }

    onCommit(selectedPart.partId, qty);
  }

  function handleQtyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") attemptSave();
    if (e.key === "Escape") onCancel();
  }

  function proceedAfterWarning() {
    setDialog({ kind: "none" });
    if (selectedPart) onCommit(selectedPart.partId, parsedQty);
  }

  return (
    <>
      <div
        className="flex items-center border-b border-border/40 border-l-2 border-l-primary bg-primary/5"
        style={{ minHeight: 40 }}
      >
        {/* Indent to child level */}
        <div className="shrink-0" style={{ width: indentPx }} />

        {/* No chevron placeholder */}
        <div className="w-6 shrink-0" />

        {/* Part Number combobox */}
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex h-7 w-40 items-center justify-between rounded border border-input bg-background px-2 text-xs hover:bg-muted"
              aria-expanded={comboOpen}
            >
              <span className={selectedPart ? "font-mono" : "text-muted-foreground"}>
                {selectedPart ? selectedPart.partNumber : "Select part…"}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Search by part number or name…"
                className="h-8 text-xs"
              />
              <CommandList className="max-h-52">
                {filteredParts.length === 0 && (
                  <CommandEmpty className="py-4 text-xs text-muted-foreground">
                    No parts found
                  </CommandEmpty>
                )}
                {filteredParts.map((part) => {
                  const cycles = wouldCreateCycle(parentPartId, part.partId);
                  return (
                    <CommandItem
                      key={part.partId}
                      value={String(part.partId)}
                      disabled={cycles}
                      onSelect={() => !cycles && handleSelect(part)}
                      className="flex items-center gap-2 py-1.5 text-xs"
                    >
                      <Check
                        className={`h-3 w-3 shrink-0 ${selectedPart?.partId === part.partId ? "opacity-100" : "opacity-0"}`}
                      />
                      <span className="font-mono shrink-0">{part.partNumber}</span>
                      <span className="flex-1 truncate text-muted-foreground">{part.partName}</span>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-[10px] ${part.partType === "Assembly" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : ""}`}
                      >
                        {part.partType}
                      </Badge>
                      {cycles && (
                        <span className="shrink-0 text-[10px] text-destructive">cycle</span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Part Name display */}
        <span className="ml-2 w-36 truncate text-xs text-muted-foreground">
          {selectedPart?.partName ?? ""}
        </span>

        {/* Qty input */}
        <Input
          ref={qtyRef}
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
          onKeyDown={handleQtyKeyDown}
          placeholder="Qty"
          className="ml-2 h-7 w-16 px-2 text-right text-xs"
          type="number"
          min={1}
          step={1}
        />

        {/* Save */}
        <Button
          size="sm"
          className="ml-2 h-7 px-3 text-xs"
          disabled={!canSave}
          onClick={attemptSave}
        >
          Save
        </Button>

        {/* Cancel */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-7 px-2 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>

      {/* Validation dialogs */}
      <CycleErrorDialog
        open={dialog.kind === "cycle"}
        chain={dialog.kind === "cycle" ? dialog.chain : []}
        onClose={() => setDialog({ kind: "none" })}
      />

      <DepthWarningDialog
        open={dialog.kind === "depthWarn"}
        depth={dialog.kind === "depthWarn" ? dialog.depth : 0}
        parentPartNumber={parentPartNumber}
        childPartNumber={dialog.kind === "depthWarn" ? dialog.childPartNumber : ""}
        onCancel={() => setDialog({ kind: "none" })}
        onContinue={proceedAfterWarning}
      />

      <DepthBlockDialog
        open={dialog.kind === "depthBlock"}
        depth={dialog.kind === "depthBlock" ? dialog.depth : 0}
        onClose={() => setDialog({ kind: "none" })}
      />
    </>
  );
}
