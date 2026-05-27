import { MockVendor } from "../_data";

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
  if (!active) return <span className="ml-1 text-zinc-700">↕</span>;
  return <span className="ml-1 text-zinc-400">{asc ? "↑" : "↓"}</span>;
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
  const base =
    "px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500 select-none";

  if (sortCol) {
    return (
      <th
        className={`${base} ${alignClass} cursor-pointer hover:text-zinc-300 transition-colors`}
        onClick={() => onSort(sortCol)}
      >
        {label}
        {exploratory && <span className="ml-0.5 font-normal normal-case tracking-normal text-zinc-700">*</span>}
        <SortIcon active={activeSortKey === sortCol} asc={sortAsc} />
      </th>
    );
  }
  return (
    <th className={`${base} ${alignClass}`}>
      {label}
      {exploratory && <span className="ml-0.5 font-normal normal-case tracking-normal text-zinc-700">*</span>}
    </th>
  );
}

export default function VendorGrid({ vendors, sortKey, sortAsc, onSort, onRowClick }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <Th label="Vendor Name" sortCol="vendorName" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Contact Info" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Lead Time (Days)" sortCol="leadTimeDays" align="right" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Default Vendor For" sortCol="defaultVendorForCount" align="right" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Open Supply Orders" sortCol="openSupplyOrderCount" align="right" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Website" exploratory activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Location" exploratory activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Active" align="center" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
          {vendors.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-xs text-zinc-600">
                No vendors found.
              </td>
            </tr>
          )}
          {vendors.map((v) => (
            <tr
              key={v.vendorId}
              onClick={() => onRowClick(v)}
              className={`cursor-pointer transition-colors ${
                v.isActive
                  ? "hover:bg-zinc-800/50"
                  : "opacity-40 hover:opacity-60"
              }`}
            >
              <td className="px-3 py-2.5">
                <span className="font-medium text-zinc-100">{v.vendorName}</span>
              </td>
              <td className="px-3 py-2.5 text-zinc-400">
                {v.contactInfo ?? <span className="text-zinc-700">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right text-zinc-300">
                {v.leadTimeDays !== null ? v.leadTimeDays : <span className="text-zinc-700">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right">
                {v.defaultVendorForCount > 0 ? (
                  <span className="font-medium text-zinc-200">{v.defaultVendorForCount}</span>
                ) : (
                  <span className="text-zinc-700">0</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                {v.openSupplyOrderCount > 0 ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-blue-950 px-2 py-0.5 text-xs font-medium text-blue-300">
                    {v.openSupplyOrderCount}
                  </span>
                ) : (
                  <span className="text-zinc-700">0</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs text-zinc-500">
                {v.website ?? <span className="text-zinc-700">—</span>}
              </td>
              <td className="px-3 py-2.5 text-xs text-zinc-500">
                {v.location ?? <span className="text-zinc-700">—</span>}
              </td>
              <td className="px-3 py-2.5 text-center">
                {v.isActive ? (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-green-500"
                    title="Active"
                  />
                ) : (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-zinc-600"
                    title="Inactive"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-1.5">
        <p className="text-xs text-zinc-700">
          * Exploratory — not in Rev 1 spec; present for design validation
        </p>
      </div>
    </div>
  );
}
