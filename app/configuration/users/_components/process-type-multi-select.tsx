'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
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
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="text-muted-foreground">
              {value.length === 0
                ? 'Select process types…'
                : `${value.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search process types…" />
            <CommandList>
              <CommandEmpty>No process types found.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.processTypeId}
                    value={opt.processName}
                    onSelect={() => toggle(opt.processTypeId)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(opt.processTypeId) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {opt.processCode}
                    </span>
                    {opt.processName}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt) => (
            <Badge
              key={opt.processTypeId}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="font-mono text-xs">{opt.processCode}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(opt.processTypeId)}
                  className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
