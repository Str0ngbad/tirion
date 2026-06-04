"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Props = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
};

export function CondenseToggle({ checked, onCheckedChange, label = "Condense" }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="condense-toggle"
        className="cursor-pointer font-normal text-sm text-muted-foreground"
      >
        {label}
      </Label>
      <Switch
        id="condense-toggle"
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
