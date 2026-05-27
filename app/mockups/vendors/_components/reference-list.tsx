import { MockReferencingPart } from "../_data";

type Props = {
  parts: MockReferencingPart[];
};

export default function ReferenceList({ parts }: Props) {
  return (
    <div className="border-t border-zinc-800 pt-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
        Default Vendor For ({parts.length} {parts.length === 1 ? "part" : "parts"})
      </div>
      {parts.length === 0 ? (
        <p className="text-xs text-zinc-600">No parts reference this vendor as Default Vendor.</p>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto">
          {parts.map((part) => (
            <button
              key={part.partId}
              onClick={() => console.log(`[mockup] navigate to part ${part.partId} (${part.partNumber})`)}
              className="group flex w-full items-center gap-2.5 rounded-md border border-zinc-800 bg-zinc-800/30 px-3 py-2 text-left transition-colors hover:bg-zinc-800/60"
            >
              <span className="font-mono text-xs text-zinc-500 group-hover:text-zinc-400">
                {part.partNumber}
              </span>
              <span className="text-sm text-zinc-300 group-hover:text-zinc-200">
                {part.partName}
              </span>
              <span className="ml-auto text-xs text-zinc-700 group-hover:text-zinc-500">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
