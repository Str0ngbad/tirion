"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRoutingTemplates,
  useRoutingTemplate,
  useDeactivateRoutingTemplate,
  useReactivateRoutingTemplate,
} from "@/lib/api/routing-templates";
import { type RoutingTemplateRow } from "@/lib/routing-templates/types";
import TemplateLibraryGrid, { type TemplateSortKey } from "./_components/template-library-grid";
import ProcessTypeLegend from "./_components/process-type-legend";
import { EditTimeDialog } from "./_components/edit-time-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CondenseToggle } from "@/components/condense-toggle";

type DialogState = {
  mode: "edit" | "retire";
  templateId: number;
} | null;

export default function RoutingTemplatesPage() {
  const router = useRouter();
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<TemplateSortKey>("templateName");
  const [sortAsc, setSortAsc] = useState(true);
  const [condensed, setCondensed] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const { data, isLoading, error, refetch } = useRoutingTemplates({ active: showInactive ? "all" : "true" });
  const deactivate = useDeactivateRoutingTemplate();
  const reactivate = useReactivateRoutingTemplate();

  const detailQuery = useRoutingTemplate(dialogState?.templateId ?? 0, {
    enabled: dialogState !== null,
  });

  const templates = data ?? [];

  const displayed = [...templates].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortKey) {
      case "templateName":
        return dir * a.templateName.localeCompare(b.templateName);
      case "stepCount":
        return dir * (a.stepCount - b.stepCount);
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

  function handleRowClick(template: RoutingTemplateRow) {
    if (template.partsReferencingCount === 0) {
      router.push(`/routing-templates/${template.routingTemplateDefinitionId}`);
      return;
    }
    setDialogState({ mode: "edit", templateId: template.routingTemplateDefinitionId });
  }

  function handleRetire(template: RoutingTemplateRow) {
    if (template.partsReferencingCount === 0) {
      deactivate.mutate(template.routingTemplateDefinitionId);
      return;
    }
    setDialogState({ mode: "retire", templateId: template.routingTemplateDefinitionId });
  }

  function handleReactivate(template: RoutingTemplateRow) {
    reactivate.mutate(template.routingTemplateDefinitionId);
  }

  function handleDialogConfirm() {
    if (!dialogState) return;
    if (dialogState.mode === "edit") {
      router.push(`/routing-templates/${dialogState.templateId}`);
    } else {
      deactivate.mutate(dialogState.templateId);
    }
    setDialogState(null);
  }

  const activeCount = templates.filter((t) => t.isActive).length;
  const inactiveCount = templates.filter((t) => !t.isActive).length;
  const errorMessage = error?.message ?? null;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Routing Templates</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isLoading ? (
                "Loading…"
              ) : (
                <>
                  {activeCount} active
                  {inactiveCount > 0 && `, ${inactiveCount} inactive`}
                </>
              )}
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
            <Button asChild>
              <Link href="/routing-templates/new">
                <span className="text-base leading-none">+</span>
                Add Template
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Process type legend + Condense toggle */}
      <div className="relative">
        <ProcessTypeLegend />
        <div className="absolute right-8 top-3">
          <CondenseToggle checked={condensed} onCheckedChange={setCondensed} />
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-8 py-6">
        <TemplateLibraryGrid
          templates={displayed}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={handleSort}
          condensed={condensed}
          onRowClick={handleRowClick}
          onRetire={handleRetire}
          onReactivate={handleReactivate}
          isLoading={isLoading}
          error={errorMessage}
          onRetryError={refetch}
        />
      </div>

      {/* EditTimeDialog */}
      {dialogState !== null && detailQuery.data && (
        <EditTimeDialog
          open={true}
          onOpenChange={(open) => { if (!open) setDialogState(null); }}
          mode={dialogState.mode}
          template={detailQuery.data}
          onConfirm={handleDialogConfirm}
        />
      )}
    </div>
  );
}
