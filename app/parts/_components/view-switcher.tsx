"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { ViewRow } from "@/lib/api/views";

type Props = {
  views: ViewRow[];
  activeViewId: number | null;
  isDirty: boolean;
  onSelectView: (viewId: number) => void;
  onOpenManage: () => void;
};

export default function ViewSwitcher({
  views,
  activeViewId,
  isDirty,
  onSelectView,
  onOpenManage,
}: Props) {
  const activeView = views.find((v) => v.viewId === activeViewId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-sm">
          {isDirty && (
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Unsaved changes" />
          )}
          <span>{activeView?.name ?? "Select view"}</span>
          <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {views.map((view) => (
          <DropdownMenuItem
            key={view.viewId}
            onClick={() => onSelectView(view.viewId)}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>{view.name}</span>
            {view.viewId === activeViewId && (
              <CheckIcon className="h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onOpenManage}
          className="text-sm italic text-muted-foreground"
        >
          Manage Views…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
