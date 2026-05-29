"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOCK_TEMPLATES, MockTemplate } from "./_data";
import TemplateLibraryGrid, { TemplateSortKey } from "./_components/template-library-grid";
import ProcessTypeLegend from "./_components/process-type-legend";
import EditTimeDialog from "./_components/edit-time-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function RoutingTemplatesPage() {
  const router = useRouter();
  // Lazy init so that templates pushed during the /new session are picked up on remount.
  const [templates, setTemplates] = useState<MockTemplate[]>(() => [...MOCK_TEMPLATES]);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<TemplateSortKey>("templateName");
  const [sortAsc, setSortAsc] = useState(true);
  const [dialogTemplate, setDialogTemplate] = useState<MockTemplate | null>(null);

  const displayed = templates
    .filter((t) => showInactive || t.isActive)
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "templateName":
          return dir * a.templateName.localeCompare(b.templateName);
        case "stepCount":
          return dir * (a.steps.length - b.steps.length);
        case "partsReferencingCount":
          return dir * (a.partsReferencingCount - b.partsReferencingCount);
        default: {
          const _never: never = sortKey;
          void _never;
          return 0;
        }
      }
    });

  function handleSort(key: TemplateSortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function handleRowClick(template: MockTemplate) {
    const hasImpact = template.partsReferencingCount > 0 || template.openWoCount > 0;
    if (hasImpact) {
      setDialogTemplate(template);
    } else {
      router.push(`/mockups/routing-templates/${template.templateId}`);
    }
  }

  function handleDialogConfirm() {
    if (!dialogTemplate) return;
    setDialogTemplate(null);
    router.push(`/mockups/routing-templates/${dialogTemplate.templateId}`);
  }

  const activeCount = templates.filter((t) => t.isActive).length;
  const inactiveCount = templates.filter((t) => !t.isActive).length;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — Routing Template Editor</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Routing Templates</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeCount} active
              {inactiveCount > 0 && `, ${inactiveCount} inactive`}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                size="sm"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label
                htmlFor="show-inactive"
                className="cursor-pointer font-normal text-sm text-muted-foreground"
              >
                Show Inactive
              </Label>
            </div>
            <Button onClick={() => router.push("/mockups/routing-templates/new")}>
              <span className="text-base leading-none">+</span>
              Add Template
            </Button>
          </div>
        </div>
      </div>

      {/* ProcessType legend */}
      <ProcessTypeLegend />

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-8 py-6">
        <TemplateLibraryGrid
          templates={displayed}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={handleSort}
          onRowClick={handleRowClick}
        />
      </div>

      <EditTimeDialog
        template={dialogTemplate}
        open={dialogTemplate !== null}
        onOpenChange={(open) => { if (!open) setDialogTemplate(null); }}
        onConfirm={handleDialogConfirm}
      />
    </div>
  );
}
