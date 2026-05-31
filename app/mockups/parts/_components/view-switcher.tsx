"use client";

import type { View } from "../_lib/views";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";

type Props = {
  views: View[];
  activeView: View;
  onViewChange: (view: View) => void;
};

export default function ViewSwitcher({ views, activeView, onViewChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          {activeView.name}
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
        <DropdownMenuItem disabled className="italic text-muted-foreground/60 text-xs">
          Manage Views…
          <span className="ml-auto not-italic">Coming soon</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
