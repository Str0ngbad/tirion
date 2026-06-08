"use client";

import { useState, useRef, useEffect } from "react";
import { MOCK_PARTS, MockPart } from "@/app/mockups/parts/_data";
import { validatePart } from "../_lib/validation";
import { Search, AlertCircle, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

// Relevance ranking: exact > prefix > substring > edit-distance (on partNumber first, partName second)
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const prev = dp[i - 1]?.[j - 1] ?? 0;
      const up = dp[i - 1]?.[j] ?? 0;
      const left = dp[i]?.[j - 1] ?? 0;
      dp[i]![j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(up, left, prev);
    }
  }
  return dp[a.length]?.[b.length] ?? 0;
}

function rankPart(part: MockPart, q: string): number {
  const ql = q.toLowerCase();
  const num = part.partNumber.toLowerCase();
  const name = part.partName.toLowerCase();
  if (num === ql || name === ql) return 0;
  if (num.startsWith(ql) || name.startsWith(ql)) return 1;
  if (num.includes(ql) || name.includes(ql)) return 2;
  // Edit-distance on prefix of equal length
  const prefix = num.substring(0, ql.length);
  if (levenshtein(prefix, ql) <= 1) return 3;
  const namePrefix = name.substring(0, ql.length);
  if (levenshtein(namePrefix, ql) <= 1) return 3;
  return 99;
}

const ACTIVE_PARTS = MOCK_PARTS.filter((p) => p.isActive);

type Props = {
  placeholder?: string;
  onSelect: (part: MockPart, qty: number) => void;
};

export default function PartSearchCombobox({ placeholder, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [selectedPart, setSelectedPart] = useState<MockPart | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results: MockPart[] = query.trim().length < 1
    ? []
    : ACTIVE_PARTS
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

  function pickPart(part: MockPart) {
    setSelectedPart(part);
    setQuery(`${part.partNumber} — ${part.partName}`);
    setOpen(false);
  }

  function handleAdd() {
    if (!selectedPart) return;
    const parsedQty = Math.max(1, parseInt(qty) || 1);
    onSelect(selectedPart, parsedQty);
    setSelectedPart(null);
    setQuery("");
    setQty("1");
  }

  return (
    <div className="flex items-center gap-2">
      {/* Search input */}
      <div className="relative w-96">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedPart(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search by Part Number or Name…"}
          className="h-8 pl-8 text-sm"
        />

        {open && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-9 z-50 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
          >
            {results.map((part) => {
              const validation = validatePart(part.partId);
              return (
                <button
                  key={part.partId}
                  onClick={() => pickPart(part)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-mono text-xs shrink-0 text-muted-foreground w-28 truncate">
                    {part.partNumber}
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">{part.partName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground/60">{part.partType}</span>
                  {validation.status === "fail" && (
                    <span title={validation.reason}>
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Qty */}
      <Input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="h-8 w-16 text-sm text-right"
        placeholder="Qty"
      />

      {/* Add button */}
      <button
        onClick={handleAdd}
        disabled={!selectedPart}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}
