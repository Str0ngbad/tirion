import { MockVendor } from "../_data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SortKey =
  | "vendorName"
  | "leadTimeDays"
  | "defaultVendorForCount"
  | "openSupplyOrderCount";

type Props = {
  vendors: MockVendor[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  onRowClick: (vendor: MockVendor) => void;
};

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/30">↕</span>;
  return <span className="ml-1 text-muted-foreground">{asc ? "↑" : "↓"}</span>;
}

function Th({
  label,
  sortCol,
  align = "left",
  exploratory = false,
  activeSortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  sortCol?: SortKey;
  align?: "left" | "right" | "center";
  exploratory?: boolean;
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
        {exploratory && (
          <span className="ml-0.5 font-normal normal-case tracking-normal text-muted-foreground/40">*</span>
        )}
        <SortIcon active={activeSortKey === sortCol} asc={sortAsc} />
      </TableHead>
    );
  }
  return (
    <TableHead className={headClass}>
      {label}
      {exploratory && (
        <span className="ml-0.5 font-normal normal-case tracking-normal text-muted-foreground/40">*</span>
      )}
    </TableHead>
  );
}

export default function VendorGrid({ vendors, sortKey, sortAsc, onSort, onRowClick }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card">
            <Th label="Vendor Name" sortCol="vendorName" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Contact Info" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Lead Time (Days)" sortCol="leadTimeDays" align="right" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Default Vendor For" sortCol="defaultVendorForCount" align="right" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Open Supply Orders" sortCol="openSupplyOrderCount" align="right" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Website" exploratory activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Location" exploratory activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Active" align="center" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card/30">
          {vendors.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                No vendors found.
              </TableCell>
            </TableRow>
          )}
          {vendors.map((v) => (
            <TableRow
              key={v.vendorId}
              onClick={() => onRowClick(v)}
              className={`cursor-pointer ${v.isActive ? "" : "opacity-40 hover:opacity-60"}`}
            >
              <TableCell className="px-3 py-2.5">
                <span className="font-medium text-foreground">{v.vendorName}</span>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-muted-foreground">
                {v.contactInfo ?? <span className="text-muted-foreground/40">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right text-foreground">
                {v.leadTimeDays !== null ? v.leadTimeDays : <span className="text-muted-foreground/40">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right">
                {v.defaultVendorForCount > 0 ? (
                  <span className="font-medium text-foreground">{v.defaultVendorForCount}</span>
                ) : (
                  <span className="text-muted-foreground/40">0</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right">
                {v.openSupplyOrderCount > 0 ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-blue-950 px-2 py-0.5 text-xs font-medium text-blue-300">
                    {v.openSupplyOrderCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">0</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                {v.website ?? <span className="text-muted-foreground/40">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                {v.location ?? <span className="text-muted-foreground/40">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-center">
                {v.isActive ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="Inactive" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t border-border bg-card px-3 py-1.5">
        <p className="text-xs text-muted-foreground/50">
          * Exploratory — not in Rev 1 spec; present for design validation
        </p>
      </div>
    </div>
  );
}
