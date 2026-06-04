"use client";

import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProcessTypeChip from "@/components/process-type-chip";
import { type ProcessTypeKey } from "@/lib/process-types";

interface StepRowProps {
  step: { stepId: number; stepNumber: number; processType: ProcessTypeKey };
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function StepRow({ step, isFirst, isLast, onMoveUp, onMoveDown, onRemove }: StepRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {step.stepNumber}
      </span>
      <div className="flex-1">
        <ProcessTypeChip processType={step.processType} compact={false} />
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveUp}
          disabled={isFirst}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveDown}
          disabled={isLast}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
