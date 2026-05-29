import type { ProcessTypeKey } from "@/app/mockups/users/_data";

export type MockTemplateStep = {
  stepId: number;
  stepNumber: number;
  processType: ProcessTypeKey;
};

export type MockReferencingPart = {
  partId: number;
  partNumber: string;
  partName: string;
  stockOnHand: number;
};

export type MockAffectedWo = {
  woId: number;
  woNumber: string;
  projectReference: string;
  topLevelReference: string;
  partNumber: string;
  currentStep: string;
  status: string;
  batchContext: string | null;
};

export type MockAuditEntry = {
  timestamp: string;
  userName: string;
  action: "TemplateCreated" | "TemplateUpdated" | "TemplateRetired" | "TemplateReactivated";
  changedFields?: { field: string; before: string | null; after: string | null }[];
};

export type MockTemplate = {
  templateId: number;
  templateName: string;
  description: string | null;
  isActive: boolean;
  steps: MockTemplateStep[];
  partsReferencingCount: number;
  openWoCount: number;
  affectedStockCount: number;
  referencingParts: MockReferencingPart[];
  affectedWos: MockAffectedWo[];
  auditLog: MockAuditEntry[];
};

function makeSteps(templateId: number, types: ProcessTypeKey[]): MockTemplateStep[] {
  return types.map((processType, i) => ({
    stepId: templateId * 100 + (i + 1),
    stepNumber: i + 1,
    processType,
  }));
}

export const MOCK_TEMPLATES: MockTemplate[] = [
  {
    templateId: 1,
    templateName: "Machined Part",
    description: "Standard machined component with finish",
    isActive: true,
    steps: makeSteps(1, ["Purchase", "Receive", "Machine", "Distribution"]),
    partsReferencingCount: 32,
    openWoCount: 18,
    affectedStockCount: 145,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:00:00.000Z",
        userName: "Jane Chen",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 2,
    templateName: "Machined + Blackened Part",
    description: "Machined component with blacken finish",
    isActive: true,
    steps: makeSteps(2, ["Purchase", "Receive", "Machine", "Blacken", "Distribution"]),
    partsReferencingCount: 28,
    openWoCount: 14,
    affectedStockCount: 102,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:05:00.000Z",
        userName: "Jane Chen",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 3,
    templateName: "Machined + Painted Part",
    description: "Machined component with paint finish",
    isActive: true,
    steps: makeSteps(3, ["Purchase", "Receive", "Machine", "Paint", "Distribution"]),
    partsReferencingCount: 17,
    openWoCount: 9,
    affectedStockCount: 56,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:10:00.000Z",
        userName: "Jane Chen",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 4,
    templateName: "Welded Assembly",
    description: "Multi-component welded structure",
    isActive: true,
    steps: makeSteps(4, ["Machine", "Weld", "Assemble", "Distribution"]),
    partsReferencingCount: 12,
    openWoCount: 8,
    affectedStockCount: 0,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:15:00.000Z",
        userName: "Jane Chen",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 5,
    templateName: "Welded + Painted Assembly",
    description: "Welded structure with paint finish",
    isActive: true,
    steps: makeSteps(5, ["Machine", "Weld", "Paint", "Assemble", "Distribution"]),
    partsReferencingCount: 8,
    openWoCount: 5,
    affectedStockCount: 0,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:20:00.000Z",
        userName: "Jane Chen",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 6,
    templateName: "Purchased Finished Component",
    description: "Bought complete, no production",
    isActive: true,
    steps: makeSteps(6, ["Purchase", "Receive", "Distribution"]),
    partsReferencingCount: 21,
    openWoCount: 7,
    affectedStockCount: 31,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-01-15T09:25:00.000Z",
        userName: "Jane Chen",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 7,
    templateName: "3D Printed Part",
    description: "Printed component",
    isActive: true,
    steps: makeSteps(7, ["3D Print", "Distribution"]),
    partsReferencingCount: 6,
    openWoCount: 3,
    affectedStockCount: 12,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-02-01T10:00:00.000Z",
        userName: "Marcus Hill",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 8,
    templateName: "3D Printed + Painted",
    description: "Printed component with paint finish",
    isActive: true,
    steps: makeSteps(8, ["3D Print", "Paint", "Distribution"]),
    partsReferencingCount: 4,
    openWoCount: 2,
    affectedStockCount: 8,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-02-01T10:05:00.000Z",
        userName: "Marcus Hill",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 9,
    templateName: "Machined Prt",
    description: null,
    isActive: false,
    steps: makeSteps(9, ["Purchase", "Receive", "Machine", "Distribution"]),
    partsReferencingCount: 0,
    openWoCount: 0,
    affectedStockCount: 0,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-03-10T14:00:00.000Z",
        userName: "Rita Alvarez",
        action: "TemplateRetired",
      },
      {
        timestamp: "2026-01-15T09:30:00.000Z",
        userName: "Jane Chen",
        action: "TemplateCreated",
      },
    ],
  },
  {
    templateId: 10,
    templateName: "Test Template",
    description: null,
    isActive: false,
    steps: [],
    partsReferencingCount: 0,
    openWoCount: 0,
    affectedStockCount: 0,
    referencingParts: [],
    affectedWos: [],
    auditLog: [
      {
        timestamp: "2026-04-05T11:30:00.000Z",
        userName: "Rita Alvarez",
        action: "TemplateRetired",
      },
      {
        timestamp: "2026-04-05T11:00:00.000Z",
        userName: "Rita Alvarez",
        action: "TemplateCreated",
      },
    ],
  },
];
