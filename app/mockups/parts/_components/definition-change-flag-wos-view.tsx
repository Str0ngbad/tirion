import { MockOpenWo } from "../_data";
import { Badge } from "@/components/ui/badge";

type Props = {
  wos: MockOpenWo[];
};

export default function DefinitionChangeFlagWosView({ wos }: Props) {
  const sorted = [...wos].sort((a, b) => {
    const proj = a.projectReference.localeCompare(b.projectReference);
    if (proj !== 0) return proj;
    return a.woNumber.localeCompare(b.woNumber);
  });

  if (sorted.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No entries.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            WO Number
          </th>
          <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project
          </th>
          <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Top-Level
          </th>
          <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Part
          </th>
          <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step
          </th>
          <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </th>
          <th className="py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Batch
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((wo) => (
          <tr key={wo.woId} className="border-b border-border/50 last:border-0">
            <td className="py-2 pr-3 font-mono text-xs text-foreground">{wo.woNumber}</td>
            <td
              className="px-2 py-2 pr-3 text-xs text-foreground"
              style={{ backgroundColor: `${wo.projectColor}26` }}
            >
              {wo.projectReference}
            </td>
            <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
              {wo.topLevelReference}
            </td>
            <td className="py-2 pr-3 font-mono text-xs text-foreground">{wo.partNumber}</td>
            <td className="py-2 pr-3 text-xs text-muted-foreground">{wo.currentStep}</td>
            <td className="py-2 pr-3 text-xs text-muted-foreground">{wo.status}</td>
            <td className="py-2">
              {wo.batchContext ? (
                <Badge variant="secondary" className="text-[10px]">
                  {wo.batchContext}
                </Badge>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
