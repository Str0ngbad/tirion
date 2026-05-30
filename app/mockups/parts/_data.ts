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
