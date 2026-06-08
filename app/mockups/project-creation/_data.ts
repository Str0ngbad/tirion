// Project Creation mockup — synthetic data
// All state lives in module scope; components import and mutate this.
// No API calls, no persistence.

import { MOCK_PARTS } from "@/app/mockups/parts/_data";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectStatus = "Draft" | "Active" | "Complete" | "Archived";
export type WoStatus = "Unreleased" | "Open" | "Complete" | "Cancelled";
export type StepStatus = "Waiting" | "InProgress" | "Complete" | "Skipped";

export type ValidationStatus = "pass" | "fail" | "pending";
export type ValidationFailureReason =
  | "no-template"
  | "template-inactive"
  | "part-inactive"
  | "circular";

export type MockProjectRoutingTemplate = {
  templateId: number;
  templateName: string;
  isActive: boolean;
};

export type MockWorkOrderStep = {
  stepId: number;
  stepNumber: number;
  processType: string;
  status: StepStatus;
};

export type MockWorkOrder = {
  woId: number;
  projectId: number;
  partId: number;
  partNumber: string;
  partName: string;
  quantity: number;
  parentWoId: number | null;
  topLevelIndex: number | null;
  status: WoStatus;
  steps: MockWorkOrderStep[];
};

export type MockProjectTopLevelItem = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  quantity: number;
  topLevelIndex: number; // 1-based, immutable once assigned
};

export type MockProject = {
  projectId: number;
  projectNumber: string;
  projectName: string;
  customerName: string | null;
  status: ProjectStatus;
  dueDate: string | null;
  priority: number | null;
  notes: string | null;
  createdAt: string;
  createdByUserId: number;
  createdByName: string;
  lastEditedAt: string;
  lastEditedUserId: number;
  lastEditedByName: string;
  topLevelItems: MockProjectTopLevelItem[];
  workOrders: MockWorkOrder[];
  compiledAt: string | null;
  // Draft-only: next top-level index counter (tracks removed + added to prevent reuse)
  nextTopLevelIndex: number;
};

// ─── Mock routing templates ───────────────────────────────────────────────────
//
// Template assignments drive validation for the Draft projects:
//   - Projects 17559 and 10256 compile cleanly (full tree coverage)
//   - Project 10236 surfaces failures:
//       - Parts in its tree that have no assignment in the real data remain unassigned (no-template)
//       - One part (the root assembly 22-06-0-00) is force-assigned to templateId 103 (inactive)
//   - Active projects 10121 and 10030 have full coverage (their WO trees were consistent at compile time)
//
// templateId 103 is the inactive template. Assignment is via TEMPLATE_OVERRIDE_MAP below.

export const MOCK_PROJECT_ROUTING_TEMPLATES: MockProjectRoutingTemplate[] = [
  { templateId: 101, templateName: "Machined Part",      isActive: true  },
  { templateId: 102, templateName: "Welded Assembly",    isActive: true  },
  { templateId: 103, templateName: "Retired Assy Route", isActive: false }, // inactive — exercises failure path
  { templateId: 104, templateName: "Purchased Part",     isActive: true  },
];

// Override map: partId → templateId | null
// null = explicitly no template (overrides part's real routingTemplate)
// templateId = use this mock template instead of the part's real one
// Not in map = use the part's real routingTemplate (converted to a mock template or null if unset)
const TEMPLATE_OVERRIDE_MAP = new Map<number, number | null>([
  // 22-06-0-00 (Bridgeport Upgrade Assembly) — assigned to inactive template 103
  [2165, 103],
  // A few specific sub-parts of 22-06-0-00 with real templates → force to null for variety
  [2166, null], // 22-06-1-00 Bridgeport Drive Assembly — no template
  [2167, null], // 22-06-2-00 Bridgeport Table Mount Encoder — no template
]);

// Resolve the routing template for a given partId in the project-creation mockup context.
// Returns { templateId, templateName, isActive } | null
export function resolvePartTemplate(
  partId: number
): MockProjectRoutingTemplate | null {
  if (TEMPLATE_OVERRIDE_MAP.has(partId)) {
    const overrideId = TEMPLATE_OVERRIDE_MAP.get(partId)!;
    if (overrideId === null) return null;
    return MOCK_PROJECT_ROUTING_TEMPLATES.find((t) => t.templateId === overrideId) ?? null;
  }

  // Fall back to the part's real routingTemplate
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part || !part.routingTemplate) return null;

  // Map the real template to a mock template (use active mock templates)
  // Real templates are all active; map them to templateId 101 or 102 based on part type
  const tpl = MOCK_PROJECT_ROUTING_TEMPLATES.find(
    (t) => t.isActive && t.templateId === (part.partType === "Assembly" ? 102 : 101)
  );
  return tpl ?? null;
}

// ─── BOM tree walk + WO generation ───────────────────────────────────────────

function buildWOs(
  partId: number,
  quantity: number,
  parentWoId: number | null,
  topLevelIndex: number | null,
  projectId: number,
  woIdCounter: { next: number },
  visited: Set<number>
): MockWorkOrder[] {
  if (visited.has(partId)) return [];
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part) return [];

  const visited2 = new Set(visited);
  visited2.add(partId);

  const woId = woIdCounter.next++;

  // Steps from the part's routing template steps, or a minimal default
  const templateSteps =
    part.routingTemplate?.steps ?? ["Purchase", "Receive"];
  const steps: MockWorkOrderStep[] = templateSteps.map((processType, i) => ({
    stepId: woId * 100 + i + 1,
    stepNumber: i + 1,
    processType,
    status: "Waiting" as StepStatus,
  }));

  const wo: MockWorkOrder = {
    woId,
    projectId,
    partId,
    partNumber: part.partNumber,
    partName: part.partName,
    quantity,
    parentWoId,
    topLevelIndex,
    status: "Unreleased",
    steps,
  };

  const children: MockWorkOrder[] = [];
  if (part.childParts) {
    for (const child of part.childParts) {
      children.push(
        ...buildWOs(
          child.childPartId,
          quantity * child.quantity,
          woId,
          null,
          projectId,
          woIdCounter,
          visited2
        )
      );
    }
  }

  return [wo, ...children];
}

// ─── Project definitions ──────────────────────────────────────────────────────

// Lookup helper
function part(partId: number): MockProjectTopLevelItem {
  const p = MOCK_PARTS.find((x) => x.partId === partId)!;
  return {
    partId: p.partId,
    partNumber: p.partNumber,
    partName: p.partName,
    partType: p.partType as "Part" | "Assembly",
    quantity: 1,
    topLevelIndex: 0, // caller sets this
  };
}

function makeTLItems(
  specs: { partId: number; qty?: number }[]
): MockProjectTopLevelItem[] {
  return specs.map(({ partId, qty = 1 }, i) => {
    const p = part(partId);
    return { ...p, quantity: qty, topLevelIndex: i + 1 };
  });
}

// Active project 10121 — 6 top-level items
const TL_10121 = makeTLItems([
  { partId: 1908 }, // 1K Base Tooling
  { partId: 1922 }, // 19-07-0-00 Wired Probe Assembly
  { partId: 2035 }, // 18-01-3-00 CW 10.5in Cutter Plate Assembly
  { partId: 1942 }, // Tailstock Brake Assembly
  { partId: 1929 }, // 12-10-4-00 Tool Setter Package
  { partId: 1967 }, // 18-06-0-00 1K Cradle Assembly
]);

// Active project 10030 — 8 top-level items
const TL_10030 = makeTLItems([
  { partId: 1951 }, // 51-01-0-00 PB-M Base Assembly
  { partId: 1954 }, // 55-10-0-00 PB-M Wrap Around Drive Assembly
  { partId: 2219 }, // 52-31-0-00 PB-M Lower Column 2.0
  { partId: 1943 }, // 52-19-4-00 1,000 lb. Capacity Upper Column
  { partId: 1958 }, // 58-16-0-00 Computer Console Assembly
  { partId: 2063 }, // 55-10-1-00 PB-M WAD Tensioner Assemble
  { partId: 2066 }, // 59-16-3-00 1 inch PB-M End Stop Assembly
  { partId: 1948 }, // 58-17-0-00 Photo Eye Kit
]);

// Generate WOs for Active projects at module init time
const counter10121 = { next: 10001 };
const WOS_10121: MockWorkOrder[] = [];
TL_10121.forEach((tl) => {
  WOS_10121.push(
    ...buildWOs(tl.partId, tl.quantity, null, tl.topLevelIndex, 10121, counter10121, new Set())
  );
});

const counter10030 = { next: 20001 };
const WOS_10030: MockWorkOrder[] = [];
TL_10030.forEach((tl) => {
  WOS_10030.push(
    ...buildWOs(tl.partId, tl.quantity, null, tl.topLevelIndex, 10030, counter10030, new Set())
  );
});

// ─── Seeded projects ──────────────────────────────────────────────────────────

export const INITIAL_PROJECTS: MockProject[] = [
  // ── Drafts ──────────────────────────────────────────────────────────────────
  {
    projectId: 1,
    projectNumber: "17559",
    projectName: "Wireless Probe Package — Cell 3",
    customerName: "Customer B",
    status: "Draft",
    dueDate: "2026-08-15",
    priority: 2,
    notes: "Replacement unit for Cell 3 probe mount. Confirm cable routing before compile.",
    createdAt: "2026-05-20T10:30:00.000Z",
    createdByUserId: 3,
    createdByName: "Marcus Hill",
    lastEditedAt: "2026-06-06T14:22:00.000Z",
    lastEditedUserId: 3,
    lastEditedByName: "Marcus Hill",
    topLevelItems: makeTLItems([{ partId: 1924 }]), // 19-08-0-00 Wireless Probe Package
    workOrders: [],
    compiledAt: null,
    nextTopLevelIndex: 2,
  },
  {
    projectId: 2,
    projectNumber: "10256",
    projectName: "Customer A Trunnion — Q2 Build",
    customerName: "Customer A",
    status: "Draft",
    dueDate: "2026-09-01",
    priority: 1,
    notes: null,
    createdAt: "2026-05-28T08:15:00.000Z",
    createdByUserId: 4,
    createdByName: "Rita Alvarez",
    lastEditedAt: "2026-06-05T09:10:00.000Z",
    lastEditedUserId: 4,
    lastEditedByName: "Rita Alvarez",
    topLevelItems: makeTLItems([{ partId: 2254 }]), // 22-15-0-00 Customer A Trunnion Assy
    workOrders: [],
    compiledAt: null,
    nextTopLevelIndex: 2,
  },
  {
    projectId: 3,
    projectNumber: "10236",
    projectName: "Bridgeport Upgrade — Floor 2",
    customerName: "Customer C",
    status: "Draft",
    dueDate: "2026-10-01",
    priority: null,
    notes: "Floor 2 Bridgeport retrofit. BOM has validation issues — escalated to Dan.",
    createdAt: "2026-06-01T13:00:00.000Z",
    createdByUserId: 3,
    createdByName: "Marcus Hill",
    lastEditedAt: "2026-06-07T16:45:00.000Z",
    lastEditedUserId: 5,
    lastEditedByName: "Dan Thompson",
    topLevelItems: makeTLItems([{ partId: 2165, qty: 1 }]), // 22-06-0-00 Bridgeport Upgrade Assembly
    workOrders: [],
    compiledAt: null,
    nextTopLevelIndex: 2,
  },
  // ── Active ───────────────────────────────────────────────────────────────────
  {
    projectId: 4,
    projectNumber: "10121",
    projectName: "PB-M Cell 2024-Q4",
    customerName: "Customer D",
    status: "Active",
    dueDate: "2026-07-15",
    priority: 1,
    notes: "Q4 machine cell build. Probe and cradle sub-assy confirmed in stock.",
    createdAt: "2026-04-10T09:00:00.000Z",
    createdByUserId: 4,
    createdByName: "Rita Alvarez",
    lastEditedAt: "2026-06-04T11:30:00.000Z",
    lastEditedUserId: 4,
    lastEditedByName: "Rita Alvarez",
    topLevelItems: TL_10121,
    workOrders: WOS_10121,
    compiledAt: "2026-04-11T08:45:00.000Z",
    nextTopLevelIndex: TL_10121.length + 1,
  },
  {
    projectId: 5,
    projectNumber: "10030",
    projectName: "PB-M Wrap Drive Integration",
    customerName: "Customer E",
    status: "Active",
    dueDate: "2026-08-30",
    priority: 3,
    notes: null,
    createdAt: "2026-03-25T14:00:00.000Z",
    createdByUserId: 2,
    createdByName: "Jane Chen",
    lastEditedAt: "2026-06-01T10:00:00.000Z",
    lastEditedUserId: 2,
    lastEditedByName: "Jane Chen",
    topLevelItems: TL_10030,
    workOrders: WOS_10030,
    compiledAt: "2026-03-26T09:00:00.000Z",
    nextTopLevelIndex: TL_10030.length + 1,
  },
];

// ─── Mutable project list (pages read/write this via useProjectStore or direct mutation) ──

// In a mockup without Zustand, we pass state down via component useState initialized from INITIAL_PROJECTS.
// The INITIAL_PROJECTS array is the seed; components clone it into local state.

// ─── WO count summary helpers ─────────────────────────────────────────────────

export function woCountSummary(project: MockProject): {
  total: number;
  complete: number;
} {
  const total = project.workOrders.length;
  const complete = project.workOrders.filter((w) => w.status === "Complete").length;
  return { total, complete };
}

export function topLevelWoSummary(
  project: MockProject,
  topLevelIndex: number
): { total: number; complete: number } {
  const wos = project.workOrders.filter(
    (w) => {
      // Find all WOs in this top-level subtree
      // A WO belongs to this subtree if it's a top-level WO with this index,
      // or if its ancestor chain leads to such a WO
      if (w.topLevelIndex === topLevelIndex) return true;
      // Walk up parentWoId chain
      let current: MockWorkOrder | undefined = w;
      while (current?.parentWoId != null) {
        const parent = project.workOrders.find((x) => x.woId === current!.parentWoId);
        if (parent?.topLevelIndex === topLevelIndex) return true;
        current = parent;
      }
      return false;
    }
  );
  return {
    total: wos.length,
    complete: wos.filter((w) => w.status === "Complete").length,
  };
}
