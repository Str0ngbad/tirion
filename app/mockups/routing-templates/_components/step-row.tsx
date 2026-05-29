import { MockTemplateStep } from "../_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import { Button } from "@/components/ui/button";
import { ChevronUpIcon, ChevronDownIcon, XIcon } from "lucide-react";

type Props = {
  step: MockTemplateStep;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export default function StepRow({
  step,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Props) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {step.stepNumber}
      </span>
      <div className="flex-1">
        <ProcessTypeChip processType={step.processType} />
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isFirst}
          onClick={onMoveUp}
          aria-label="Move step up"
        >
          <ChevronUpIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={onMoveDown}
          aria-label="Move step down"
        >
          <ChevronDownIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
          aria-label="Remove step"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
