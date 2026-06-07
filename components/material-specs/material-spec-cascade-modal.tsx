"use client";

import { useState, useMemo, useEffect } from "react";
import { matchesCriteria } from "@/lib/utils/edit-distance";
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
import type { MaterialSpecRow } from "@/lib/api/material-specs";

type CreateMode = {
  mode: "create";
  open: boolean;
  existingSpecs: MaterialSpecRow[];
  onClose: () => void;
  onCreate: (spec: MaterialSpecRow) => void;
};

type EditMode = {
  mode: "edit";
  open: boolean;
  existingSpecs: MaterialSpecRow[];
  currentSpec: MaterialSpecRow;
  onClose: () => void;
  onUpdate: (spec: MaterialSpecRow) => void;
};

type Props = CreateMode | EditMode;

export function MaterialSpecCascadeModal(props: Props) {
  const { open, onClose, existingSpecs } = props;
  const isEdit = props.mode === "edit";
  const currentSpec = isEdit ? props.currentSpec : null;

  const [materialName, setMaterialName] = useState(currentSpec?.materialName ?? "");
  const [form, setForm] = useState(currentSpec?.form ?? "");
  const [materialNameOpen, setMaterialNameOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [materialNameSearch, setMaterialNameSearch] = useState("");
  const [formSearch, setFormSearch] = useState("");
  const [isPending, setIsPending] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setMaterialName(currentSpec?.materialName ?? "");
      setForm(currentSpec?.form ?? "");
      setMaterialNameSearch("");
      setFormSearch("");
    }
  }, [open, currentSpec?.materialName, currentSpec?.form]);

  const distinctMaterialNames = useMemo(() => {
    const seen = new Set<string>();
    for (const s of existingSpecs) seen.add(s.materialName);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [existingSpecs]);

  const distinctForms = useMemo(() => {
    const seen = new Set<string>();
    for (const s of existingSpecs) seen.add(s.form);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [existingSpecs]);

  const filteredMaterialNames = useMemo(() => {
    const q = materialNameSearch.trim();
    if (!q) return distinctMaterialNames;
    return distinctMaterialNames.filter((n) => matchesCriteria(n, q));
  }, [distinctMaterialNames, materialNameSearch]);

  const filteredForms = useMemo(() => {
    const q = formSearch.trim();
    if (!q) return distinctForms;
    return distinctForms.filter((f) => matchesCriteria(f, q));
  }, [distinctForms, formSearch]);

  const showAddMaterialName =
    materialNameSearch.trim() !== "" &&
    !distinctMaterialNames.some(
      (n) => n.toLowerCase() === materialNameSearch.trim().toLowerCase()
    );

  const showAddForm =
    formSearch.trim() !== "" &&
    !distinctForms.some(
      (f) => f.toLowerCase() === formSearch.trim().toLowerCase()
    );

  // Find if the selected pair already exists as a different spec
  const pairMatch = useMemo(() => {
    if (!materialName || !form) return null;
    return (
      existingSpecs.find(
        (s) =>
          s.materialName.toLowerCase() === materialName.toLowerCase() &&
          s.form.toLowerCase() === form.toLowerCase()
      ) ?? null
    );
  }, [materialName, form, existingSpecs]);

  const pairMatchesCurrent =
    isEdit && pairMatch?.materialSpecId === currentSpec?.materialSpecId;
  const pairMatchesDifferent = pairMatch !== null && !pairMatchesCurrent;

  const canSubmit = materialName !== "" && form !== "" && !pairMatchesDifferent;

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

  async function handleSubmit() {
    if (!canSubmit || isPending) return;
    setIsPending(true);
    try {
      if (isEdit) {
        // If unchanged, just close
        if (
          materialName === currentSpec!.materialName &&
          form === currentSpec!.form
        ) {
          onClose();
          return;
        }
        (props as EditMode).onUpdate({ ...currentSpec!, materialName, form });
      } else {
        if (pairMatch) {
          (props as CreateMode).onCreate(pairMatch);
        } else {
          (props as CreateMode).onCreate({
            materialSpecId: 0, // caller replaces with real value after API call
            materialName,
            form,
            isActive: true,
            usedByCount: 0,
          });
        }
      }
    } finally {
      setIsPending(false);
    }
  }

  let buttonLabel: string;
  if (isEdit) {
    buttonLabel = isPending ? "Saving…" : "Update";
  } else if (pairMatch) {
    buttonLabel = "Use Existing MaterialSpec";
  } else {
    buttonLabel = isPending ? "Creating…" : "Create MaterialSpec";
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit MaterialSpec" : "Add MaterialSpec"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Material Name combobox */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Material Name
            </Label>
            <Popover
              open={materialNameOpen}
              onOpenChange={(o) => {
                setMaterialNameOpen(o);
                if (!o) setMaterialNameSearch("");
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
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                            onSelect={() => handleSelectMaterialName(materialNameSearch.trim())}
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
              onOpenChange={(o) => {
                setFormOpen(o);
                if (!o) setFormSearch("");
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
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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

          {/* Pair exists (create mode): use existing */}
          {!isEdit && pairMatch && (
            <div className="rounded-md border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-sm text-blue-300">
              This combination already exists. Click &ldquo;Use Existing
              MaterialSpec&rdquo; to select it.
            </div>
          )}

          {/* Pair matches a different spec (edit mode): block save */}
          {isEdit && pairMatchesDifferent && (
            <div className="rounded-md border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              This combination already exists as a different MaterialSpec.
              Change one of the values or close without saving.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
