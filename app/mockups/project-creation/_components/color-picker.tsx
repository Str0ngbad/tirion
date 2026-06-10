"use client";

import { useRef, useEffect } from "react";
import { PROJECT_COLORS, PROJECT_COLOR_MAP, ProjectColor } from "../_data";
import { X, Check } from "lucide-react";

type Props = {
  selected: ProjectColor | null;
  onSelect: (color: ProjectColor | null) => void;
  onClose: () => void;
};

export default function ColorPicker({ selected, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-9 z-50 w-64 rounded-md border border-border bg-popover shadow-lg p-3"
    >
      <div className="mb-2 text-xs font-medium text-muted-foreground">Project Color</div>
      {/* 7 columns: None swatch + 13 color swatches = 14 in 2 rows */}
      <div className="grid grid-cols-7 gap-1.5">
        {/* "None" option */}
        <button
          onClick={() => { onSelect(null); onClose(); }}
          className={`h-7 w-7 flex items-center justify-center rounded-full border-2 transition-all
            ${selected === null
              ? "border-foreground/80 scale-110"
              : "border-transparent hover:border-foreground/30"}
            bg-muted`}
          title="No color"
        >
          {selected === null ? (
            <Check className="h-3 w-3 text-foreground" />
          ) : (
            <X className="h-3 w-3 text-muted-foreground/50" />
          )}
        </button>

        {/* Color swatches */}
        {PROJECT_COLORS.map((color) => {
          const meta = PROJECT_COLOR_MAP[color];
          return (
            <button
              key={color}
              onClick={() => { onSelect(color); onClose(); }}
              className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all
                ${selected === color
                  ? "border-white scale-110 shadow-md"
                  : "border-transparent hover:border-white/50 hover:scale-105"}`}
              style={{ backgroundColor: meta.hex }}
              title={meta.label}
            >
              {selected === color && <Check className="h-3 w-3 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
