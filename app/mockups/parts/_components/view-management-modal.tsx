"use client";

import { useState, useRef, useEffect } from "react";
import type { View } from "../_lib/views";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyIcon, Trash2Icon } from "lucide-react";

// ─── Inline rename cell ────────────────────────────────────────────────────────

type InlineRenameCellProps = {
  name: string;
  existingNames: string[];
  viewId: number;
  onCommit: (viewId: number, name: string) => void;
};

function InlineRenameCell({ name, existingNames, viewId, onCommit }: InlineRenameCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(name);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, name]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { setError("Name is required"); return; }
    // Allow same name (no-op), reject duplicates of other views
    const dup = existingNames.find(
      (n) => n.toLowerCase() === trimmed.toLowerCase() && n !== name
    );
    if (dup) { setError("A view with this name already exists"); return; }
    setEditing(false);
    setError(null);
    if (trimmed !== name) onCommit(viewId, trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setEditing(false); setDraft(name); setError(null); }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <Input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-40 text-sm"
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <span
      className="cursor-text rounded px-1 py-0.5 hover:bg-muted/50 text-sm"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Click to rename"
    >
      {name}
    </span>
  );
}

// ─── Delete confirmation dialog ────────────────────────────────────────────────

type DeleteConfirmProps = {
  viewName: string;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function DeleteConfirm({ viewName, open, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete view "{viewName}"?</DialogTitle>
          <DialogDescription>This view will be removed for all users.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sort summary helper ───────────────────────────────────────────────────────

const SORT_LABELS: Partial<Record<string, string>> = {
  partNumber: 'Part #',
  partName: 'Part Name',
  material: 'Material',
  vendor: 'Vendor',
  stockCount: 'Stock',
  location: 'Location',
  cost: 'Cost',
  costLastUpdated: 'Cost Updated',
  assembliesUsedInCount: 'Used In',
};

function sortSummary(view: View): string {
  const { columnId, direction } = view.defaultSort;
  return `${SORT_LABELS[columnId] ?? columnId} ${direction}`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Props = {
  views: View[];
  open: boolean;
  onClose: () => void;
  onRename: (viewId: number, name: string) => void;
  onSetDefault: (viewId: number) => void;
  onDuplicate: (viewId: number) => void;
  onDelete: (viewId: number) => void;
};

export default function ViewManagementModal({
  views,
  open,
  onClose,
  onRename,
  onSetDefault,
  onDuplicate,
  onDelete,
}: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const pendingDeleteView = views.find((v) => v.viewId === pendingDeleteId);
  const existingNames = views.map((v) => v.name);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-3xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Manage Views</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pl-1 pr-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="pb-2 px-3 text-xs font-medium text-muted-foreground text-center">Default</th>
                  <th className="pb-2 px-3 text-xs font-medium text-muted-foreground">Columns</th>
                  <th className="pb-2 px-3 text-xs font-medium text-muted-foreground">Default Sort</th>
                  <th className="pb-2 px-3 text-xs font-medium text-muted-foreground">Filters</th>
                  <th className="pb-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {views.map((v) => (
                  <tr key={v.viewId} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pl-1 pr-3 min-w-[160px]">
                      <InlineRenameCell
                        name={v.name}
                        existingNames={existingNames}
                        viewId={v.viewId}
                        onCommit={onRename}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="radio"
                        name="default-view"
                        checked={v.isDefault}
                        onChange={() => onSetDefault(v.viewId)}
                        className="cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {v.visibleColumns.length} columns
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {sortSummary(v)}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {v.filters.length === 0
                        ? 'No filters'
                        : `${v.filters.length} filter${v.filters.length === 1 ? '' : 's'}`}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Duplicate"
                          onClick={() => onDuplicate(v.viewId)}
                        >
                          <CopyIcon />
                        </Button>
                        {v.isDefault ? (
                          <span
                            title="Set a different view as default first."
                            className="inline-flex size-8 items-center justify-center rounded-[min(var(--radius-md),10px)] opacity-30 cursor-not-allowed"
                          >
                            <Trash2Icon className="size-4" />
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setPendingDeleteId(v.viewId)}
                          >
                            <Trash2Icon />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pendingDeleteId !== null && pendingDeleteView && (
        <DeleteConfirm
          viewName={pendingDeleteView.name}
          open
          onConfirm={() => {
            onDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </>
  );
}
