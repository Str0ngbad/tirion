"use client";

import { useState, useMemo, useEffect } from "react";
import { MockMaterialSpec, MockAuditEntry } from "../_data";
import { levenshtein } from "../_lib/edit-distance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ChevronsUpDownIcon } from "lucide-react";

type Props = {
  allSpecs: MockMaterialSpec[];
  maxSpecId: number;
  onClose: () => void;
  onCreate: (spec: MockMaterialSpec) => void;
};

function matchesCriteria(candidate: string, query: string): boolean {
  const c = candidate.toLowerCase();
  const q = query.toLowerCase();
  return c.includes(q) || levenshtein(c, q) <= 2;
}

export default function MaterialSpecCreateModal({
  allSpecs,
  maxSpecId,
  onClose,
  onCreate,
}: Props) {
  const [materialName, setMaterialName] = useState("");
  const [form, setForm] = useState("");
  const [materialNameOpen, setMaterialNameOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [materialNameSearch, setMaterialNameSearch] = useState("");
  const [formSearch, setFormSearch] = useState("");
  const [pairMatch, setPairMatch] = useState<MockMaterialSpec | null>(null);

  // Distinct active material names, sorted alphabetically
  const activeMaterialNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const s of allSpecs.filter((s) => s.isActive)) {
      if (!seen.has(s.materialName)) {
        seen.add(s.materialName);
        names.push(s.materialName);
      }
    }
    return names.sort((a, b) => a.localeCompare(b));
  }, [allSpecs]);

  // Distinct active forms, sorted alphabetically
  const activeForms = useMemo(() => {
    const seen = new Set<string>();
    const forms: string[] = [];
    for (const s of allSpecs.filter((s) => s.isActive)) {
      if (!seen.has(s.form)) {
        seen.add(s.form);
        forms.push(s.form);
      }
    }
    return forms.sort((a, b) => a.localeCompare(b));
  }, [allSpecs]);

  // Filtered material names: substring + edit-distance <= 2
  const filteredMaterialNames = useMemo(() => {
    const q = materialNameSearch.trim();
    if (!q) return activeMaterialNames;
    return activeMaterialNames.filter((name) => matchesCriteria(name, q));
  }, [activeMaterialNames, materialNameSearch]);

  // Filtered forms: same dual criteria
  const filteredForms = useMemo(() => {
    const q = formSearch.trim();
    if (!q) return activeForms;
    return activeForms.filter((f) => matchesCriteria(f, q));
  }, [activeForms, formSearch]);

  // "Add new" option: visible when search is non-empty and not an exact match
  const showAddMaterialName =
    materialNameSearch.trim() !== "" &&
    !activeMaterialNames.some(
      (n) => n.toLowerCase() === materialNameSearch.trim().toLowerCase()
    );

  const showAddForm =
    formSearch.trim() !== "" &&
    !activeForms.some(
      (f) => f.toLowerCase() === formSearch.trim().toLowerCase()
    );

  // Pair validation: check if (materialName, form) already exists
  useEffect(() => {
    if (!materialName || !form) {
      setPairMatch(null);
      return;
    }
    const existing = allSpecs.find(
      (s) =>
        s.materialName.toLowerCase() === materialName.toLowerCase() &&
        s.form.toLowerCase() === form.toLowerCase()
    );
    setPairMatch(existing ?? null);
  }, [materialName, form, allSpecs]);

  function handleSelectMaterialName(value: string) {
    setMaterialName(value);
    setMaterialNameSearch("");
    setMaterialNameOpen(false);
  }

  function handleSelectForm(value: string) {
    setForm(value);
    setFormSearch("");
    setFormOpen(false);
  }

  function handleSubmit() {
    if (pairMatch) {
      // In the real Part Form context, this returns the existing record's ID.
      // Here we log the selection and close.
      console.log("Selected existing MaterialSpec:", pairMatch.materialSpecId);
      onClose();
      return;
    }

    if (!materialName || !form) return;

    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: "Jane Chen",
      action: "MaterialSpecCreated",
    };

    const newSpec: MockMaterialSpec = {
      materialSpecId: maxSpecId + 1,
      materialName,
      form,
      isActive: true,
      usedByCount: 0,
      openSupplyOrderCount: 0,
      activeWoCount: 0,
      awaitingReceiptWoCount: 0,
      awaitingPurchaseWoCount: 0,
      referencingParts: [],
      auditLog: [entry],
    };

    onCreate(newSpec);
  }

  const canSubmit = materialName !== "" && form !== "";
  const buttonLabel = pairMatch ? "Use Existing MaterialSpec" : "Create MaterialSpec";

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Add New MaterialSpec</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Material Name combobox */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Material Name
            </Label>
            <Popover
              open={materialNameOpen}
              onOpenChange={(open) => {
                setMaterialNameOpen(open);
                if (!open) setMaterialNameSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={materialNameOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={materialName ? "text-foreground" : "text-muted-foreground"}>
                    {materialName || "Select or add material…"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search material name…"
                    value={materialNameSearch}
                    onValueChange={setMaterialNameSearch}
                  />
                  <CommandList>
                    {filteredMaterialNames.length === 0 && !showAddMaterialName && (
                      <CommandEmpty>No matches.</CommandEmpty>
                    )}
                    {filteredMaterialNames.length > 0 && (
                      <CommandGroup>
                        {filteredMaterialNames.map((name) => (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => handleSelectMaterialName(name)}
                            data-checked={materialName === name}
                          >
                            {name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {showAddMaterialName && (
                      <>
                        {filteredMaterialNames.length > 0 && <CommandSeparator />}
                        <CommandGroup>
                          <CommandItem
                            value={`__new__:${materialNameSearch}`}
                            onSelect={() =>
                              handleSelectMaterialName(materialNameSearch.trim())
                            }
                          >
                            <span className="text-muted-foreground">Add new material:</span>
                            &nbsp;&ldquo;{materialNameSearch.trim()}&rdquo;
                          </CommandItem>
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Form combobox */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Form
            </Label>
            <Popover
              open={formOpen}
              onOpenChange={(open) => {
                setFormOpen(open);
                if (!open) setFormSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={formOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={form ? "text-foreground" : "text-muted-foreground"}>
                    {form || "Select or add form…"}
                  </span>
                  <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search form…"
                    value={formSearch}
                    onValueChange={setFormSearch}
                  />
                  <CommandList>
                    {filteredForms.length === 0 && !showAddForm && (
                      <CommandEmpty>No matches.</CommandEmpty>
                    )}
                    {filteredForms.length > 0 && (
                      <CommandGroup>
                        {filteredForms.map((f) => (
                          <CommandItem
                            key={f}
                            value={f}
                            onSelect={() => handleSelectForm(f)}
                            data-checked={form === f}
                          >
                            {f}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {showAddForm && (
                      <>
                        {filteredForms.length > 0 && <CommandSeparator />}
                        <CommandGroup>
                          <CommandItem
                            value={`__new__:${formSearch}`}
                            onSelect={() => handleSelectForm(formSearch.trim())}
                          >
                            <span className="text-muted-foreground">Add new form:</span>
                            &nbsp;&ldquo;{formSearch.trim()}&rdquo;
                          </CommandItem>
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Pair match banner */}
          {pairMatch && (
            <div className="rounded-md border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-sm text-blue-300">
              <strong className="font-medium">
                This pair already exists as MaterialSpec {pairMatch.materialSpecId}.
              </strong>{" "}
              It&apos;s currently used by {pairMatch.usedByCount}{" "}
              {pairMatch.usedByCount === 1 ? "part" : "parts"}.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
