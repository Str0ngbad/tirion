import { MockReferencingPart } from "../_data";

type Props = {
  parts: MockReferencingPart[];
};

export default function EditTimeStockView({ parts }: Props) {
  const withStock = [...parts]
    .filter((p) => p.stockOnHand > 0)
    .sort((a, b) => b.stockOnHand - a.stockOnHand);

  if (withStock.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No entries.</p>;
  }

  return (
    <div className="w-full max-w-3xl">
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
          {withStock.map((p) => (
            <tr key={p.partId} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-4 font-mono text-xs text-foreground">{p.partNumber}</td>
              <td className="py-2 pr-4 text-xs text-foreground">{p.partName}</td>
              <td className="py-2 text-right text-xs font-semibold text-foreground">
                {p.stockOnHand}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Existing stock may not conform to the updated template. Review and reconcile as needed.
      </p>
    </div>
  );
}
