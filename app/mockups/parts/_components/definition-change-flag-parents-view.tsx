import { MockParentAssemblyRef } from "../_data";

type Props = {
  parents: MockParentAssemblyRef[];
};

export default function DefinitionChangeFlagParentsView({ parents }: Props) {
  const sorted = [...parents].sort((a, b) => a.partNumber.localeCompare(b.partNumber));

  if (sorted.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No entries.</p>;
  }

  return (
    <div className="w-full max-w-2xl">
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
              Qty Used
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.assemblyPartId} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-4 font-mono text-xs text-foreground">{p.partNumber}</td>
              <td className="py-2 pr-4 text-xs text-foreground">{p.partName}</td>
              <td className="py-2 text-right text-xs font-semibold text-foreground">
                {p.quantityInParent}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
