export type RoutingTemplateStepRow = {
  routingTemplateStepId: number;
  stepIndex: number;
  processTypeId: number;
  processTypeName: string;
};

export type RoutingTemplateRow = {
  routingTemplateDefinitionId: number;
  templateName: string;
  description: string | null;
  isActive: boolean;
  stepCount: number;
  partsReferencingCount: number;
  steps: RoutingTemplateStepRow[];
};

export type PartSummary = {
  partId: number;
  partNumber: string;
  partName: string;
  stockCount: number;
};

export type RoutingTemplateDetail = RoutingTemplateRow & {
  // Phase 1C: hardcoded 0 until WorkOrder layer exists
  openWorkOrderCount: number;
  referencingParts: PartSummary[];
  affectedStockCount: number;
};

export type RoutingTemplateStepInput = {
  processTypeId: number;
  stepIndex: number;
};

export type CreateRoutingTemplateInput = {
  templateName: string;
  description?: string | null;
  steps: RoutingTemplateStepInput[];
};

export type UpdateRoutingTemplateInput = {
  templateName?: string;
  description?: string | null;
  steps?: RoutingTemplateStepInput[];
};

export type SaveResponse = {
  template: RoutingTemplateRow;
  // Phase 1C: always 0 until WorkOrder + DefinitionChangeFlag layers exist
  flaggedWoCount: number;
};

export type ListRoutingTemplatesQuery = {
  active: "true" | "false" | "all";
};
