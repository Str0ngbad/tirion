import { MockChildPartRef } from "../_data";
import { useTruncatedTitle } from "@/app/_lib/use-truncated-title";

type Props = {
  childParts: MockChildPartRef[];
  onNavigate: (partId: number) => void;
};

function ChildNameCell({ name }: { name: string }) {
  const { ref, title } = useTruncatedTitle<HTMLSpanElement>(name);
  return (
    <span ref={ref} title={title} className="block truncate">
      {name}
    </span>
  );
}

export default function PartFormChildPartsSection({ childParts, onNavigate }: Props) {
  if (childParts.length === 0) {
    return <p className="text-sm text-muted-foreground">No child parts defined.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-xs text-muted-foreground">
          <th className="pb-1.5 text-left font-medium">Part Number</th>
          <th className="pb-1.5 text-left font-medium">Part Name</th>
          <th className="pb-1.5 text-right font-medium">Qty</th>
        </tr>
      </thead>
      <tbody>
        {childParts.map((c) => (
          <tr
            key={c.childPartId}
            onClick={() => onNavigate(c.childPartId)}
            className="cursor-pointer rounded transition-colors hover:bg-muted/50"
          >
            <td className="py-1.5 pr-3 font-mono text-xs">{c.childPartNumber}</td>
            <td className="max-w-[8rem] py-1.5 pr-2 text-xs">
              <ChildNameCell name={c.childPartName} />
            </td>
            <td className="py-1.5 text-right text-xs">{c.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
