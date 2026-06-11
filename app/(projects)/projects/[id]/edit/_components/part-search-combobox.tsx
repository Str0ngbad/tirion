"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, AlertCircle } from "lucide-react";

type PartOption = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  routingTemplateDefinitionId: number | null;
  isActive: boolean;
};

// Client-side ranking: exact > prefix > substring
function rankPart(part: PartOption, q: string): number {
  const ql = q.toLowerCase();
  const num = part.partNumber.toLowerCase();
  const name = part.partName.toLowerCase();
  if (num === ql || name === ql) return 0;
  if (num.startsWith(ql) || name.startsWith(ql)) return 1;
  if (num.includes(ql) || name.includes(ql)) return 2;
  return 99;
}

type Props = {
  onAdd: (part: PartOption, qty: number) => void;
  disabled?: boolean;
};

export function PartSearchCombobox({ onAdd, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PartOption | null>(null);
  const [qty, setQty] = useState("1");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: allParts = [] } = useQuery({
    queryKey: ["parts", "active"],
    queryFn: () =>
      apiFetch<{ data: PartOption[] }>("/api/v1/parts?active=true").then((r) => r.data),
    staleTime: 60_000,
  });

  const results =
    query.trim().length < 1
      ? []
      : allParts
          .map((p) => ({ part: p, rank: rankPart(p, query.trim()) }))
          .filter((x) => x.rank < 99)
          .sort((a, b) => a.rank - b.rank || a.part.partNumber.localeCompare(b.part.partNumber))
          .slice(0, 50)
          .map((x) => x.part);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function pickPart(part: PartOption) {
    setSelected(part);
    setQuery(`${part.partNumber} — ${part.partName}`);
    setOpen(false);
  }

  function handleAdd() {
    if (!selected) return;
    onAdd(selected, Math.max(1, parseInt(qty) || 1));
    setSelected(null);
    setQuery("");
    setQty("1");
  }

  const hasValidationWarning =
    selected !== null && selected.routingTemplateDefinitionId === null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-96">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => query.length > 0 && setOpen(true)}
          placeholder="Search by Part Number or Name to add…"
          className="h-8 pl-8 text-sm"
        />

        {open && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-9 z-50 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
          >
            {results.map((part) => (
              <button
                key={part.partId}
                type="button"
                onClick={() => pickPart(part)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-mono text-xs shrink-0 text-muted-foreground w-28 truncate">
                  {part.partNumber}
                </span>
                <span className="flex-1 truncate text-sm">{part.partName}</span>
                <span className="shrink-0 rounded border border-border px-1 py-0.5 text-xs text-muted-foreground">
                  {part.partType}
                </span>
                {part.routingTemplateDefinitionId === null && (
                  <span title="No routing template assigned">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Input
        type="number"
        min={1}
        value={qty}
        disabled={disabled}
        onChange={(e) => setQty(e.target.value)}
        className="h-8 w-16 text-sm text-right"
        placeholder="Qty"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={!selected || disabled}
        className="h-8"
      >
        Add
      </Button>

      {hasValidationWarning && (
        <span className="text-xs text-amber-600">No template assigned</span>
      )}
    </div>
  );
}
