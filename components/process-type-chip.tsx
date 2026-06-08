import { PROCESS_TYPE_META, type ProcessTypeKey } from "@/lib/process-types";

type ProcessTypeChipSize = "sm" | "lg";

type Props = {
  processType: ProcessTypeKey;
  compact?: boolean;
  size?: ProcessTypeChipSize;
  /** When false, renders the full process type name instead of the abbreviated meta label.
   *  Useful for lg-size chips in section headers where space permits the full name.
   *  Defaults to true (abbreviated). */
  abbreviate?: boolean;
};

export default function ProcessTypeChip({ processType, compact = false, size = "sm", abbreviate = true }: Props) {
  const meta = PROCESS_TYPE_META[processType];
  const label = abbreviate ? meta.label : processType;

  if (compact) {
    return (
      <span
        className="inline-block h-5 w-[16px] shrink-0 rounded-sm"
        style={{ backgroundColor: `var(${meta.cssVar})` }}
        title={label}
        aria-label={label}
      />
    );
  }

  // Size-dependent classes
  // sm (default): existing inline treatment
  // lg: slightly more padding for section header use
  const labelClasses =
    size === "lg"
      ? "relative pl-3 pr-2 py-1 leading-none font-medium"
      : "relative pl-2.5 pr-1.5 py-0.5 leading-none";

  // The colored stripe width scales with size
  const stripeOffset = size === "lg" ? "left-[6px]" : "left-[5px]";

  const textClass = size === "lg" ? "text-sm" : "text-sm";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center overflow-hidden rounded-sm border border-border/50 bg-card ${textClass} text-foreground`}
    >
      <span
        className="absolute inset-0"
        style={{ backgroundColor: `var(${meta.cssVar})` }}
      />
      <span className={`absolute inset-0 ${stripeOffset} rounded-l-sm bg-card`} />
      <span className={labelClasses}>{label}</span>
    </span>
  );
}
