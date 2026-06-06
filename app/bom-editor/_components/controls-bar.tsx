import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ControlsBarProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function ControlsBar({ onExpandAll, onCollapseAll }: ControlsBarProps) {
  return (
    <div className="shrink-0 border-b bg-background px-4 py-2 flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onExpandAll}>
        <ChevronsUpDown className="h-3 w-3 mr-1" />
        Expand All
      </Button>
      <Button variant="ghost" size="sm" onClick={onCollapseAll}>
        Collapse All
      </Button>
    </div>
  );
}
