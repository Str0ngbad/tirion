"use client";

import { useState } from "react";
import { MockProject, woCountSummary, topLevelWoSummary, ProjectColor, PROJECT_COLOR_MAP } from "../_data";
import { ExternalLink, Info } from "lucide-react";
import ColorPicker from "./color-picker";
import ProjectIdPill from "./project-id-pill";

type Props = {
  project: MockProject;
  onChange: (updated: MockProject) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground font-medium">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function InertLink({ label, annotation }: { label: string; annotation: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground/50 line-through">{label}</span>
      <span className="text-xs text-muted-foreground/60 italic">{annotation}</span>
    </span>
  );
}

export default function ActiveSummary({ project, onChange }: Props) {
  const { total, complete } = woCountSummary(project);
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  }

  function formatRef(projectNumber: string, topLevelIndex: number): string {
    return `${projectNumber}.${String(topLevelIndex).padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Read-only notice */}
      <div className="shrink-0 border-b border-sky-200 bg-sky-50 px-6 py-2">
        <p className="flex items-center gap-2 text-xs text-sky-700">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Read-only preview — Project Color is editable. Editing metadata, Add Top-Level Item, and Archive are Phase 8 features.
        </p>
      </div>

      <div className="flex-1 space-y-6 px-6 py-5">
        {/* ── Header section ─────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Project Header
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
            <Field label="Project Number">
              <ProjectIdPill projectNumber={project.projectNumber} color={project.color} />
            </Field>
            <Field label="Project Name">{project.projectName}</Field>
            <Field label="Color">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setColorPickerOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded border border-border/50 px-2 py-1 text-xs transition-colors hover:bg-muted/40"
                  title="Click to change project color"
                >
                  {project.color ? (
                    <>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: PROJECT_COLOR_MAP[project.color].hex }}
                      />
                      <span>{PROJECT_COLOR_MAP[project.color].label}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/60">None</span>
                  )}
                </button>
                {colorPickerOpen && (
                  <ColorPicker
                    selected={project.color}
                    onSelect={(c: ProjectColor | null) => {
                      onChange({ ...project, color: c });
                    }}
                    onClose={() => setColorPickerOpen(false)}
                  />
                )}
              </div>
            </Field>
            <Field label="Status">
              <span className="rounded-sm border border-emerald-400 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {project.status}
              </span>
            </Field>
            <Field label="Customer">{project.customerName ?? <span className="text-muted-foreground/50">—</span>}</Field>
            <Field label="Due Date">{formatDate(project.dueDate)}</Field>
            <Field label="Priority">
              {project.priority != null ? project.priority : <span className="text-muted-foreground/50">—</span>}
            </Field>
            <Field label="Created">
              {project.createdByName} · {formatDate(project.createdAt)}
            </Field>
            <Field label="Compiled">
              {project.compiledAt ? formatDateTime(project.compiledAt) : "—"}
            </Field>
            <Field label="Last Edited">
              {project.lastEditedByName} · {formatDateTime(project.lastEditedAt)}
            </Field>
            {project.notes && (
              <div className="col-span-2 lg:col-span-3 space-y-0.5">
                <dt className="text-xs text-muted-foreground font-medium">Notes</dt>
                <dd className="whitespace-pre-wrap text-sm text-foreground">{project.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* ── Progress section ─────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Progress
          </h2>

          <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-medium text-foreground">Overall Progress</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {complete} / {total} Work Orders complete
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-muted-foreground">{pct}%</p>
            {total > 0 && complete === 0 && (
              <p className="mt-1 text-xs text-muted-foreground/60 italic">
                All {total} Work Orders are Unreleased — awaiting Stock Fulfillment and Batching.
              </p>
            )}
          </div>

          {/* Top-level item summary */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-28">Reference</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32">Part #</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Part Name</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-40">Progress</th>
                </tr>
              </thead>
              <tbody>
                {project.topLevelItems.map((tl) => {
                  const { total: tlTotal, complete: tlComplete } = topLevelWoSummary(project, tl.topLevelIndex);
                  const tlPct = tlTotal > 0 ? Math.round((tlComplete / tlTotal) * 100) : 0;
                  return (
                    <tr key={tl.topLevelIndex} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {formatRef(project.projectNumber, tl.topLevelIndex)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{tl.partNumber}</td>
                      <td className="px-3 py-2 text-sm">{tl.partName}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{tl.quantity}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                            {tlComplete}/{tlTotal}
                          </span>
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-emerald-500"
                              style={{ width: `${tlPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Quick navigation ──────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Navigation
          </h2>
          <div className="space-y-2">
            <InertLink
              label="Open in Project View"
              annotation="— Project View not yet built"
            />
            <InertLink
              label="View Audit History"
              annotation="— Audit History not yet built"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
