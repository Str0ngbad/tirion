"use client";

import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectColor } from "@/lib/api/projects";

const COLOR_META: Record<ProjectColor, { hex: string; label: string }> = {
  blue:        { hex: "#1d4ed8", label: "Blue" },
  lightBlue:   { hex: "#7dd3fc", label: "Light Blue" },
  purple:      { hex: "#7e22ce", label: "Purple" },
  lightPurple: { hex: "#d8b4fe", label: "Light Purple" },
  red:         { hex: "#dc2626", label: "Red" },
  pink:        { hex: "#ec4899", label: "Pink" },
  orange:      { hex: "#f97316", label: "Orange" },
  lightOrange: { hex: "#fdba74", label: "Light Orange" },
  yellow:      { hex: "#facc15", label: "Yellow" },
  green:       { hex: "#15803d", label: "Green" },
  lightGreen:  { hex: "#86efac", label: "Light Green" },
  gray:        { hex: "#4b5563", label: "Gray" },
  brown:       { hex: "#92400e", label: "Brown" },
};

// Ordered as specified: None first, then 13 colors in 2 rows
const COLOR_ORDER: ProjectColor[] = [
  "blue", "lightBlue", "purple", "lightPurple",
  "red", "pink", "orange", "lightOrange",
  "yellow", "green", "lightGreen", "gray", "brown",
];

type Props = {
  selected: ProjectColor | null;
  onSelect: (color: ProjectColor | null) => void;
  children: React.ReactNode;
};

export function ColorPickerPopover({ selected, onSelect, children }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-7 gap-1">
          {/* None swatch */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted/50 transition-colors"
            title="None"
          >
            {selected === null && <Check className="h-3.5 w-3.5 text-foreground" />}
          </button>

          {/* Color swatches */}
          {COLOR_ORDER.map((color) => {
            const { hex, label } = COLOR_META[color];
            const isSelected = selected === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => onSelect(color)}
                className="relative flex h-7 w-7 items-center justify-center rounded transition-opacity hover:opacity-80"
                style={{ backgroundColor: hex }}
                title={label}
              >
                {isSelected && (
                  <Check
                    className="h-3.5 w-3.5"
                    style={{ color: ["lightBlue", "lightPurple", "lightOrange", "yellow", "lightGreen"].includes(color) ? "#000" : "#fff" }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {selected && (
          <p className="mt-1 text-center text-xs text-muted-foreground">{COLOR_META[selected].label}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Swatch button for use as the trigger
type SwatchProps = {
  color: ProjectColor | null;
};

export function ColorSwatch({ color }: SwatchProps) {
  if (!color) {
    return (
      <span className="h-4 w-4 rounded border border-border bg-background" />
    );
  }
  return (
    <span
      className="h-4 w-4 rounded"
      style={{ backgroundColor: COLOR_META[color].hex }}
    />
  );
}

export { COLOR_META };
