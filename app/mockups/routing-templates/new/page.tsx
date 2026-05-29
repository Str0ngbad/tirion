"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_TEMPLATES, MockTemplate } from "../_data";
import TemplateEditorForm from "../_components/template-editor-form";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "lucide-react";

export default function NewTemplatePage() {
  const router = useRouter();

  function handleSave(template: MockTemplate) {
    // Push to the module-level array so the library page picks it up on remount.
    MOCK_TEMPLATES.push(template);
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
          <h1 className="text-lg font-semibold text-foreground">New Routing Template</h1>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-2xl px-8 py-8">
        <TemplateEditorForm
          allTemplates={MOCK_TEMPLATES}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
