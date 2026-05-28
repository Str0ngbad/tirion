import { MockReferencingPart } from "../_data";

type Props = {
  parts: MockReferencingPart[];
};

export default function ReferenceList({ parts }: Props) {
  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Default Vendor For ({parts.length} {parts.length === 1 ? "part" : "parts"})
      </div>
      {parts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No parts reference this vendor as Default Vendor.</p>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto">
          {parts.map((part) => (
            <button
              key={part.partId}
              onClick={() => console.log(`[mockup] navigate to part ${part.partId} (${part.partNumber})`)}
              className="group flex w-full items-center gap-2.5 rounded-md border border-border bg-card/30 px-3 py-2 text-left transition-colors hover:bg-card/60"
            >
              <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
                {part.partNumber}
              </span>
              <span className="text-sm text-foreground">
                {part.partName}
              </span>
              <span className="ml-auto text-xs text-muted-foreground/40 group-hover:text-muted-foreground">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
