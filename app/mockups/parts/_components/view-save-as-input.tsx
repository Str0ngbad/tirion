"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  existingNames: string[];
  onCommit: (name: string) => void;
  onCancel: () => void;
};

export default function ViewSaveAsInput({ existingNames, onCommit, onCancel }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const committedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) { setError("Name is required"); return; }
    const dup = existingNames.find((n) => n.toLowerCase() === trimmed.toLowerCase());
    if (dup) { setError("A view with this name already exists"); return; }
    committedRef.current = true;
    onCommit(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") onCancel();
  }

  function handleBlur() {
    if (!committedRef.current) onCancel();
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        ref={inputRef}
        type="text"
        placeholder="New view name…"
        value={value}
        onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-8 w-48 text-xs"
      />
      {error && <span className="text-xs text-destructive leading-none">{error}</span>}
    </div>
  );
}
