"use client";

import { type RoutingTemplateRow } from "@/lib/routing-templates/types";
import { type ProcessTypeKey } from "@/lib/process-types";
import ProcessTypeChip from "@/components/process-type-chip";
import { useTruncatedTitle } from "@/app/_lib/use-truncated-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal } from "lucide-react";

export type TemplateSortKey = "templateName" | "stepCount" | "partsReferencingCount";

type Props = {
  templates: RoutingTemplateRow[];
  sortKey: TemplateSortKey;
  sortAsc: boolean;
  onSort: (key: TemplateSortKey) => void;
  condensed: boolean;
  onRetire: (template: RoutingTemplateRow) => void;
  onReactivate: (template: RoutingTemplateRow) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetryError?: () => void;
};

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/30">↕</span>;
  return <span className="ml-1 text-muted-foreground">{asc ? "↑" : "↓"}</span>;
}

function Th({
  label,
  sortCol,
  activeSortKey,
  sortAsc,
  onSort,
  className,
}: {
  label: string;
  sortCol?: TemplateSortKey;
  activeSortKey: TemplateSortKey;
  sortAsc: boolean;
  onSort: (key: TemplateSortKey) => void;
  className?: string;
}) {
  const base =
    "px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none text-left";
  if (sortCol) {
    return (
      <TableHead
        className={`${base} cursor-pointer hover:text-foreground transition-colors ${className ?? ""}`}
        onClick={() => onSort(sortCol)}
      >
        {label}
        <SortIcon active={activeSortKey === sortCol} asc={sortAsc} />
      </TableHead>
    );
  }
  return <TableHead className={`${base} ${className ?? ""}`}>{label}</TableHead>;
}

function TruncatedCell({ text, className }: { text: string; className?: string }) {
  const { ref, title } = useTruncatedTitle<HTMLSpanElement>(text);
  return (
    <span ref={ref} title={title} className={`block truncate ${className ?? ""}`}>
      {text}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="px-3 py-2.5">
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell className="px-3 py-2.5">
            <Skeleton className="h-4 w-64" />
          </TableCell>
          <TableCell className="px-3 py-2.5">
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell className="px-3 py-2.5">
            <div className="flex gap-0.5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </TableCell>
          <TableCell className="px-3 py-2.5">
            <Skeleton className="h-4 w-8" />
          </TableCell>
          <TableCell className="px-3 py-2.5">
            <Skeleton className="mx-auto h-2 w-2 rounded-full" />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

export default function TemplateLibraryGrid({
  templates,
  sortKey,
  sortAsc,
  onSort,
  condensed,
  onRetire,
  onReactivate,
  isLoading,
  error,
  onRetryError,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {error && (
        <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
          <span>{error}</span>
          {onRetryError && (
            <button
              onClick={onRetryError}
              className="ml-4 underline underline-offset-2 hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card">
            <Th
              label="Template Name"
              sortCol="templateName"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="min-w-[200px] max-w-[280px]"
            />
            <Th
              label="Description"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="min-w-[200px] max-w-[400px]"
            />
            <Th
              label="Steps"
              sortCol="stepCount"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="w-20"
            />
            <Th
              label="Sequence"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
            />
            <Th
              label="Parts"
              sortCol="partsReferencingCount"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="w-20"
            />
            <TableHead className="w-16 px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active
            </TableHead>
            <TableHead className="w-10 px-1 py-2.5" />
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card/30">
          {isLoading && <SkeletonRows />}
          {!isLoading && !error && templates.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="px-4 py-10 text-center text-xs text-muted-foreground"
              >
                No templates found.
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            templates.map((t) => (
              <TableRow
                key={t.routingTemplateDefinitionId}
                // Row click deferred — edit page lands in the next commit
                className={t.isActive ? "" : "opacity-40 hover:opacity-60"}
              >
                <TableCell className="min-w-[200px] max-w-[280px] px-3 py-2.5">
                  <TruncatedCell
                    text={t.templateName}
                    className="max-w-[280px] font-medium text-foreground"
                  />
                </TableCell>
                <TableCell className="min-w-[200px] max-w-[400px] px-3 py-2.5">
                  {t.description ? (
                    <TruncatedCell
                      text={t.description}
                      className="max-w-[400px] text-sm text-muted-foreground"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                <TableCell className="w-20 px-3 py-2.5 text-sm text-muted-foreground">
                  {t.stepCount === 0 ? (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  ) : (
                    `${t.stepCount} ${t.stepCount === 1 ? "step" : "steps"}`
                  )}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {t.steps.length === 0 ? (
                    <span className="text-xs text-muted-foreground/40">No steps</span>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      {t.steps.map((s) => (
                        <ProcessTypeChip
                          key={s.routingTemplateStepId}
                          processType={s.processTypeName as ProcessTypeKey}
                          compact={condensed}
                        />
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="w-20 px-3 py-2.5 text-sm text-muted-foreground">
                  {t.partsReferencingCount}
                </TableCell>
                <TableCell className="w-16 px-3 py-2.5 text-center">
                  {t.isActive ? (
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
                  ) : (
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40"
                      title="Inactive"
                    />
                  )}
                </TableCell>
                <TableCell className="w-10 px-1 py-2.5 text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground/40 hover:text-muted-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {t.isActive ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => onRetire(t)}
                        >
                          Retire Template
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => onReactivate(t)}>
                          Reactivate Template
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
