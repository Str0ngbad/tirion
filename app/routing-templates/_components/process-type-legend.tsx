import { ALL_PROCESS_TYPES } from "@/lib/process-types";
import ProcessTypeChip from "@/components/process-type-chip";

interface ProcessTypeLegendProps {
  rightSlot?: React.ReactNode;
}

export default function ProcessTypeLegend({ rightSlot }: ProcessTypeLegendProps) {
  return (
    <div className="border-b border-border bg-muted/20 px-8 py-3">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {ALL_PROCESS_TYPES.map((pt) => (
              <ProcessTypeChip key={pt} processType={pt} />
            ))}
          </div>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Process type identity. The colored pills in each template&apos;s step sequence reference
          these.
        </p>
      </div>
    </div>
  );
}
