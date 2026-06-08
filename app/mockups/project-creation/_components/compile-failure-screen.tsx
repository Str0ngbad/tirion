"use client";

import { AlertTriangle, ExternalLink, ArrowLeft } from "lucide-react";
import { NodeValidation, ValidationResultFail } from "../_lib/validation";
import { Button } from "@/components/ui/button";

type Props = {
  failures: NodeValidation[];
  onReturnToEditor: () => void;
};

const REASON_LABELS: Record<string, string> = {
  "no-template":       "No routing template assigned",
  "template-inactive": "Routing template is inactive",
  "part-inactive":     "Part is inactive",
  "circular":          "Circular BOM reference",
};

export default function CompileFailureScreen({ failures, onReturnToEditor }: Props) {
  const count = failures.length;

  function getDeepLink(node: NodeValidation): { href: string; label: string; isDeadEnd?: boolean } {
    if (node.result.status !== "fail") return { href: "#", label: "View" };
    const fail = node.result as ValidationResultFail;
    switch (fail.reason) {
      case "no-template":
        return { href: `/mockups/parts?partId=${node.partId}`, label: "Open Part form → Routing Template section" };
      case "template-inactive":
        return { href: "#", label: "Open Routing Template Editor", isDeadEnd: true };
      case "part-inactive":
        return { href: `/mockups/parts?partId=${node.partId}`, label: "Open Part form" };
      case "circular":
        return { href: `/mockups/bom-editor/${node.partId}`, label: "Open BOM Editor" };
      default:
        return { href: "#", label: "View" };
    }
  }

  function formatPath(path: string[]): string {
    return path.join(" → ");
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-destructive/30 bg-destructive/5 px-6 py-4">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-destructive">
            Compilation cancelled — {count} validation {count === 1 ? "issue" : "issues"} must be resolved
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            No Work Orders were created. Fix the issues below and compile again.
          </p>
        </div>
      </div>

      {/* Failure list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-3">
          {failures.map((node, idx) => {
            const link = getDeepLink(node);
            return (
              <div
                key={`${node.partId}-${idx}`}
                className="rounded-md border border-destructive/20 bg-background p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {node.partNumber}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {node.partName}
                      </span>
                    </div>
                    {node.result.status === "fail" && (
                      <div className="mt-1 text-xs text-destructive font-medium">
                        {REASON_LABELS[node.result.reason] ?? node.result.reason}
                        {node.result.reason === "template-inactive" && node.result.templateName && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({node.result.templateName})
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Path: {formatPath(node.path)}
                    </div>
                  </div>

                  {/* Deep link */}
                  {link.isDeadEnd ? (
                    <span className="shrink-0 text-xs text-muted-foreground/60 italic whitespace-nowrap">
                      Routing Template Editor<br />— not yet built
                    </span>
                  ) : (
                    <a
                      href={link.href}
                      className="flex shrink-0 items-center gap-1 rounded border border-border px-2 py-1 text-xs text-primary hover:bg-muted transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {link.label}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border bg-background px-6 py-3">
        <Button variant="outline" onClick={onReturnToEditor} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Return to Editor
        </Button>
      </div>
    </div>
  );
}
