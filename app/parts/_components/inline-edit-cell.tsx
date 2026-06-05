"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type InlineEditCellProps = {
  value: string | number | null;
  type: "text" | "number";
  align?: "left" | "right";
  onCommit: (newValue: string | number | null) => void | Promise<void>;
  className?: string;
};

export default function InlineEditCell({
  value,
  type,
  align = "left",
  onCommit,
  className,
}: InlineEditCellProps) {
  const displayStr = value !== null && value !== "" ? String(value) : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayStr ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when the value prop changes from outside (optimistic revert)
  useEffect(() => {
    if (!editing) setDraft(displayStr ?? "");
  }, [value, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(displayStr ?? "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();

    if (type === "number") {
      const n = Number(trimmed);
      if (trimmed === "" || isNaN(n) || n < 0) {
        // Invalid or negative — revert, don't commit
        setDraft(displayStr ?? "");
        return;
      }
      const intVal = Math.floor(n);
      if (intVal === value) return;
      void onCommit(intVal);
    } else {
      const normalized = trimmed === "" ? null : trimmed;
      if (normalized === (value === "" ? null : value)) return;
      void onCommit(normalized);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(displayStr ?? "");
    }
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={draft}
        min={type === "number" ? 0 : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "h-7 w-full px-2 text-xs",
          align === "right" && "text-right",
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      title="Click to edit"
      className={cn(
        "block cursor-text rounded px-1 py-0.5 text-sm hover:bg-muted/50",
        align === "right" && "text-right",
        className
      )}
    >
      {displayStr !== null ? (
        displayStr
      ) : (
        <span className="text-xs text-muted-foreground/40">—</span>
      )}
    </span>
  );
}
