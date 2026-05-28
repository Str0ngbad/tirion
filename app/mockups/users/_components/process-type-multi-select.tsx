"use client";

import { useState } from "react";
import { ProcessTypeKey, ALL_PROCESS_TYPES } from "../_data";
import ProcessTypeChip from "./process-type-chip";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDownIcon, CheckIcon } from "lucide-react";

type Props = {
  selected: ProcessTypeKey[];
  onChange: (value: ProcessTypeKey[]) => void;
  disabled?: boolean;
};

export default function ProcessTypeMultiSelect({ selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);

  function toggleItem(key: ProcessTypeKey) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full min-h-9 h-auto justify-between font-normal py-1.5"
          onClick={() => !disabled && setOpen((p) => !p)}
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {selected.length === 0 ? (
              <span className="text-muted-foreground text-sm">Select process types</span>
            ) : (
              selected.map((key) => <ProcessTypeChip key={key} processType={key} />)
            )}
          </div>
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {ALL_PROCESS_TYPES.map((key) => {
                const isSelected = selected.includes(key);
                return (
                  <CommandItem
                    key={key}
                    value={key}
                    onSelect={() => toggleItem(key)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <CheckIcon className="h-3 w-3" />}
                      </div>
                      <ProcessTypeChip processType={key} />
                      <span className="text-sm">{key}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
