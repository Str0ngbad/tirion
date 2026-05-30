"use client";

import { useState, useMemo } from "react";
import {
  MOCK_PARTS,
  MOCK_VENDORS,
  MOCK_MATERIAL_SPECS,
  MockPart,
  MockPartAuditEntry,
} from "./_data";
import PartsGrid, { PartSortKey } from "./_components/parts-grid";
import PartFormSheet from "./_components/part-form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDownIcon } from "lucide-react";

// ─── Filter toggle group ──────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
            i > 0 ? "border-l border-border" : "",
            value === opt.value
              ? "bg-foreground text-background"
              : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Combobox filter ─────────────────────────────────────────────────────────

function ComboFilter({
  placeholder,
  selectedLabel,
  options,
  onSelect,
  onClear,
  hasValue,
}: {
  placeholder: string;
  selectedLabel: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  onClear: () => void;
  hasValue: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted",
            hasValue ? "text-foreground border-foreground/30" : "text-muted-foreground",
          ].join(" ")}
        >
          <span>{hasValue ? selectedLabel : placeholder}</span>
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {hasValue && (
                <CommandItem
                  onSelect={() => { onClear(); setOpen(false); }}
                  className="text-muted-foreground italic"
                >
                  Clear filter
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  data-checked={selectedLabel === opt.label}
                  onSelect={() => { onSelect(opt.value); setOpen(false); }}
                >
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PartTypeFilter = "all" | "parts" | "assemblies";
type ActiveFilter = "active" | "inactive" | "both";

export default function PartsPage() {
  const [parts, setParts] = useState<MockPart[]>(MOCK_PARTS);
  const [partTypeFilter, setPartTypeFilter] = useState<PartTypeFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [vendorFilter, setVendorFilter] = useState<number | null>(null);
  const [materialFilter, setMaterialFilter] = useState<number | null>(null);
  const [stockSizeFilter, setStockSizeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<PartSortKey>("partNumber");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedPart, setSelectedPart] = useState<MockPart | null>(null);

  // Mockup-only: active user for audit entries
  const actorName = "Jane Chen";

  // Derive distinct stock sizes present in the dataset
  const distinctStockSizes = useMemo(() => {
    const sizes = new Set<string>();
    parts.forEach((p) => { if (p.stockSize) sizes.add(p.stockSize); });
    return Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [parts]);

  const displayed = useMemo(() => {
    return parts
      .filter((p) => {
        if (activeFilter === "active") return p.isActive;
        if (activeFilter === "inactive") return !p.isActive;
        return true;
      })
      .filter((p) => {
        if (partTypeFilter === "parts") return p.partType === "Part";
        if (partTypeFilter === "assemblies") return p.partType === "Assembly";
        return true;
      })
      .filter((p) => vendorFilter === null || p.defaultVendor?.vendorId === vendorFilter)
      .filter((p) => materialFilter === null || p.materialSpec?.materialSpecId === materialFilter)
      .filter((p) => stockSizeFilter === "all" || p.stockSize === stockSizeFilter)
      .filter((p) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return (
          p.partNumber.toLowerCase().includes(s) ||
          p.partName.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        switch (sortKey) {
          case "partNumber":
            return dir * a.partNumber.localeCompare(b.partNumber);
          case "partName":
            return dir * a.partName.localeCompare(b.partName);
          case "materialName": {
            const ma = a.materialSpec?.materialName ?? "";
            const mb = b.materialSpec?.materialName ?? "";
            return dir * ma.localeCompare(mb);
          }
          case "vendorName": {
            const va = a.defaultVendor?.vendorName ?? "";
            const vb = b.defaultVendor?.vendorName ?? "";
            return dir * va.localeCompare(vb);
          }
          case "stockCount":
            return dir * (a.stockCount - b.stockCount);
          case "inventoryLocation": {
            const la = a.inventoryLocation ?? "";
            const lb = b.inventoryLocation ?? "";
            return dir * la.localeCompare(lb);
          }
          default: {
            const _never: never = sortKey;
            void _never;
            return 0;
          }
        }
      });
  }, [parts, activeFilter, partTypeFilter, vendorFilter, materialFilter, stockSizeFilter, search, sortKey, sortAsc]);

  function handleSort(key: PartSortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function handleUpdateStock(partId: number, stockCount: number) {
    setParts((prev) =>
      prev.map((p) => {
        if (p.partId !== partId) return p;
        const entry: MockPartAuditEntry = {
          timestamp: new Date().toISOString(),
          userName: actorName,
          action: "PartUpdated",
          changedFields: [
            { field: "stockCount", before: p.stockCount.toString(), after: stockCount.toString() },
          ],
        };
        return { ...p, stockCount, auditLog: [entry, ...p.auditLog] };
      })
    );
    // Keep selected part in sync
    if (selectedPart?.partId === partId) {
      setSelectedPart((prev) => prev ? { ...prev, stockCount } : null);
    }
  }

  function handleUpdateLocation(partId: number, inventoryLocation: string) {
    const loc = inventoryLocation.trim() || null;
    setParts((prev) =>
      prev.map((p) => {
        if (p.partId !== partId) return p;
        const entry: MockPartAuditEntry = {
          timestamp: new Date().toISOString(),
          userName: actorName,
          action: "PartUpdated",
          changedFields: [
            { field: "inventoryLocation", before: p.inventoryLocation, after: loc },
          ],
        };
        return { ...p, inventoryLocation: loc, auditLog: [entry, ...p.auditLog] };
      })
    );
    if (selectedPart?.partId === partId) {
      setSelectedPart((prev) => prev ? { ...prev, inventoryLocation: loc } : null);
    }
  }

  function handleUpdate(updated: MockPart) {
    setParts((prev) => prev.map((p) => (p.partId === updated.partId ? updated : p)));
    setSelectedPart(updated);
  }

  function clearAllFilters() {
    setPartTypeFilter("all");
    setActiveFilter("active");
    setVendorFilter(null);
    setMaterialFilter(null);
    setStockSizeFilter("all");
    setSearch("");
  }

  const activeCount = parts.filter((p) => p.isActive).length;
  const inactiveCount = parts.filter((p) => !p.isActive).length;

  const vendorOptions = MOCK_VENDORS.map((v) => ({
    value: v.vendorId.toString(),
    label: v.vendorName,
  }));
  const materialOptions = MOCK_MATERIAL_SPECS.map((m) => ({
    value: m.materialSpecId.toString(),
    label: `${m.materialName} — ${m.form}`,
  }));
  const selectedVendorLabel =
    MOCK_VENDORS.find((v) => v.vendorId === vendorFilter)?.vendorName ?? "";
  const selectedMaterialSpec = MOCK_MATERIAL_SPECS.find(
    (m) => m.materialSpecId === materialFilter
  );
  const selectedMaterialLabel = selectedMaterialSpec
    ? `${selectedMaterialSpec.materialName} — ${selectedMaterialSpec.form}`
    : "";

  const hasActiveFilters =
    partTypeFilter !== "all" ||
    activeFilter !== "active" ||
    vendorFilter !== null ||
    materialFilter !== null ||
    stockSizeFilter !== "all" ||
    search.trim() !== "";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — Parts Master Configuration Grid</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Parts</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeCount} active
              {inactiveCount > 0 && `, ${inactiveCount} inactive`}
            </p>
          </div>
          <Button>
            <span className="text-base leading-none">+</span>
            Add Part
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border bg-card/40 px-8 py-3">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-3">
          {/* Part / Assembly toggle */}
          <ToggleGroup
            options={[
              { value: "all", label: "All" },
              { value: "parts", label: "Parts" },
              { value: "assemblies", label: "Assemblies" },
            ]}
            value={partTypeFilter}
            onChange={setPartTypeFilter}
          />

          {/* Active state toggle */}
          <ToggleGroup
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "both", label: "Both" },
            ]}
            value={activeFilter}
            onChange={setActiveFilter}
          />

          <div className="h-5 w-px bg-border" />

          {/* Vendor combobox */}
          <ComboFilter
            placeholder="Vendor"
            selectedLabel={selectedVendorLabel}
            options={vendorOptions}
            onSelect={(v) => setVendorFilter(parseInt(v, 10))}
            onClear={() => setVendorFilter(null)}
            hasValue={vendorFilter !== null}
          />

          {/* Material combobox */}
          <ComboFilter
            placeholder="Material"
            selectedLabel={selectedMaterialLabel}
            options={materialOptions}
            onSelect={(v) => setMaterialFilter(parseInt(v, 10))}
            onClear={() => setMaterialFilter(null)}
            hasValue={materialFilter !== null}
          />

          {/* Stock size select */}
          <Select value={stockSizeFilter} onValueChange={setStockSizeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Stock Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sizes</SelectItem>
              {distinctStockSizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}″
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Spacer + search on the right */}
          <div className="ml-auto flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
            <Input
              type="search"
              placeholder="Search part number or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-64 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-screen-2xl px-8 py-6">
        {displayed.length === 0 && !hasActiveFilters ? (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No parts found. Add your first part to get started.
            </p>
            <Button className="mt-4">
              <span className="text-base leading-none">+</span>
              Add Part
            </Button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">No parts match the current filters.</p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-2 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <PartsGrid
            parts={displayed}
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={handleSort}
            onRowClick={setSelectedPart}
            onUpdateStock={handleUpdateStock}
            onUpdateLocation={handleUpdateLocation}
          />
        )}
      </div>

      {/* Part Form Sheet */}
      {selectedPart !== null && (
        <PartFormSheet
          part={selectedPart}
          actorName={actorName}
          onClose={() => setSelectedPart(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
