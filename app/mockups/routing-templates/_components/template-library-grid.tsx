import { MockTemplate } from "../_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TemplateSortKey = "templateName" | "stepCount" | "partsReferencingCount";

type Props = {
  templates: MockTemplate[];
  sortKey: TemplateSortKey;
  sortAsc: boolean;
  onSort: (key: TemplateSortKey) => void;
  onRowClick: (template: MockTemplate) => void;
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

export default function TemplateLibraryGrid({
  templates,
  sortKey,
  sortAsc,
  onSort,
  onRowClick,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card">
            <Th
              label="Template Name"
              sortCol="templateName"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
            />
            <Th
              label="Description"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="max-w-xs"
            />
            <Th
              label="Steps"
              sortCol="stepCount"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
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
            />
            <TableHead className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card/30">
          {templates.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="px-4 py-10 text-center text-xs text-muted-foreground"
              >
                No templates found.
              </TableCell>
            </TableRow>
          )}
          {templates.map((t) => (
            <TableRow
              key={t.templateId}
              onClick={() => onRowClick(t)}
              className={`cursor-pointer ${t.isActive ? "" : "opacity-40 hover:opacity-60"}`}
            >
              <TableCell className="px-3 py-2.5">
                <span className="font-medium text-foreground">{t.templateName}</span>
              </TableCell>
              <TableCell className="max-w-xs px-3 py-2.5">
                {t.description ? (
                  <span className="line-clamp-1 text-sm text-muted-foreground">
                    {t.description}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                {t.steps.length === 0 ? (
                  <span className="text-xs text-muted-foreground/40">—</span>
                ) : (
                  `${t.steps.length} ${t.steps.length === 1 ? "step" : "steps"}`
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5">
                {t.steps.length === 0 ? (
                  <span className="text-xs text-muted-foreground/40">No steps</span>
                ) : (
                  <div className="flex items-center gap-0.5">
                    {t.steps.map((s) => (
                      <ProcessTypeChip key={s.stepId} processType={s.processType} compact />
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                {t.partsReferencingCount}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-center">
                {t.isActive ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
                ) : (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40"
                    title="Inactive"
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
