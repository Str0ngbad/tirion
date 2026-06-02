import type { ProcessTypeKey } from "@/app/mockups/users/_data";
import _generated from "./_data/parts-data.json";

export type PartType = "Part" | "Assembly";
export type ProcurementType = "Make" | "Buy" | "MakeBuy";

export type MockMinimalMaterialSpec = {
  materialSpecId: number;
  materialName: string;
  form: string;
};

export type MockMinimalVendor = {
  vendorId: number;
  vendorName: string;
};

export type MockMinimalRoutingTemplate = {
  templateId: number;
  templateName: string;
  steps: ProcessTypeKey[];
};

export type MockPartAuditEntry = {
  timestamp: string;
  userName: string;
  action:
    | "PartCreated"
    | "PartUpdated"
    | "PartDeactivated"
    | "PartReactivated"
    | "BomChildAdded"
    | "BomChildRemoved"
    | "BomChildQtyChanged";
  changedFields?: { field: string; before: string | null; after: string | null }[];
};

export type MockParentAssemblyRef = {
  assemblyPartId: number;
  partNumber: string;
  partName: string;
  quantityInParent: number;
};

export type MockChildPartRef = {
  childPartId: number;
  childPartNumber: string;
  childPartName: string;
  quantity: number;
};

export type MockOpenWo = {
  woId: number;
  woNumber: string;
  projectReference: string;
  projectColor: string;
  topLevelReference: string;
  partNumber: string;
  currentStep: string;
  status: string;
  batchContext: string | null;
};

export type MockPart = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: PartType;
  procurementType: ProcurementType;
  description: string | null;
  blankLength: number | null;
  notes: string | null;
  materialSpec: MockMinimalMaterialSpec | null;
  stockSize: string | null;
  defaultVendor: MockMinimalVendor | null;
  routingTemplate: MockMinimalRoutingTemplate | null;
  stockCount: number;
  inventoryLocation: string | null;
  isActive: boolean;
  createdAt: string;
  auditLog: MockPartAuditEntry[];
  // Extended fields
  vendorPartNumber: string | null;
  modelLink: string | null;
  drawingLink: string | null;
  binMin: number | null;
  binMax: number | null;
  cost: number | null;
  costLastUpdated: string | null;
  machineCycleTime: number | null;
  numberOfSetups: number | null;
  assembliesUsedInCount: number;
  parentAssemblies: MockParentAssemblyRef[];
  childParts: MockChildPartRef[];
  openWos: MockOpenWo[];
};

// ─── Reference data (for filter bar population) ─────────────────────────────

export const MOCK_VENDORS: MockMinimalVendor[] = _generated.vendors as MockMinimalVendor[];

export const MOCK_MATERIAL_SPECS: MockMinimalMaterialSpec[] = _generated.materials as MockMinimalMaterialSpec[];

export const MOCK_ROUTING_TEMPLATES: MockMinimalRoutingTemplate[] = [
  { templateId: 1, templateName: "Machined Part",       steps: ["Receive", "Machine", "Blacken"] },
  { templateId: 2, templateName: "Machined & Painted",  steps: ["Receive", "Machine", "Weld", "Paint"] },
  { templateId: 3, templateName: "Purchased Part",      steps: ["Purchase", "Receive"] },
  { templateId: 4, templateName: "Machined Weld",       steps: ["Receive", "Machine", "Weld"] },
  { templateId: 5, templateName: "3D Print Part",       steps: ["Receive", "3D Print", "Machine"] },
  { templateId: 6, templateName: "Sub-Assembly",        steps: ["Assemble"] },
  { templateId: 7, templateName: "Full Assembly",       steps: ["Assemble", "Distribution"] },
];

// ─── Parts data (generated from source CSVs via _data/generate.js) ──────────

export const MOCK_PARTS: MockPart[] = _generated.parts as unknown as MockPart[];
