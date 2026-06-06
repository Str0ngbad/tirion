import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssemblyIdentityBandProps {
  partId: number;
  partNumber: string;
  partName: string;
  directChildCount: number;
}

export function AssemblyIdentityBand({
  partId,
  partNumber,
  partName,
  directChildCount,
}: AssemblyIdentityBandProps) {
  return (
    <div className="shrink-0 border-b bg-muted/20 px-4 py-3 flex items-center gap-3">
      <span className="font-mono text-base font-semibold">{partNumber}</span>
      <span className="text-sm text-muted-foreground">{partName}</span>
      <Badge variant="secondary">Assembly</Badge>
      <span className="text-xs text-muted-foreground">
        {directChildCount} direct component{directChildCount === 1 ? "" : "s"}
      </span>

      <Link
        href={`/parts`}
        data-part-id={partId}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        Open in Parts Master
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
