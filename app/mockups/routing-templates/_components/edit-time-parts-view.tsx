import { MockReferencingPart } from "../_data";

type Props = {
  parts: MockReferencingPart[];
};

export default function EditTimePartsView({ parts }: Props) {
  const sorted = [...parts].sort((a, b) => a.partNumber.localeCompare(b.partNumber));

  if (sorted.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No entries.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Part Number
          </th>
          <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Part Name
          </th>
          <th className="py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stock On Hand
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.partId} className="border-b border-border/50 last:border-0">
            <td className="py-2 pr-4 font-mono text-xs text-foreground">{p.partNumber}</td>
            <td className="py-2 pr-4 text-xs text-foreground">{p.partName}</td>
            <td className="py-2 text-right text-xs text-muted-foreground">
              {p.stockOnHand > 0 ? p.stockOnHand : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
