"use client";

import { useState, useMemo } from "react";
import { MockMinimalVendor } from "../_data";
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

function matches(candidate: string, query: string): boolean {
  const c = candidate.toLowerCase();
  const q = query.toLowerCase();
  return c.includes(q) || levenshtein(c, q) <= 2;
}

type Props = {
  value: MockMinimalVendor | null;
  vendors: MockMinimalVendor[];
  disabled?: boolean;
  onChange: (vendor: MockMinimalVendor) => void;
  onAddNew: () => void;
};

export default function VendorCombobox({
  value,
  vendors,
  disabled = false,
  onChange,
  onAddNew,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return vendors;
    return vendors.filter((v) => matches(v.vendorName, q));
  }, [vendors, search]);

  function handleSelect(vendor: MockMinimalVendor) {
    onChange(vendor);
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
            {value ? value.vendorName : "Select vendor…"}
          </span>
          <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search vendor…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && (
              <CommandEmpty>No matches.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((vendor) => (
                  <CommandItem
                    key={vendor.vendorId}
                    value={String(vendor.vendorId)}
                    onSelect={() => handleSelect(vendor)}
                    data-checked={value?.vendorId === vendor.vendorId}
                  >
                    {vendor.vendorName}
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
                Add new Vendor…
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
