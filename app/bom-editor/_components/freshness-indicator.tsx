import { AlertTriangle, Clock } from "lucide-react";
import type { Freshness } from "@/lib/bom/rollup-helpers";

export function FreshnessIndicator({ freshness }: { freshness: Freshness }) {
  if (freshness === "ok") return null;

  if (freshness === "missing") {
    return (
      <span title="One or more components has no cost set">
        <AlertTriangle className="h-3 w-3 text-amber-500" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span title="One or more components has a cost older than 6 months">
      <Clock className="h-3 w-3 text-muted-foreground" strokeWidth={2.5} />
    </span>
  );
}
