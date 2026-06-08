'use client';

import { useState } from 'react';
import { ChevronsUpDown, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import ProcessTypeChip from '@/components/process-type-chip';
import type { ProcessTypeKey } from '@/lib/process-types';
import type { ProcessTypeRow } from '@/lib/api/process-types';

interface ProcessTypeMultiSelectProps {
  value: number[];
  onChange: (ids: number[]) => void;
  options: ProcessTypeRow[];
  disabled?: boolean;
}

export function ProcessTypeMultiSelect({
  value,
  onChange,
  options,
  disabled,
}: ProcessTypeMultiSelectProps) {
  const [open, setOpen] = useState(false);

  function toggle(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  const selectedOptions = options.filter((o) => value.includes(o.processTypeId));

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
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground text-sm">Select process types…</span>
            ) : (
              selectedOptions.map((opt) => (
                <ProcessTypeChip
                  key={opt.processTypeId}
                  processType={opt.processName as ProcessTypeKey}
                />
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = value.includes(opt.processTypeId);
                return (
                  <CommandItem
                    key={opt.processTypeId}
                    value={opt.processName}
                    onSelect={() => toggle(opt.processTypeId)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border'
                        }`}
                      >
                        {isSelected && <CheckIcon className="h-3 w-3" />}
                      </div>
                      <ProcessTypeChip processType={opt.processName as ProcessTypeKey} />
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
