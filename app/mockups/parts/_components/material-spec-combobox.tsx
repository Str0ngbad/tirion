"use client";

import { useState, useMemo } from "react";
import { MockMinimalMaterialSpec } from "../_data";
import { levenshtein } from "../_lib/edit-distance";
import { Button } from "@/components/ui/button";
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

function specLabel(spec: MockMinimalMaterialSpec): string {
  return `${spec.materialName} — ${spec.form}`;
}

function matches(candidate: string, query: string): boolean {
  const c = candidate.toLowerCase();
  const q = query.toLowerCase();
  return c.includes(q) || levenshtein(c, q) <= 2;
}

type Props = {
  value: MockMinimalMaterialSpec | null;
  materialSpecs: MockMinimalMaterialSpec[];
  disabled?: boolean;
  onChange: (spec: MockMinimalMaterialSpec) => void;
  onAddNew: () => void;
};

export default function MaterialSpecCombobox({
  value,
  materialSpecs,
  disabled = false,
  onChange,
  onAddNew,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return materialSpecs;
    return materialSpecs.filter(
      (s) => matches(s.materialName, q) || matches(s.form, q)
    );
  }, [materialSpecs, search]);

  function handleSelect(spec: MockMinimalMaterialSpec) {
    onChange(spec);
    setSearch("");
    setOpen(false);
  }

  function handleAddNew() {
    setOpen(false);
    setSearch("");
    onAddNew();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-full justify-between text-sm font-normal"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value ? specLabel(value) : "Select material spec…"}
          </span>
          <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search material spec…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && (
              <CommandEmpty>No matches.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((spec) => (
                  <CommandItem
                    key={spec.materialSpecId}
                    value={String(spec.materialSpecId)}
                    onSelect={() => handleSelect(spec)}
                    data-checked={value?.materialSpecId === spec.materialSpecId}
                  >
                    {specLabel(spec)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__add_new__"
                onSelect={handleAddNew}
                className="text-muted-foreground"
              >
                Add new MaterialSpec…
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
