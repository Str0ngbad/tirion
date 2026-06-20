"use client";

// ProjectChip — draggable chip representing one Unreleased+reviewed candidate WO.
// Used exclusively in the Composition Column of the Batching Lens.
// This is the ONLY component in the Batching Lens that applies project color.

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Anchor } from "lucide-react";

export type ProjectColor =
  | "blue" | "lightBlue" | "purple" | "lightPurple"
  | "red" | "pink" | "orange" | "lightOrange"
  | "yellow" | "green" | "lightGreen" | "gray" | "brown";

export const PROJECT_COLOR_MAP: Record<ProjectColor, { hex: string; text: "white" | "black" }> = {
  blue:        { hex: "#1d4ed8", text: "white" },
  lightBlue:   { hex: "#7dd3fc", text: "black" },
  purple:      { hex: "#7e22ce", text: "white" },
  lightPurple: { hex: "#d8b4fe", text: "black" },
  red:         { hex: "#dc2626", text: "white" },
  pink:        { hex: "#ec4899", text: "black" },
  orange:      { hex: "#f97316", text: "black" },
  lightOrange: { hex: "#fdba74", text: "black" },
  yellow:      { hex: "#facc15", text: "black" },
  green:       { hex: "#15803d", text: "white" },
  lightGreen:  { hex: "#86efac", text: "black" },
  gray:        { hex: "#4b5563", text: "white" },
  brown:       { hex: "#92400e", text: "white" },
};

type Props = {
  woId: number;
  projectNumber: string;
  topLevelRef: string;
  demandQty: number;
  color: string | null;
  isAtHome: boolean;
  isRoot: boolean;
  isAnchoredRoot: boolean;
  disabled?: boolean;
};

export default function ProjectChip({
  woId,
  projectNumber,
  topLevelRef,
  demandQty,
  color,
  isAtHome,
  isRoot,
  isAnchoredRoot,
  disabled = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `chip-${woId}`,
      disabled: disabled || isAnchoredRoot,
      data: { woId },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const meta = color && color in PROJECT_COLOR_MAP ? PROJECT_COLOR_MAP[color as ProjectColor] : null;
  const bg = meta ? meta.hex : "#6b7280";
  const textColor = meta ? (meta.text === "white" ? "#ffffff" : "#000000") : "#ffffff";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: bg, color: textColor }}
      {...listeners}
      {...attributes}
      className={[
        "relative inline-flex flex-row items-center gap-1 rounded-md px-2.5 py-0.5 text-xs select-none whitespace-nowrap",
        "shadow-sm transition-shadow",
        isDragging ? "opacity-0" : "",
        !isAtHome ? "opacity-90" : "",
        disabled
          ? "cursor-not-allowed opacity-50"
          : isAnchoredRoot
          ? "cursor-default"
          : "cursor-grab active:cursor-grabbing hover:shadow-md",
      ]
        .filter(Boolean)
        .join(" ")}
      title={
        isRoot
          ? `WO for ${topLevelRef} — Qty ${demandQty} (root — anchored)`
          : `WO for ${topLevelRef} — Qty ${demandQty}`
      }
    >
      {isRoot && (
        <Anchor className="h-3 w-3 opacity-70 shrink-0" strokeWidth={3} aria-label="Root of batch" />
      )}
      <span className="font-mono font-semibold">{topLevelRef}</span>
      <span className="opacity-60">/</span>
      <span className="opacity-80">Qty: {demandQty}</span>
    </div>
  );
}

type OverlayProps = {
  projectNumber: string;
  topLevelRef: string;
  demandQty: number;
  color: string | null;
};

export function ProjectChipOverlay({ topLevelRef, demandQty, color }: OverlayProps) {
  const meta = color && color in PROJECT_COLOR_MAP ? PROJECT_COLOR_MAP[color as ProjectColor] : null;
  const bg = meta ? meta.hex : "#6b7280";
  const textColor = meta ? (meta.text === "white" ? "#ffffff" : "#000000") : "#ffffff";

  return (
    <div
      style={{ backgroundColor: bg, color: textColor }}
      className="inline-flex flex-row items-center gap-1 rounded-md px-2.5 py-0.5 text-xs shadow-lg cursor-grabbing rotate-2"
    >
      <span className="font-mono font-semibold">{topLevelRef}</span>
      <span className="opacity-60">/</span>
      <span className="opacity-80">Qty: {demandQty}</span>
    </div>
  );
}
