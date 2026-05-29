import { PROCESS_TYPE_META, ProcessTypeKey } from "../_data";

type Props = {
  processType: ProcessTypeKey;
};

export default function ProcessTypeChip({ processType }: Props) {
  const meta = PROCESS_TYPE_META[processType];
  return (
    <span className="relative inline-flex items-center overflow-hidden rounded-sm border border-border/50 bg-card text-xs text-foreground">
      <span
        className="absolute inset-0"
        style={{ backgroundColor: `var(${meta.cssVar})` }}
      />
      <span className="absolute inset-0 left-1 rounded-l-sm bg-card" />
      <span className="relative pl-2 pr-1.5 py-0.5 leading-none">{meta.label}</span>
    </span>
  );
}
