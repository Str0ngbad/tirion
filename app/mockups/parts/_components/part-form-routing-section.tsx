"use client";

import { useState } from "react";
import Link from "next/link";
import { MockMinimalRoutingTemplate, MOCK_ROUTING_TEMPLATES, PartType } from "../_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink } from "lucide-react";

type Props = {
  partType: PartType;
  routingTemplate: MockMinimalRoutingTemplate | null;
  onChange: (template: MockMinimalRoutingTemplate | null) => void;
};

function compatibleTemplates(partType: PartType): MockMinimalRoutingTemplate[] {
  if (partType === "Assembly") {
    return MOCK_ROUTING_TEMPLATES.filter(
      (t) => !t.steps.includes("Purchase") && !t.steps.includes("Receive")
    );
  }
  return MOCK_ROUTING_TEMPLATES;
}

export default function PartFormRoutingSection({ partType, routingTemplate, onChange }: Props) {
  const [selecting, setSelecting] = useState(false);
  const options = compatibleTemplates(partType);

  function handleSelect(val: string) {
    const selected = MOCK_ROUTING_TEMPLATES.find((t) => t.templateId.toString() === val) ?? null;
    if (selected?.templateId !== routingTemplate?.templateId) {
      onChange(selected);
    }
    setSelecting(false);
  }

  return (
    <div className="space-y-3">
      {routingTemplate ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">{routingTemplate.templateName}</div>
          <div className="flex flex-wrap gap-1.5">
            {routingTemplate.steps.map((step, i) => (
              <ProcessTypeChip key={i} processType={step} />
            ))}
          </div>
          <Link
            href={`/mockups/routing-templates/${routingTemplate.templateId}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            View/Edit in Routing Template Editor
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No routing template assigned.</p>
      )}

      {selecting ? (
        <div className="flex items-center gap-2">
          <Select
            defaultValue={routingTemplate?.templateId.toString() ?? ""}
            onValueChange={handleSelect}
          >
            <SelectTrigger className="h-8 flex-1 text-sm">
              <SelectValue placeholder="Select a template…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.templateId} value={t.templateId.toString()}>
                  <span className="flex items-center gap-2">
                    <span>{t.templateName}</span>
                    <span className="flex gap-0.5">
                      {t.steps.map((s, i) => (
                        <ProcessTypeChip key={i} processType={s} compact />
                      ))}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setSelecting(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setSelecting(true)}>
          {routingTemplate ? "Change Template" : "Assign Template"}
        </Button>
      )}
    </div>
  );
}
