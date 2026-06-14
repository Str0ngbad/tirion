"use client";

// ProjectChip — draggable chip representing one Unreleased+reviewed candidate WO.
// Used exclusively in the Composition Column of the Batching Lens.
// Distinct from ProjectIdPill: different role, different lifecycle, drag-capable.

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal } from "lucide-react";
import { PROJECT_COLOR_MAP, type ProjectColor } from "../project-creation/_data";

type Props = {
  woId: number;
  projectNumber: string;
  topLevelRef: string;
  demandQty: number;
  color: ProjectColor | null;
  isAtHome: boolean; // true when chip is in its own home cell
  disabled?: boolean; // true during someone else's drag or if confirmed
};

export default function ProjectChip({
  woId,
  projectNumber,
  topLevelRef,
  demandQty,
  color,
  isAtHome,
  disabled = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `chip-${woId}`,
      disabled,
      data: { woId },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const meta = color ? PROJECT_COLOR_MAP[color] : null;
  const bg = meta ? meta.hex : "#6b7280";
  const textColor = meta
    ? meta.text === "white"
      ? "#ffffff"
      : "#000000"
    : "#ffffff";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: bg, color: textColor }}
      {...listeners}
      {...attributes}
      className={[
        "inline-flex flex-col rounded-full px-2.5 py-1 text-xs select-none",
        "shadow-sm transition-shadow",
        isDragging ? "opacity-0" : "",
        !isAtHome ? "opacity-90" : "",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-grab active:cursor-grabbing hover:shadow-md",
      ]
        .filter(Boolean)
        .join(" ")}
      title={`WO for ${topLevelRef} — Qty ${demandQty}`}
    >
      <span className="font-mono font-semibold leading-tight">{topLevelRef}</span>
      <span className="leading-tight opacity-80">Qty: {demandQty}</span>
    </div>
  );
}

// A static (non-draggable) clone used in the DragOverlay while dragging
type OverlayProps = Omit<Props, "woId" | "disabled" | "isAtHome">;
export function ProjectChipOverlay({
  projectNumber,
  topLevelRef,
  demandQty,
  color,
}: OverlayProps) {
  const meta = color ? PROJECT_COLOR_MAP[color] : null;
  const bg = meta ? meta.hex : "#6b7280";
  const textColor = meta
    ? meta.text === "white"
      ? "#ffffff"
      : "#000000"
    : "#ffffff";

  return (
    <div
      style={{ backgroundColor: bg, color: textColor }}
      className="inline-flex flex-col rounded-full px-2.5 py-1 text-xs shadow-lg cursor-grabbing rotate-2"
    >
      <span className="font-mono font-semibold leading-tight">{topLevelRef}</span>
      <span className="leading-tight opacity-80">Qty: {demandQty}</span>
    </div>
  );
}
