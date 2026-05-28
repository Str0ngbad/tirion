import { MockMaterialSpec } from "../_data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SortKey = "materialName" | "form" | "usedByCount";

type Props = {
  specs: MockMaterialSpec[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  onRowClick: (spec: MockMaterialSpec) => void;
};

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/30">↕</span>;
  return <span className="ml-1 text-muted-foreground">{asc ? "↑" : "↓"}</span>;
}

function Th({
  label,
  sortCol,
  align = "left",
  activeSortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  sortCol?: SortKey;
  align?: "left" | "right" | "center";
  activeSortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const headClass = `px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none ${alignClass}`;

  if (sortCol) {
    return (
      <TableHead
        className={`${headClass} cursor-pointer hover:text-foreground transition-colors`}
        onClick={() => onSort(sortCol)}
      >
        {label}
        <SortIcon active={activeSortKey === sortCol} asc={sortAsc} />
      </TableHead>
    );
  }
  return <TableHead className={headClass}>{label}</TableHead>;
}

export default function MaterialSpecGrid({
  specs,
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
              label="Material Name"
              sortCol="materialName"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
            />
            <Th
              label="Form"
              sortCol="form"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
            />
            <Th
              label="Used By"
              sortCol="usedByCount"
              align="right"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
            />
            <Th
              label="Active"
              align="center"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card/30">
          {specs.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="px-4 py-10 text-center text-xs text-muted-foreground"
              >
                No material specs found.
              </TableCell>
            </TableRow>
          )}
          {specs.map((s) => (
            <TableRow
              key={s.materialSpecId}
              onClick={() => onRowClick(s)}
              className={`cursor-pointer ${s.isActive ? "" : "opacity-40 hover:opacity-60"}`}
            >
              <TableCell className="px-3 py-2.5">
                <span className="font-medium text-foreground">{s.materialName}</span>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-muted-foreground">{s.form}</TableCell>
              <TableCell className="px-3 py-2.5 text-right">
                {s.usedByCount > 0 ? (
                  <span className="font-medium text-foreground">{s.usedByCount}</span>
                ) : (
                  <span className="text-muted-foreground/40">0</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-center">
                {s.isActive ? (
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
