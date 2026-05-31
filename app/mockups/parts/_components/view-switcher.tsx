"use client";

import { useState } from "react";
import type { View } from "../_lib/views";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, SaveIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import ViewSaveConfirmation from "./view-save-confirmation";
import ViewSaveAsInput from "./view-save-as-input";

type Props = {
  views: View[];
  activeView: View;
  isDirty: boolean;
  onViewChange: (view: View) => void;
  onSaveConfirmed: () => void;
  onSaveAsNew: (name: string) => void;
  onRevert: () => void;
  onManageViews: () => void;
};

export default function ViewSwitcher({
  views,
  activeView,
  isDirty,
  onViewChange,
  onSaveConfirmed,
  onSaveAsNew,
  onRevert,
  onManageViews,
}: Props) {
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showSaveAsInput, setShowSaveAsInput] = useState(false);

  function handleSaveAsNew(name: string) {
    setShowSaveAsInput(false);
    onSaveAsNew(name);
  }

  return (
    <div className="flex items-center gap-2">
      {showSaveAsInput ? (
        <ViewSaveAsInput
          existingNames={views.map((v) => v.name)}
          onCommit={handleSaveAsNew}
          onCancel={() => setShowSaveAsInput(false)}
        />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              {activeView.name}
              {isDirty && (
                <span
                  className="text-[10px] text-amber-500"
                  title="Modified — unsaved changes"
                >
                  ●
                </span>
              )}
              <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {views.map((v) => (
              <DropdownMenuItem
                key={v.viewId}
                onSelect={() => onViewChange(v)}
                className={v.viewId === activeView.viewId ? "font-medium" : ""}
              >
                {v.name}
                {v.viewId === activeView.viewId && (
                  <span className="ml-auto text-xs text-muted-foreground">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onManageViews}
              className="text-xs text-muted-foreground/80 italic"
            >
              Manage Views…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isDirty && !showSaveAsInput && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setShowSaveConfirm(true)}
          >
            <SaveIcon className="h-3 w-3" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setShowSaveAsInput(true)}
          >
            <PlusIcon className="h-3 w-3" />
            Save as new
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={onRevert}
          >
            <RotateCcwIcon className="h-3 w-3" />
            Revert
          </Button>
        </div>
      )}

      <ViewSaveConfirmation
        viewName={activeView.name}
        open={showSaveConfirm}
        onConfirm={() => {
          setShowSaveConfirm(false);
          onSaveConfirmed();
        }}
        onCancel={() => setShowSaveConfirm(false)}
      />
    </div>
  );
}
