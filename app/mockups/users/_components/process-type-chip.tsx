import { PROCESS_TYPE_META, ProcessTypeKey } from "../_data";

type Props = {
  processType: ProcessTypeKey;
  compact?: boolean;
};

export default function ProcessTypeChip({ processType, compact = false }: Props) {
  const meta = PROCESS_TYPE_META[processType];

  if (compact) {
    return (
      <span
        className="inline-block h-5 w-5 shrink-0 rounded-sm"
        style={{ backgroundColor: `var(${meta.cssVar})` }}
        title={meta.label}
        aria-label={meta.label}
      />
    );
  }

  return (
    <span className="relative inline-flex items-center overflow-hidden rounded-sm border border-border/50 bg-card text-sm text-foreground">
      <span
        className="absolute inset-0"
        style={{ backgroundColor: `var(${meta.cssVar})` }}
      />
      <span className="absolute inset-0 left-[5px] rounded-l-sm bg-card" />
      <span className="relative pl-2.5 pr-1.5 py-0.5 leading-none">{meta.label}</span>
    </span>
  );
}
