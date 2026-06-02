"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { collectAssemblies } from "./_lib/bom-utils";
import { MockPart } from "@/app/mockups/parts/_data";
import { Input } from "@/components/ui/input";

const ALL_ASSEMBLIES = collectAssemblies();

export default function BomEditorLandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const results: MockPart[] = query.trim()
    ? ALL_ASSEMBLIES.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(query.toLowerCase()) ||
          p.partName.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ASSEMBLIES;

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

  function select(part: MockPart) {
    router.push(`/mockups/bom-editor/${part.partId}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — BOM Editor</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header */}
      <div className="border-b border-border px-8 py-6">
        <div className="mx-auto max-w-screen-2xl">
          <h1 className="text-2xl font-semibold">BOM Editor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select an assembly to view and edit its Bill of Materials.
          </p>
        </div>
      </div>

      {/* Search area */}
      <div className="mx-auto mt-12 w-full max-w-xl px-4">
        <div className="relative">
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
              placeholder="Search by Assembly number or name..."
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
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <span className="font-mono text-xs font-semibold text-primary w-24 shrink-0">
                        {p.partNumber}
                      </span>
                      <span className="flex-1 truncate text-sm text-foreground">
                        {p.partName}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {p.childParts.length} child{p.childParts.length !== 1 ? "ren" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!open && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {ALL_ASSEMBLIES.length} active assembl{ALL_ASSEMBLIES.length !== 1 ? "ies" : "y"} available
          </p>
        )}
      </div>
    </div>
  );
}
