import { AlertTriangle, Clock } from "lucide-react";
import type { Freshness } from "@/lib/bom/rollup-helpers";

interface FreshnessIndicatorProps {
  freshness: Freshness;
  isAssembly: boolean;
}

export function FreshnessIndicator({ freshness, isAssembly }: FreshnessIndicatorProps) {
  if (freshness === "ok") return null;

  if (freshness === "missing") {
    const tooltip = isAssembly
      ? "One or more components has no cost set"
      : "No cost set";
    return (
      <span title={tooltip}>
        <AlertTriangle className="h-3 w-3 text-amber-500" strokeWidth={2.5} />
      </span>
    );
  }

  const tooltip = isAssembly
    ? "One or more components has a cost older than 18 months"
    : "Cost data is older than 18 months";
  return (
    <span title={tooltip}>
      <Clock className="h-3 w-3 text-muted-foreground" strokeWidth={2.5} />
    </span>
  );
}
