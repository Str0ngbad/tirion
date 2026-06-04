"use client";

import { use } from "react";
import { useRoutingTemplate, useRoutingTemplates } from "@/lib/api/routing-templates";
import { TemplateEditorForm } from "../_components/template-editor-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditRoutingTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const templateId = parseInt(id, 10);

  const detailQuery = useRoutingTemplate(templateId);
  const listQuery = useRoutingTemplates({ active: "all" });

  const isLoading = detailQuery.isLoading || listQuery.isLoading;
  const loadError = detailQuery.error?.message ?? listQuery.error?.message ?? null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border px-8 py-5">
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="mx-auto max-w-2xl px-8 py-8 flex flex-col gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-destructive">
        Failed to load: {loadError}
      </div>
    );
  }

  const allTemplateNames = listQuery.data?.map((t) => t.templateName) ?? [];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <TemplateEditorForm
        editingTemplate={detailQuery.data}
        allTemplateNames={allTemplateNames}
      />
    </div>
  );
}
