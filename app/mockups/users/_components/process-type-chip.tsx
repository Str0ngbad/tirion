import { PROCESS_TYPE_META, ProcessTypeKey } from "../_data";

type Props = {
  processType: ProcessTypeKey;
};

export default function ProcessTypeChip({ processType }: Props) {
  const meta = PROCESS_TYPE_META[processType];
  return (
    <span className="inline-flex items-center overflow-hidden rounded-sm border border-border/50 bg-card/60 text-xs text-foreground">
      <span
        className="w-1.5 self-stretch flex-shrink-0"
        style={{ backgroundColor: `var(${meta.cssVar})` }}
      />
      <span className="px-1.5 py-0.5 leading-none">{meta.label}</span>
    </span>
  );
}
