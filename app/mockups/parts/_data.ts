import type { ProcessTypeKey } from "@/app/mockups/users/_data";

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
  action: "PartCreated" | "PartUpdated" | "PartDeactivated" | "PartReactivated";
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

export const MOCK_VENDORS: MockMinimalVendor[] = [
  { vendorId: 1, vendorName: "Acme Steel" },
  { vendorId: 2, vendorName: "Precision Metals" },
  { vendorId: 3, vendorName: "Midwest Casting" },
  { vendorId: 4, vendorName: "Fluid Tech Supply" },
];

export const MOCK_MATERIAL_SPECS: MockMinimalMaterialSpec[] = [
  { materialSpecId: 1, materialName: "Steel", form: "Round Bar" },
  { materialSpecId: 2, materialName: "Alloy Steel", form: "Round Bar" },
  { materialSpecId: 3, materialName: "Aluminum", form: "Cast" },
  { materialSpecId: 4, materialName: "Stainless Steel", form: "Round Bar" },
  { materialSpecId: 5, materialName: "Steel", form: "Flat Bar" },
  { materialSpecId: 6, materialName: "Rubber", form: "Sheet" },
];

export const MOCK_ROUTING_TEMPLATES: MockMinimalRoutingTemplate[] = [
  { templateId: 1, templateName: "Machined Part",       steps: ["Receive", "Machine", "Blacken"] },
  { templateId: 2, templateName: "Machined & Painted",   steps: ["Receive", "Machine", "Weld", "Paint"] },
  { templateId: 3, templateName: "Purchased Part",       steps: ["Purchase", "Receive"] },
  { templateId: 4, templateName: "Machined Weld",        steps: ["Receive", "Machine", "Weld"] },
  { templateId: 5, templateName: "3D Print Part",        steps: ["Receive", "3D Print", "Machine"] },
  { templateId: 6, templateName: "Sub-Assembly",         steps: ["Assemble"] },
  { templateId: 7, templateName: "Full Assembly",        steps: ["Assemble", "Distribution"] },
];

// ─── Shortcuts ───────────────────────────────────────────────────────────────

const V = (id: number) => MOCK_VENDORS.find((v) => v.vendorId === id)!;
const M = (id: number) => MOCK_MATERIAL_SPECS.find((m) => m.materialSpecId === id)!;
const T = (id: number) => MOCK_ROUTING_TEMPLATES.find((t) => t.templateId === id)!;

const PC: Record<string, string> = {
  "PROJ-A": "#3b82f6",
  "PROJ-B": "#10b981",
  "PROJ-C": "#f59e0b",
  "PROJ-D": "#8b5cf6",
  "PROJ-E": "#ef4444",
};

// ─── Mock parts ──────────────────────────────────────────────────────────────

export const MOCK_PARTS: MockPart[] = [
  {
    partId: 1,
    partNumber: "BRK-101",
    partName: "Bracket, Main",
    partType: "Part",
    procurementType: "Make",
    description: "Primary structural bracket used in drive assembly. Machined from round bar stock, blackened for corrosion resistance.",
    blankLength: 4.5,
    notes: "Tight tolerance on bore — verify setup before production run.",
    materialSpec: M(1),
    stockSize: "1.5",
    defaultVendor: V(1),
    routingTemplate: T(1),
    stockCount: 12,
    inventoryLocation: "A-01",
    isActive: true,
    createdAt: "2026-01-20T10:00:00.000Z",
    vendorPartNumber: null,
    modelLink: "https://example.com/models/BRK-101.step",
    drawingLink: "https://example.com/drawings/BRK-101.pdf",
    binMin: 5,
    binMax: 20,
    cost: 28.50,
    costLastUpdated: "2025-11-15",
    machineCycleTime: 18.5,
    numberOfSetups: 2,
    assembliesUsedInCount: 2,
    parentAssemblies: [
      { assemblyPartId: 12, partNumber: "ASSY-100", partName: "Assembly, Main Drive", quantityInParent: 2 },
      { assemblyPartId: 14, partNumber: "ASSY-300", partName: "Assembly, Bracket Sub", quantityInParent: 4 },
    ],
    childParts: [],
    openWos: [
      { woId: 101, woNumber: "WO-20260001", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "BRK-101", currentStep: "Machine", status: "In Progress", batchContext: null },
      { woId: 102, woNumber: "WO-20260015", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-300", partNumber: "BRK-101", currentStep: "Receive", status: "Awaiting Material", batchContext: "BATCH-002" },
      { woId: 103, woNumber: "WO-20260031", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-100", partNumber: "BRK-101", currentStep: "Blacken", status: "In Progress", batchContext: "BATCH-002" },
      { woId: 104, woNumber: "WO-20260047", projectReference: "PROJ-C", projectColor: PC["PROJ-C"]!, topLevelReference: "ASSY-300", partNumber: "BRK-101", currentStep: "Machine", status: "Open", batchContext: null },
      { woId: 105, woNumber: "WO-20260062", projectReference: "PROJ-D", projectColor: PC["PROJ-D"]!, topLevelReference: "ASSY-100", partNumber: "BRK-101", currentStep: "Receive", status: "Open", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-03-15T14:30:00.000Z",
        userName: "Jane Chen",
        action: "PartUpdated",
        changedFields: [
          { field: "blankLength", before: "4.0", after: "4.5" },
          { field: "notes", before: null, after: "Tight tolerance on bore — verify setup before production run." },
        ],
      },
      {
        timestamp: "2026-01-20T10:00:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 2,
    partNumber: "PLT-330",
    partName: "Plate, Base",
    partType: "Part",
    procurementType: "Make",
    description: "Flat base plate, welded and painted. Common structural component across multiple assemblies.",
    blankLength: 6.0,
    notes: null,
    materialSpec: M(5),
    stockSize: "0.5",
    defaultVendor: V(1),
    routingTemplate: T(2),
    stockCount: 5,
    inventoryLocation: "A-02",
    isActive: true,
    createdAt: "2026-01-20T10:05:00.000Z",
    vendorPartNumber: null,
    modelLink: "https://example.com/models/PLT-330.step",
    drawingLink: "https://example.com/drawings/PLT-330.pdf",
    binMin: 3,
    binMax: 15,
    cost: 42.00,
    costLastUpdated: "2025-10-20",
    machineCycleTime: 24.0,
    numberOfSetups: 2,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 12, partNumber: "ASSY-100", partName: "Assembly, Main Drive", quantityInParent: 1 },
    ],
    childParts: [],
    openWos: [
      { woId: 201, woNumber: "WO-20260020", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "PLT-330", currentStep: "Weld", status: "In Progress", batchContext: null },
      { woId: 202, woNumber: "WO-20260055", projectReference: "PROJ-C", projectColor: PC["PROJ-C"]!, topLevelReference: "ASSY-100", partNumber: "PLT-330", currentStep: "Machine", status: "Open", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-01-20T10:05:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 3,
    partNumber: "SHF-701",
    partName: "Shaft, Drive",
    partType: "Part",
    procurementType: "Make",
    description: "Precision drive shaft. Ground after welding to hold bearing tolerances.",
    blankLength: 12.0,
    notes: "Order Alloy Steel only — standard steel does not meet hardness spec.",
    materialSpec: M(2),
    stockSize: "1.0",
    defaultVendor: V(2),
    routingTemplate: T(4),
    stockCount: 0,
    inventoryLocation: "B-01",
    isActive: true,
    createdAt: "2026-01-21T09:00:00.000Z",
    vendorPartNumber: null,
    modelLink: "https://example.com/models/SHF-701.step",
    drawingLink: "https://example.com/drawings/SHF-701.pdf",
    binMin: 2,
    binMax: 10,
    cost: 65.00,
    costLastUpdated: "2026-01-08",
    machineCycleTime: 32.5,
    numberOfSetups: 3,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 12, partNumber: "ASSY-100", partName: "Assembly, Main Drive", quantityInParent: 1 },
    ],
    childParts: [],
    openWos: [
      { woId: 301, woNumber: "WO-20260025", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "SHF-701", currentStep: "Weld", status: "In Progress", batchContext: null },
      { woId: 302, woNumber: "WO-20260048", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-100", partNumber: "SHF-701", currentStep: "Machine", status: "Open", batchContext: null },
      { woId: 303, woNumber: "WO-20260071", projectReference: "PROJ-D", projectColor: PC["PROJ-D"]!, topLevelReference: "ASSY-100", partNumber: "SHF-701", currentStep: "Receive", status: "Awaiting Material", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-04-02T11:00:00.000Z",
        userName: "Marcus Hill",
        action: "PartUpdated",
        changedFields: [
          { field: "notes", before: null, after: "Order Alloy Steel only — standard steel does not meet hardness spec." },
        ],
      },
      {
        timestamp: "2026-01-21T09:00:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 4,
    partNumber: "HSG-401",
    partName: "Housing, Pump",
    partType: "Part",
    procurementType: "Make",
    description: "Cast aluminum pump housing. Machined to final dimensions after casting.",
    blankLength: null,
    notes: null,
    materialSpec: M(3),
    stockSize: "4.0",
    defaultVendor: V(3),
    routingTemplate: T(1),
    stockCount: 3,
    inventoryLocation: "B-02",
    isActive: true,
    createdAt: "2026-01-22T09:30:00.000Z",
    vendorPartNumber: null,
    modelLink: "https://example.com/models/HSG-401.step",
    drawingLink: "https://example.com/drawings/HSG-401.pdf",
    binMin: 2,
    binMax: 8,
    cost: 85.00,
    costLastUpdated: "2025-09-05",
    machineCycleTime: 45.0,
    numberOfSetups: 3,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 13, partNumber: "ASSY-200", partName: "Assembly, Pump Unit", quantityInParent: 1 },
    ],
    childParts: [],
    openWos: [
      { woId: 401, woNumber: "WO-20260033", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "HSG-401", currentStep: "Machine", status: "In Progress", batchContext: null },
      { woId: 402, woNumber: "WO-20260066", projectReference: "PROJ-C", projectColor: PC["PROJ-C"]!, topLevelReference: "ASSY-200", partNumber: "HSG-401", currentStep: "Receive", status: "Awaiting Material", batchContext: "BATCH-007" },
      { woId: 403, woNumber: "WO-20260089", projectReference: "PROJ-E", projectColor: PC["PROJ-E"]!, topLevelReference: "ASSY-200", partNumber: "HSG-401", currentStep: "Machine", status: "Open", batchContext: "BATCH-007" },
    ],
    auditLog: [
      {
        timestamp: "2026-01-22T09:30:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 5,
    partNumber: "PIN-602",
    partName: "Pin, Alignment",
    partType: "Part",
    procurementType: "Buy",
    description: "Standard alignment pin. Purchased to spec — no in-house machining required.",
    blankLength: null,
    notes: null,
    materialSpec: M(1),
    stockSize: "0.25",
    defaultVendor: V(1),
    routingTemplate: T(3),
    stockCount: 25,
    inventoryLocation: "C-01",
    isActive: true,
    createdAt: "2026-01-22T10:00:00.000Z",
    vendorPartNumber: "ACM-90145A155",
    modelLink: null,
    drawingLink: null,
    binMin: 10,
    binMax: 50,
    cost: 1.25,
    costLastUpdated: "2026-03-01",
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 3,
    parentAssemblies: [
      { assemblyPartId: 12, partNumber: "ASSY-100", partName: "Assembly, Main Drive", quantityInParent: 4 },
      { assemblyPartId: 13, partNumber: "ASSY-200", partName: "Assembly, Pump Unit", quantityInParent: 2 },
      { assemblyPartId: 14, partNumber: "ASSY-300", partName: "Assembly, Bracket Sub", quantityInParent: 6 },
    ],
    childParts: [],
    openWos: [
      { woId: 501, woNumber: "WO-20260009", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "PIN-602", currentStep: "Purchase", status: "Awaiting Purchase", batchContext: "BATCH-003" },
      { woId: 502, woNumber: "WO-20260022", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-300", partNumber: "PIN-602", currentStep: "Receive", status: "Open", batchContext: "BATCH-003" },
      { woId: 503, woNumber: "WO-20260040", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "PIN-602", currentStep: "Purchase", status: "Awaiting Purchase", batchContext: null },
      { woId: 504, woNumber: "WO-20260058", projectReference: "PROJ-C", projectColor: PC["PROJ-C"]!, topLevelReference: "ASSY-100", partNumber: "PIN-602", currentStep: "Receive", status: "Open", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-01-22T10:00:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 6,
    partNumber: "BLK-001",
    partName: "Block, Adapter",
    partType: "Part",
    procurementType: "MakeBuy",
    description: "Adapter block — sourced as raw casting from Precision Metals, machined in-house to final geometry.",
    blankLength: null,
    notes: "Lead time on castings is 6 weeks — plan ahead.",
    materialSpec: M(3),
    stockSize: "2.0",
    defaultVendor: V(2),
    routingTemplate: T(1),
    stockCount: 0,
    inventoryLocation: "B-03",
    isActive: true,
    createdAt: "2026-02-03T13:00:00.000Z",
    vendorPartNumber: "PRM-C2245-AL",
    modelLink: "https://example.com/models/BLK-001.step",
    drawingLink: "https://example.com/drawings/BLK-001.pdf",
    binMin: 2,
    binMax: 6,
    cost: 48.00,
    costLastUpdated: "2025-12-10",
    machineCycleTime: 22.0,
    numberOfSetups: 2,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 13, partNumber: "ASSY-200", partName: "Assembly, Pump Unit", quantityInParent: 1 },
    ],
    childParts: [],
    openWos: [
      { woId: 601, woNumber: "WO-20260044", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "BLK-001", currentStep: "Machine", status: "In Progress", batchContext: null },
      { woId: 602, woNumber: "WO-20260079", projectReference: "PROJ-E", projectColor: PC["PROJ-E"]!, topLevelReference: "ASSY-200", partNumber: "BLK-001", currentStep: "Receive", status: "Awaiting Material", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-02-03T13:00:00.000Z",
        userName: "Jane Chen",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 7,
    partNumber: "FLG-201",
    partName: "Flange, Mounting",
    partType: "Part",
    procurementType: "Make",
    description: "Weld-on mounting flange. Machined, welded, and painted per drawing.",
    blankLength: 8.0,
    notes: null,
    materialSpec: M(5),
    stockSize: "6.0",
    defaultVendor: V(1),
    routingTemplate: T(2),
    stockCount: 2,
    inventoryLocation: "A-03",
    isActive: true,
    createdAt: "2026-02-10T09:00:00.000Z",
    vendorPartNumber: null,
    modelLink: "https://example.com/models/FLG-201.step",
    drawingLink: "https://example.com/drawings/FLG-201.pdf",
    binMin: 2,
    binMax: 10,
    cost: 55.00,
    costLastUpdated: "2025-11-30",
    machineCycleTime: 28.0,
    numberOfSetups: 2,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 12, partNumber: "ASSY-100", partName: "Assembly, Main Drive", quantityInParent: 2 },
    ],
    childParts: [],
    openWos: [
      { woId: 701, woNumber: "WO-20260018", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "FLG-201", currentStep: "Paint", status: "In Progress", batchContext: null },
      { woId: 702, woNumber: "WO-20260053", projectReference: "PROJ-C", projectColor: PC["PROJ-C"]!, topLevelReference: "ASSY-100", partNumber: "FLG-201", currentStep: "Machine", status: "Open", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-02-10T09:00:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 8,
    partNumber: "NZL-101",
    partName: "Nozzle, Spray",
    partType: "Part",
    procurementType: "Buy",
    description: "Stainless spray nozzle. Purchased component — do not substitute with non-stainless.",
    blankLength: null,
    notes: "Fluid Tech is the only approved supplier for this part.",
    materialSpec: M(4),
    stockSize: "0.5",
    defaultVendor: V(4),
    routingTemplate: T(3),
    stockCount: 8,
    inventoryLocation: "C-02",
    isActive: true,
    createdAt: "2026-02-15T11:00:00.000Z",
    vendorPartNumber: "FTS-NZ1000SS",
    modelLink: null,
    drawingLink: "https://example.com/drawings/NZL-101.pdf",
    binMin: 4,
    binMax: 20,
    cost: 12.50,
    costLastUpdated: "2026-02-15",
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 13, partNumber: "ASSY-200", partName: "Assembly, Pump Unit", quantityInParent: 3 },
    ],
    childParts: [],
    openWos: [
      { woId: 801, woNumber: "WO-20260036", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "NZL-101", currentStep: "Purchase", status: "Awaiting Purchase", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-02-15T11:00:00.000Z",
        userName: "Jane Chen",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 9,
    partNumber: "GRD-501",
    partName: "Gasket, Ring",
    partType: "Part",
    procurementType: "Buy",
    description: "Rubber ring gasket for sealing pump housing. Purchased to standard spec.",
    blankLength: null,
    notes: null,
    materialSpec: M(6),
    stockSize: "3.0",
    defaultVendor: V(4),
    routingTemplate: T(3),
    stockCount: 14,
    inventoryLocation: "C-03",
    isActive: true,
    createdAt: "2026-02-15T11:15:00.000Z",
    vendorPartNumber: "FTS-GK3000RB",
    modelLink: null,
    drawingLink: null,
    binMin: 5,
    binMax: 30,
    cost: 3.75,
    costLastUpdated: "2026-01-22",
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 13, partNumber: "ASSY-200", partName: "Assembly, Pump Unit", quantityInParent: 3 },
    ],
    childParts: [],
    openWos: [
      { woId: 901, woNumber: "WO-20260037", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "GRD-501", currentStep: "Purchase", status: "Awaiting Purchase", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-02-15T11:15:00.000Z",
        userName: "Jane Chen",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 10,
    partNumber: "SPR-301",
    partName: "Spring, Return",
    partType: "Part",
    procurementType: "Buy",
    description: "Return spring for valve actuation. Stock item from Acme.",
    blankLength: null,
    notes: null,
    materialSpec: M(1),
    stockSize: "0.75",
    defaultVendor: V(1),
    routingTemplate: T(3),
    stockCount: 30,
    inventoryLocation: "C-04",
    isActive: true,
    createdAt: "2026-03-01T08:00:00.000Z",
    vendorPartNumber: "ACM-SPG-07500",
    modelLink: null,
    drawingLink: null,
    binMin: 10,
    binMax: 50,
    cost: 2.20,
    costLastUpdated: "2026-03-01",
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 13, partNumber: "ASSY-200", partName: "Assembly, Pump Unit", quantityInParent: 3 },
    ],
    childParts: [],
    openWos: [
      { woId: 1001, woNumber: "WO-20260038", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "SPR-301", currentStep: "Purchase", status: "Awaiting Purchase", batchContext: "BATCH-004" },
      { woId: 1002, woNumber: "WO-20260072", projectReference: "PROJ-D", projectColor: PC["PROJ-D"]!, topLevelReference: "ASSY-200", partNumber: "SPR-301", currentStep: "Receive", status: "Open", batchContext: "BATCH-004" },
    ],
    auditLog: [
      {
        timestamp: "2026-03-01T08:00:00.000Z",
        userName: "Marcus Hill",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 11,
    partNumber: "CAP-801",
    partName: "Cap, Bearing",
    partType: "Part",
    procurementType: "Make",
    description: "Bearing cap — superseded by CAP-802 in current assemblies.",
    blankLength: null,
    notes: "Inactive — replaced by CAP-802. Do not reorder.",
    materialSpec: M(3),
    stockSize: "2.5",
    defaultVendor: V(3),
    routingTemplate: T(1),
    stockCount: 0,
    inventoryLocation: "B-04",
    isActive: false,
    createdAt: "2026-01-20T10:30:00.000Z",
    vendorPartNumber: null,
    modelLink: "https://example.com/models/CAP-801.step",
    drawingLink: "https://example.com/drawings/CAP-801.pdf",
    binMin: null,
    binMax: null,
    cost: 38.00,
    costLastUpdated: "2025-08-10",
    machineCycleTime: 15.0,
    numberOfSetups: 1,
    assembliesUsedInCount: 0,
    parentAssemblies: [],
    childParts: [],
    openWos: [],
    auditLog: [
      {
        timestamp: "2026-04-20T15:00:00.000Z",
        userName: "Jane Chen",
        action: "PartDeactivated",
      },
      {
        timestamp: "2026-01-20T10:30:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 12,
    partNumber: "ASSY-100",
    partName: "Assembly, Main Drive",
    partType: "Assembly",
    procurementType: "Make",
    description: "Top-level drive assembly. Includes shaft, brackets, and mounting hardware.",
    blankLength: null,
    notes: null,
    materialSpec: null,
    stockSize: null,
    defaultVendor: null,
    routingTemplate: T(7),
    stockCount: 1,
    inventoryLocation: "ASSY-01",
    isActive: true,
    createdAt: "2026-01-25T14:00:00.000Z",
    vendorPartNumber: null,
    modelLink: null,
    drawingLink: null,
    binMin: null,
    binMax: null,
    cost: null,
    costLastUpdated: null,
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 0,
    parentAssemblies: [],
    childParts: [
      { childPartId: 1,  childPartNumber: "BRK-101",  childPartName: "Bracket, Main",           quantity: 2 },
      { childPartId: 2,  childPartNumber: "PLT-330",  childPartName: "Plate, Base",             quantity: 1 },
      { childPartId: 3,  childPartNumber: "SHF-701",  childPartName: "Shaft, Drive",            quantity: 1 },
      { childPartId: 5,  childPartNumber: "PIN-602",  childPartName: "Pin, Alignment",          quantity: 4 },
      { childPartId: 7,  childPartNumber: "FLG-201",  childPartName: "Flange, Mounting",        quantity: 2 },
      { childPartId: 14, childPartNumber: "ASSY-300", childPartName: "Assembly, Bracket Sub",   quantity: 1 },
    ],
    openWos: [
      { woId: 1201, woNumber: "WO-20260005", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "ASSY-100", currentStep: "Assemble", status: "In Progress", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-01-25T14:00:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 13,
    partNumber: "ASSY-200",
    partName: "Assembly, Pump Unit",
    partType: "Assembly",
    procurementType: "Make",
    description: "Complete pump unit assembly. Includes housing, nozzle, gasket, and return spring.",
    blankLength: null,
    notes: "Pressure test required before shipment.",
    materialSpec: null,
    stockSize: null,
    defaultVendor: null,
    routingTemplate: T(7),
    stockCount: 0,
    inventoryLocation: "ASSY-02",
    isActive: true,
    createdAt: "2026-01-25T14:10:00.000Z",
    vendorPartNumber: null,
    modelLink: null,
    drawingLink: null,
    binMin: null,
    binMax: null,
    cost: null,
    costLastUpdated: null,
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 0,
    parentAssemblies: [],
    childParts: [
      { childPartId: 4,  childPartNumber: "HSG-401",  childPartName: "Housing, Pump",    quantity: 1 },
      { childPartId: 5,  childPartNumber: "PIN-602",  childPartName: "Pin, Alignment",   quantity: 2 },
      { childPartId: 6,  childPartNumber: "BLK-001",  childPartName: "Block, Adapter",   quantity: 1 },
      { childPartId: 8,  childPartNumber: "NZL-101",  childPartName: "Nozzle, Spray",    quantity: 3 },
      { childPartId: 9,  childPartNumber: "GRD-501",  childPartName: "Gasket, Ring",     quantity: 3 },
      { childPartId: 10, childPartNumber: "SPR-301",  childPartName: "Spring, Return",   quantity: 3 },
    ],
    openWos: [
      { woId: 1301, woNumber: "WO-20260030", projectReference: "PROJ-B", projectColor: PC["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "ASSY-200", currentStep: "Assemble", status: "In Progress", batchContext: null },
      { woId: 1302, woNumber: "WO-20260065", projectReference: "PROJ-C", projectColor: PC["PROJ-C"]!, topLevelReference: "ASSY-200", partNumber: "ASSY-200", currentStep: "Distribution", status: "Open", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-03-10T10:00:00.000Z",
        userName: "Marcus Hill",
        action: "PartUpdated",
        changedFields: [
          { field: "notes", before: null, after: "Pressure test required before shipment." },
        ],
      },
      {
        timestamp: "2026-01-25T14:10:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 14,
    partNumber: "ASSY-300",
    partName: "Assembly, Bracket Sub",
    partType: "Assembly",
    procurementType: "Make",
    description: "Bracket sub-assembly used in ASSY-100.",
    blankLength: null,
    notes: null,
    materialSpec: null,
    stockSize: null,
    defaultVendor: null,
    routingTemplate: T(6),
    stockCount: 2,
    inventoryLocation: "ASSY-01",
    isActive: true,
    createdAt: "2026-02-01T09:00:00.000Z",
    vendorPartNumber: null,
    modelLink: null,
    drawingLink: null,
    binMin: null,
    binMax: null,
    cost: null,
    costLastUpdated: null,
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 1,
    parentAssemblies: [
      { assemblyPartId: 12, partNumber: "ASSY-100", partName: "Assembly, Main Drive", quantityInParent: 1 },
    ],
    childParts: [
      { childPartId: 1, childPartNumber: "BRK-101", childPartName: "Bracket, Main",   quantity: 4 },
      { childPartId: 5, childPartNumber: "PIN-602", childPartName: "Pin, Alignment",  quantity: 6 },
    ],
    openWos: [
      { woId: 1401, woNumber: "WO-20260016", projectReference: "PROJ-A", projectColor: PC["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "ASSY-300", currentStep: "Assemble", status: "In Progress", batchContext: null },
    ],
    auditLog: [
      {
        timestamp: "2026-02-01T09:00:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
  {
    partId: 15,
    partNumber: "ASSY-400",
    partName: "Assembly, Valve Body",
    partType: "Assembly",
    procurementType: "Make",
    description: "Valve body assembly — superseded by ASSY-401 redesign.",
    blankLength: null,
    notes: "Inactive — do not produce.",
    materialSpec: null,
    stockSize: null,
    defaultVendor: null,
    routingTemplate: T(7),
    stockCount: 0,
    inventoryLocation: "ASSY-03",
    isActive: false,
    createdAt: "2026-01-25T14:30:00.000Z",
    vendorPartNumber: null,
    modelLink: null,
    drawingLink: null,
    binMin: null,
    binMax: null,
    cost: null,
    costLastUpdated: null,
    machineCycleTime: null,
    numberOfSetups: null,
    assembliesUsedInCount: 0,
    parentAssemblies: [],
    childParts: [],
    openWos: [],
    auditLog: [
      {
        timestamp: "2026-05-05T09:00:00.000Z",
        userName: "Jane Chen",
        action: "PartDeactivated",
      },
      {
        timestamp: "2026-01-25T14:30:00.000Z",
        userName: "Admin",
        action: "PartCreated",
      },
    ],
  },
];
