import { MockParentAssemblyRef } from "../_data";

type Props = {
  parentAssemblies: MockParentAssemblyRef[];
  onNavigate: (partId: number) => void;
};

export default function PartFormParentAssembliesSection({ parentAssemblies, onNavigate }: Props) {
  if (parentAssemblies.length === 0) {
    return <p className="text-sm text-muted-foreground">Not used in any assemblies.</p>;
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
        {parentAssemblies.map((p) => (
          <tr
            key={p.assemblyPartId}
            onClick={() => onNavigate(p.assemblyPartId)}
            className="cursor-pointer rounded transition-colors hover:bg-muted/50"
          >
            <td className="py-1.5 pr-3 font-mono text-xs">{p.partNumber}</td>
            <td className="max-w-[8rem] truncate py-1.5 pr-2 text-xs">{p.partName}</td>
            <td className="py-1.5 text-right text-xs">{p.quantityInParent}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
