"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_TEMPLATES, MockTemplate } from "../_data";
import TemplateEditorForm from "../_components/template-editor-form";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

export default function EditTemplatePage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  const templateId = parseInt(id, 10);
  const template = MOCK_TEMPLATES.find((t) => t.templateId === templateId) ?? null;

  if (!template) {
    return (
      <div className="min-h-screen bg-background font-sans text-foreground">
        <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
          <span className="text-xs text-amber-700 dark:text-amber-400">
            <strong className="font-medium">Mockup — Routing Template Editor</strong>
            {" · "}Spec validation, not production · in-memory state, resets on reload
          </span>
        </div>
        <div className="mx-auto max-w-2xl px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground">Template not found.</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/mockups/routing-templates">Back to library</Link>
          </Button>
        </div>
      </div>
    );
  }

  function handleSave(updated: MockTemplate) {
    const idx = MOCK_TEMPLATES.findIndex((t) => t.templateId === updated.templateId);
    if (idx !== -1) {
      MOCK_TEMPLATES[idx] = updated;
    }
    router.push("/mockups/routing-templates");
  }

  function handleCancel() {
    router.push("/mockups/routing-templates");
  }

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
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/mockups/routing-templates">
              <ChevronLeftIcon />
              Back
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Edit Routing Template</h1>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-2xl px-8 py-8">
        <TemplateEditorForm
          allTemplates={MOCK_TEMPLATES}
          editingTemplate={template}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
