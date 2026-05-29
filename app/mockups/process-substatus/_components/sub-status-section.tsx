"use client";

import { MockSubStatus } from "../_data";
import SubStatusRow from "./sub-status-row";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import { ProcessTypeKey } from "@/app/mockups/users/_data";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Props = {
  processType: ProcessTypeKey;
  subStatuses: MockSubStatus[];
  onAdd: () => void;
  onRowClick: (s: MockSubStatus) => void;
  onRetire: (s: MockSubStatus) => void;
  onReactivate: (s: MockSubStatus) => void;
  onUpdateOrder: (id: number, order: number) => void;
};

const TH = "px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground text-left";

export default function SubStatusSection({
  processType,
  subStatuses,
  onAdd,
  onRowClick,
  onRetire,
  onReactivate,
  onUpdateOrder,
}: Props) {
  const sorted = [...subStatuses].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="rounded-lg border border-border bg-card/20">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <ProcessTypeChip processType={processType} />
        <Button variant="outline" size="sm" onClick={onAdd}>
          <span className="text-sm leading-none mr-1">+</span>
          Add Sub-Status
        </Button>
      </div>

      {/* Section body */}
      {sorted.length === 0 ? (
        <p className="px-4 py-7 text-center text-xs text-muted-foreground">
          No sub-statuses defined for this process. Use Add to create one.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-card/30 hover:bg-card/30">
              <TableHead className={`${TH} min-w-[160px]`}>Name</TableHead>
              <TableHead className={`${TH} max-w-[280px]`}>Description</TableHead>
              <TableHead className={`${TH} w-24`}>Order</TableHead>
              <TableHead className={`${TH} w-16 text-center`}>Active</TableHead>
              <TableHead className="w-10 px-1 py-2.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => (
              <SubStatusRow
                key={s.subStatusId}
                subStatus={s}
                onRowClick={onRowClick}
                onRetire={onRetire}
                onReactivate={onReactivate}
                onUpdateOrder={onUpdateOrder}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
