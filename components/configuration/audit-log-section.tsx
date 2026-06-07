'use client';

import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type AuditLogEntry } from '@/lib/api/parts';

interface AuditLogSectionProps {
  entries: AuditLogEntry[] | undefined;
  isLoading: boolean;
}

export function AuditLogSection({ entries, isLoading }: AuditLogSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-b px-4 py-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium w-full text-left mb-0"
      >
        <ChevronRight
          className={cn('h-3 w-3 transition-transform', open && 'rotate-90')}
        />
        Audit Log
      </button>

      {open && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : !entries || entries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No audit entries yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((entry) => (
                <div
                  key={entry.auditLogId}
                  className="flex flex-col gap-0.5 text-xs border-l-2 border-border pl-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.actionName}</span>
                    <span className="text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{entry.changedByUserName}</span>
                  {entry.note && (
                    <span className="text-muted-foreground italic">{entry.note}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
