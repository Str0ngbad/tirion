import { MockUser } from "../_data";
import ProcessTypeChip from "./process-type-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type UserSortKey = "userName" | "displayName" | "role";

type Props = {
  users: MockUser[];
  sortKey: UserSortKey;
  sortAsc: boolean;
  onSort: (key: UserSortKey) => void;
  onRowClick: (user: MockUser) => void;
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
}: {
  label: string;
  sortCol?: UserSortKey;
  activeSortKey: UserSortKey;
  sortAsc: boolean;
  onSort: (key: UserSortKey) => void;
}) {
  const headClass =
    "px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none text-left";

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

export default function UserGrid({ users, sortKey, sortAsc, onSort, onRowClick }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card">
            <Th label="User Name" sortCol="userName" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Display Name" sortCol="displayName" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Role" sortCol="role" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Assigned Process Types" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <Th label="Default Station" activeSortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
            <TableHead className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">
              Active
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card/30">
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
                No users found.
              </TableCell>
            </TableRow>
          )}
          {users.map((u) => (
            <TableRow
              key={u.userId}
              onClick={() => onRowClick(u)}
              className={`cursor-pointer ${u.isActive ? "" : "opacity-40 hover:opacity-60"}`}
            >
              <TableCell className="px-3 py-2.5">
                <span className="font-mono text-sm text-foreground">@{u.userName}</span>
              </TableCell>
              <TableCell className="px-3 py-2.5">
                <span className="font-medium text-foreground">{u.displayName}</span>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                {u.role}
              </TableCell>
              <TableCell className="px-3 py-2.5">
                {u.role === "Manager" || u.role === "Admin" ? (
                  <span className="text-xs text-muted-foreground">All</span>
                ) : u.assignedProcessTypes.length === 0 ? (
                  <span className="text-xs text-muted-foreground/40">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {u.assignedProcessTypes.map((pt) => (
                      <ProcessTypeChip key={pt} processType={pt} />
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                {u.defaultStation ?? <span className="text-muted-foreground/40">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-center">
                {u.isActive ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="Inactive" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
