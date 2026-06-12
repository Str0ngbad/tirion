"use client";

import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ValidationFailure } from "@/lib/api/projects";

type Props = {
  failures: ValidationFailure[];
  onReturnToEditor: () => void;
};

const REASON_LABELS: Record<ValidationFailure["failureType"], string> = {
  "no-template":       "No routing template assigned",
  "template-inactive": "Routing template is inactive",
  "part-inactive":     "Part is inactive",
};

function deepLinkFor(failure: ValidationFailure): { href: string; label: string } {
  switch (failure.failureType) {
    case "no-template":
      return { href: `/parts/${failure.partId}?section=routing`, label: "Open Part → Routing section" };
    case "template-inactive":
      return {
        href: failure.templateId ? `/routing-templates/${failure.templateId}` : "#",
        label: "Open Routing Template Editor",
      };
    case "part-inactive":
      return { href: `/parts/${failure.partId}`, label: "Open Part form" };
    default:
      return { href: "#", label: "View" };
  }
}

export function CompileFailureScreen({ failures, onReturnToEditor }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Failure header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-destructive/30 bg-destructive/5 px-6 py-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h2 className="text-sm font-semibold text-destructive">
            Compilation cancelled — {failures.length} validation{" "}
            {failures.length === 1 ? "issue" : "issues"} must be resolved
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            No Work Orders were created. Fix the issues below and compile again.
          </p>
        </div>
      </div>

      {/* Failure list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-3">
          {failures.map((failure, idx) => {
            const link = deepLinkFor(failure);
            const bomBreadcrumb = failure.bomPath.join(" → ");
            return (
              <div
                key={`${failure.partId}-${idx}`}
                className="rounded-md border border-destructive/20 bg-background p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {failure.partNumber}
                      </span>
                      <span className="truncate text-sm font-medium">{failure.partName}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-destructive">
                      {REASON_LABELS[failure.failureType]}
                      {failure.failureType === "template-inactive" && failure.templateName && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({failure.templateName})
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Path: {bomBreadcrumb}
                    </p>
                  </div>
                  <a
                    href={link.href}
                    className="flex shrink-0 items-center gap-1 rounded border border-border px-2 py-1 text-xs text-primary transition-colors hover:bg-muted whitespace-nowrap"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {link.label}
                  </a>
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
