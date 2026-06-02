"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { MOCK_PARTS, MockPart } from "@/app/mockups/parts/_data";
import { collectAssemblies } from "../_lib/bom-utils";
import { Input } from "@/components/ui/input";

const ALL_ASSEMBLIES = collectAssemblies();

type Props = {
  currentAssemblyId?: number;
  autoFocusSearch?: boolean;
};

export default function BomEditorChrome({ currentAssemblyId, autoFocusSearch }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentAssembly =
    currentAssemblyId != null
      ? MOCK_PARTS.find((p) => p.partId === currentAssemblyId)
      : undefined;

  const searchPlaceholder = currentAssembly
    ? `${currentAssembly.partNumber} — ${currentAssembly.partName}`
    : "Search by Assembly number or name…";

  const results: MockPart[] = query.trim()
    ? ALL_ASSEMBLIES.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(query.toLowerCase()) ||
          p.partName.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ASSEMBLIES;

  useEffect(() => {
    if (autoFocusSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocusSearch]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  function select(part: MockPart) {
    setOpen(false);
    setQuery("");
    router.push(`/mockups/bom-editor/${part.partId}`);
  }

  return (
    <div className="shrink-0">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — BOM Editor</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header with persistent Assembly search */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-6">
          <h1 className="shrink-0 text-xl font-semibold">BOM Editor</h1>

          {/* Assembly search */}
          <div className="relative w-full max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>

            {open && (
              <div
                ref={dropdownRef}
                className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg"
                style={{ maxHeight: 360 }}
              >
                {results.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No assemblies match &quot;{query}&quot;
                  </div>
                ) : (
                  <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                    {results.map((p) => (
                      <button
                        key={p.partId}
                        onMouseDown={() => select(p)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <span className="w-24 shrink-0 font-mono text-xs font-semibold text-primary">
                          {p.partNumber}
                        </span>
                        <span className="flex-1 truncate text-sm text-foreground">
                          {p.partName}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {p.childParts.length} child
                          {p.childParts.length !== 1 ? "ren" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
