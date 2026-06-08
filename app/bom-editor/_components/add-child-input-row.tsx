"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAddBomChild } from "@/lib/api/bom";
import { useAllActiveParts, type AllActivePartOption } from "@/lib/api/parts";
import {
  wouldCreateCycle,
  findCycleChain,
  computeAddDepth,
  partMatchesQuery,
  rankPartMatch,
  DEPTH_SOFT,
  DEPTH_HARD,
} from "@/lib/bom/client-validation";
import { CycleErrorDialog } from "./cycle-error-dialog";
import { DepthWarningDialog } from "./depth-warning-dialog";
import { DepthBlockDialog } from "./depth-block-dialog";
import type { BomNode } from "@/lib/bom/types";

const INDENT = 24;

type ValidationDialog =
  | { kind: "none" }
  | { kind: "cycle"; chain: number[]; fromIcon?: boolean }
  | { kind: "depthWarn"; depth: number }
  | { kind: "depthBlock"; depth: number };

interface AddChildInputRowProps {
  parentPartId: number;
  parentPartNumber: string;
  depth: number;
  rootTree: BomNode;
  existingChildren: BomNode[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddChildInputRow({
  parentPartId,
  parentPartNumber,
  depth,
  rootTree,
  existingChildren,
  onSuccess,
  onCancel,
}: AddChildInputRowProps) {
  const [comboOpen, setComboOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPart, setSelectedPart] = useState<AllActivePartOption | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [dialog, setDialog] = useState<ValidationDialog>({ kind: "none" });
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const qtyRef = useRef<HTMLInputElement>(null);
  const addMutation = useAddBomChild();
  const { data: allParts = [] } = useAllActiveParts();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dialog.kind === "none" && !comboOpen) {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog.kind, comboOpen, onCancel]);

  const parsedQty = parseInt(qtyInput, 10);
  const qtyValid = !isNaN(parsedQty) && parsedQty > 0 && String(parsedQty) === qtyInput.trim();
  const canSave = selectedPart !== null && qtyValid && !duplicateError;

  const rankedParts = useMemo(() => {
    const candidates = allParts.filter(
      (p) => p.partId !== parentPartId && (query === "" || partMatchesQuery(p.partNumber, p.partName, query))
    );
    if (!query) return candidates.slice(0, 50);
    return candidates
      .map((p) => ({ part: p, rank: rankPartMatch(p.partNumber, p.partName, query) }))
      .sort((a, b) => a.rank - b.rank || a.part.partNumber.localeCompare(b.part.partNumber))
      .map((x) => x.part)
      .slice(0, 50);
  }, [allParts, query, parentPartId]);

  function handleSelect(part: AllActivePartOption) {
    setSelectedPart(part);
    setQuery("");
    setDuplicateError(null);
    setComboOpen(false);
    qtyRef.current?.focus();

    const existing = existingChildren.find((c) => c.partId === part.partId);
    if (existing) {
      setDuplicateError(
        `${part.partNumber} is already in this BOM with quantity ${existing.quantity ?? 0}. Edit the existing quantity instead.`
      );
    }
  }

  function commitToServer(childPartId: number, qty: number) {
    addMutation.mutate(
      { parentPartId, childPartId, quantity: qty },
      {
        onSuccess: () => onSuccess(),
        onError: (err) => {
          if (err.errorCode === "BOM_CYCLE") {
            const chain = (err.details?.cycleChain as number[] | undefined) ?? [];
            setDialog({ kind: "cycle", chain });
          } else if (err.errorCode === "BOM_DEPTH_EXCEEDED") {
            const depth = (err.details?.computedDepth as number | undefined) ?? DEPTH_HARD + 1;
            setDialog({ kind: "depthBlock", depth });
          } else if (err.errorCode === "BOM_DUPLICATE_CHILD") {
            setDuplicateError(
              `${selectedPart?.partNumber ?? "This part"} is already in this BOM. Edit the existing quantity instead.`
            );
          } else {
            toast.error("Failed to add child part");
          }
        },
      }
    );
  }

  function attemptSave() {
    if (!canSave || !selectedPart) return;
    const qty = parsedQty;

    if (duplicateError) return;

    if (wouldCreateCycle(parentPartId, selectedPart.partId, rootTree)) {
      const chain = findCycleChain(parentPartId, selectedPart.partId, rootTree) ?? [
        parentPartId,
        selectedPart.partId,
      ];
      setDialog({ kind: "cycle", chain });
      return;
    }

    const totalDepth = computeAddDepth(parentPartId, selectedPart.partId, rootTree);
    if (totalDepth > DEPTH_HARD) {
      setDialog({ kind: "depthBlock", depth: totalDepth });
      return;
    }
    if (totalDepth > DEPTH_SOFT) {
      setDialog({ kind: "depthWarn", depth: totalDepth });
      return;
    }

    commitToServer(selectedPart.partId, qty);
  }

  function proceedAfterWarning() {
    setDialog({ kind: "none" });
    if (selectedPart) commitToServer(selectedPart.partId, parsedQty);
  }

  const indentPx = (depth + 1) * INDENT;

  return (
    <>
      <div className="flex flex-col border-b border-border/40 border-l-2 border-l-primary bg-primary/5">
        <div className="flex items-center" style={{ minHeight: 40 }}>
          <div className="shrink-0" style={{ width: indentPx }} />
          <div className="w-6 shrink-0" />

          {/* Part combobox */}
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
                  {rankedParts.length === 0 && (
                    <CommandEmpty className="py-4 text-xs text-muted-foreground">
                      No parts found
                    </CommandEmpty>
                  )}
                  {rankedParts.map((part) => {
                    const cycles = wouldCreateCycle(parentPartId, part.partId, rootTree);
                    return (
                      <CommandItem
                        key={part.partId}
                        value={String(part.partId)}
                        disabled={cycles}
                        onSelect={() => !cycles && handleSelect(part)}
                        className={`flex items-center gap-2 py-1.5 text-xs ${cycles ? "cursor-not-allowed opacity-50" : ""}`}
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
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="shrink-0 cursor-pointer text-destructive pointer-events-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const chain = findCycleChain(parentPartId, part.partId, rootTree) ?? [
                                      parentPartId,
                                      part.partId,
                                    ];
                                    setDialog({ kind: "cycle", chain, fromIcon: true });
                                    setComboOpen(false);
                                  }}
                                >
                                  <AlertCircle className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" sideOffset={5}>
                                Cycle detected — click for details
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Part name */}
          <span className="ml-2 w-36 truncate text-xs text-muted-foreground">
            {selectedPart?.partName ?? ""}
          </span>

          {/* Qty */}
          <Input
            ref={qtyRef}
            value={qtyInput}
            onChange={(e) => { setQtyInput(e.target.value); setDuplicateError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) attemptSave();
              if (e.key === "Escape") onCancel();
            }}
            placeholder="Qty"
            className="ml-2 h-7 w-16 px-2 text-right text-xs"
            type="number"
            min={1}
            step={1}
          />

          <Button
            size="sm"
            className="ml-2 h-7 px-3 text-xs"
            disabled={!canSave || addMutation.isPending}
            onClick={attemptSave}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-7 px-2 text-xs"
            onClick={onCancel}
            disabled={addMutation.isPending}
          >
            Cancel
          </Button>
        </div>

        {duplicateError && (
          <div className="px-3 pb-2 text-xs text-destructive">{duplicateError}</div>
        )}
      </div>

      <CycleErrorDialog
        open={dialog.kind === "cycle"}
        chain={dialog.kind === "cycle" ? dialog.chain : []}
        allParts={allParts}
        onClose={() => setDialog({ kind: "none" })}
        buttonLabel={dialog.kind === "cycle" && dialog.fromIcon ? "OK" : "Cancel"}
      />

      <DepthWarningDialog
        open={dialog.kind === "depthWarn"}
        depth={dialog.kind === "depthWarn" ? dialog.depth : 0}
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
