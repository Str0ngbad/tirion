"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAssemblies } from "@/lib/api/parts";

interface BomEditorChromeProps {
  selectedAssemblyId?: number;
  autoFocusSearch?: boolean;
}

export function BomEditorChrome({ selectedAssemblyId, autoFocusSearch }: BomEditorChromeProps) {
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: assemblies = [] } = useAssemblies();

  const filtered = useMemo(() => {
    if (!query) return assemblies;
    const q = query.toLowerCase();
    return assemblies.filter(
      (a) =>
        a.partNumber.toLowerCase().includes(q) ||
        a.partName.toLowerCase().includes(q)
    );
  }, [query, assemblies]);

  const handleSelect = (assemblyId: number) => {
    setQuery("");
    setDropdownOpen(false);
    router.push(`/bom-editor/${assemblyId}`);
  };

  useEffect(() => {
    if (autoFocusSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocusSearch]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  return (
    <div className="shrink-0 border-b bg-card">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-6 px-6 py-4">
        <h1 className="shrink-0 text-xl font-semibold">BOM Editor</h1>

        <div ref={containerRef} className="relative w-full max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setDropdownOpen(false);
                inputRef.current?.blur();
              }
            }}
            placeholder="Search assemblies…"
            className="pl-8"
          />

          {dropdownOpen && filtered.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 border bg-popover rounded-md shadow-md max-h-[360px] overflow-y-auto">
              {filtered.map((a) => (
                <button
                  key={a.partId}
                  onClick={() => handleSelect(a.partId)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                >
                  <span className="font-mono text-xs w-24 shrink-0 truncate">
                    {a.partNumber}
                  </span>
                  <span className="text-sm truncate flex-1">{a.partName}</span>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {a.directChildCount}{" "}
                    {a.directChildCount === 1 ? "child" : "children"}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {dropdownOpen && filtered.length === 0 && query.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 border bg-popover rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
              No assemblies match &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
