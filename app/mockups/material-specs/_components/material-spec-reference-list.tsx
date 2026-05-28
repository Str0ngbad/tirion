import { MockReferencingPart } from "../_data";

type Props = {
  parts: MockReferencingPart[];
  usedByCount: number;
  materialSpecId: number;
};

export default function MaterialSpecReferenceList({ parts, usedByCount, materialSpecId }: Props) {
  const hasMore = usedByCount > parts.length;

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Referenced By ({usedByCount} {usedByCount === 1 ? "part" : "parts"})
      </div>
      {parts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active parts reference this material spec.</p>
      ) : (
        <div className="space-y-1">
          {parts.map((part) => (
            <button
              key={part.partId}
              onClick={() =>
                console.log(`[mockup] navigate to part ${part.partId} (${part.partNumber})`)
              }
              className="group flex w-full items-center gap-2.5 rounded-md border border-border bg-card/30 px-3 py-2 text-left transition-colors hover:bg-card/60"
            >
              <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
                {part.partNumber}
              </span>
              <span className="text-sm text-foreground">{part.partName}</span>
              <span className="ml-auto text-xs text-muted-foreground/40 group-hover:text-muted-foreground">
                →
              </span>
            </button>
          ))}
          {hasMore && (
            <button
              onClick={() =>
                console.log(`[mockup] view all parts for materialSpecId: ${materialSpecId}`)
              }
              className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all {usedByCount} in Parts Master →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
