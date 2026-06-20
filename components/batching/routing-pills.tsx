import type { RoutingStep } from "@/lib/batching/types";

type Props = {
  steps: RoutingStep[];
  activeStepIndex: number | null;
};

export function RoutingPills({ steps, activeStepIndex }: Props) {
  if (steps.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <div className="flex flex-nowrap gap-1">
      {steps.map((step, idx) => {
        const isActive = activeStepIndex !== null && idx === activeStepIndex;
        return (
          <span
            key={step.stepIndex}
            className={[
              "inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium",
              isActive
                ? "border-foreground/40 bg-white text-black"
                : "border-border bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {step.processTypeName}
          </span>
        );
      })}
    </div>
  );
}
