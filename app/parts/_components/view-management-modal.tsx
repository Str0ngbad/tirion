"use client";

import { useState } from "react";
import { LockIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ViewRow } from "@/lib/api/views";

type Props = {
  open: boolean;
  onClose: () => void;
  views: ViewRow[];
  activeViewId: number | null;
  onRename: (viewId: number, newName: string) => void;
  onDelete: (viewId: number) => void;
};

export default function ViewManagementModal({
  open,
  onClose,
  views,
  activeViewId,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const defaultView = views.find((v) => v.isDefault);

  function startRename(view: ViewRow) {
    setEditingId(view.viewId);
    setEditingName(view.name);
  }

  function commitRename(viewId: number) {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== views.find((v) => v.viewId === viewId)?.name) {
      onRename(viewId, trimmed);
    }
    setEditingId(null);
  }

  const confirmView = views.find((v) => v.viewId === confirmDeleteId);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Views</DialogTitle>
          </DialogHeader>

          <div className="mt-2 rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="w-12 px-3 py-2 text-center font-medium text-muted-foreground">Locked</th>
                  <th className="w-20 px-3 py-2 text-center font-medium text-muted-foreground">Default</th>
                  <th className="w-14 px-3 py-2 text-center font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {views.map((view) => {
                  const isDefault = view.isDefault || view.viewId === defaultView?.viewId;
                  const canDelete = !view.isLocked && !isDefault && view.viewId !== activeViewId;

                  return (
                    <tr key={view.viewId} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        {editingId === view.viewId ? (
                          <Input
                            value={editingName}
                            autoFocus
                            className="h-7 px-2 py-0 text-sm"
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(view.viewId);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onBlur={() => commitRename(view.viewId)}
                          />
                        ) : (
                          <span
                            className={view.isLocked ? "text-muted-foreground" : "cursor-pointer hover:underline"}
                            onDoubleClick={() => { if (!view.isLocked) startRename(view); }}
                          >
                            {view.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {view.isLocked && (
                          <LockIcon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {/* Rev 1: default is locked to Master View; radio is display-only */}
                        <input
                          type="radio"
                          checked={isDefault}
                          disabled
                          readOnly
                          className="accent-primary"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          disabled={!canDelete}
                          onClick={() => setConfirmDeleteId(view.viewId)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                          title={canDelete ? `Delete ${view.name}` : undefined}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete view?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete view <span className="font-medium text-foreground">{confirmView?.name}</span>? This will remove it permanently.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteId !== null) {
                  onDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
