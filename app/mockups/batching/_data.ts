// Batching Lens mockup — synthetic data
// Phase 1: candidate-only workspace. All WOs are Unreleased + stockFulfillmentReviewedAt set.
// Phase 2: Open Production Rows (Open WOs and Open Batches) as drop targets.
// No API calls. No persistence.

import { MOCK_PARTS } from "@/app/mockups/parts/_data";
import { SF_PROJECTS } from "@/app/mockups/stock-fulfillment/_data";
import {
  PROJECT_COLOR_MAP,
  type ProjectColor,
} from "@/app/mockups/project-creation/_data";

export type { ProjectColor };
export { PROJECT_COLOR_MAP };
export { SF_PROJECTS as BT_PROJECTS };

// ─── Routing Templates ────────────────────────────────────────────────────────

export type BtRoutingTemplate = {
  templateId: string;
  templateName: string;
  steps: string[];
};

export const ROUTING_TEMPLATES: Record<string, BtRoutingTemplate> = {
  tmpl_mill: {
    templateId: "tmpl_mill",
    templateName: "Mill / Drill",
    steps: ["Mill", "Drill", "Deburr", "Inspect"],
  },
  tmpl_lathe: {
    templateId: "tmpl_lathe",
    templateName: "Lathe / Turn",
    steps: ["Lathe", "Turn", "Deburr", "Inspect"],
  },
  tmpl_assembly: {
    templateId: "tmpl_assembly",
    templateName: "Assembly",
    steps: ["Prep", "Assembly", "QC"],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type BtWorkOrder = {
  woId: number;
  projectId: number;
  projectNumber: string;
  projectColor: ProjectColor | null;
  // Top-level BOM reference (e.g. "10121.04") — used on chip
  topLevelRef: string;
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  quantity: number; // demand
  priority: number; // 1–5
  dueDate: string | null;
  routingTemplateId: string;
  // All Phase 1 WOs are Unreleased + reviewed
  status: "Unreleased";
  stockFulfillmentReviewedAt: string;
  // BOM ancestry — null for top-level project line items
  parentPartName: string | null;
  // Ancestry from the top-level item down to the immediate parent (for hover tooltip)
  ancestryPath: Array<{ partNumber: string; partName: string }>;
};

// ─── Phase 2: Open Production Row types ──────────────────────────────────────

// mockProductionState:
//   case1 = no current batch; adding candidates opens new headroom
//   case2 = existing batch with some headroom (mockHeadroom >= 0)
//   case3 = batch in terminal/final step; no new members accepted
export type MockProductionState = "case1" | "case2" | "case3";

export type BtOpenWO = {
  openWoId: number;         // unique ID in 50000–59999 range
  projectId: number;
  projectNumber: string;
  projectColor: ProjectColor | null;
  topLevelRef: string;
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  openQty: number;          // existing committed quantity
  priority: number;
  dueDate: string | null;
  routingTemplateId: string;
  // mockup-only: derived from real step-state in implementation
  mockProductionState: MockProductionState;
  mockHeadroom: number;     // capacity remaining (all cases); 0 = no room; use large value for case1
  mockActiveStepIndex: number | null; // null = case1 (no active step); index of current step for case2/case3
  mockCompletedQty: number; // units already completed; 0 for case1/case3
};

export type BtOpenBatch = {
  batchId: string;          // e.g. "OPEN-BATCH-001"
  openBatchWoId: number;    // unique ID in 60000–69999 range (acts as host ID)
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  openQty: number;
  priority: number;
  dueDate: string | null;
  routingTemplateId: string;
  memberWoIds: number[];    // IDs of existing Open WOs in this batch (60100+ range)
  memberProjectNums: string[]; // for display
  // mockup-only
  mockProductionState: MockProductionState;
  mockHeadroom: number;     // capacity remaining (all cases); 0 = no room
  mockActiveStepIndex: number | null; // null = case1; index of current step for case2/case3
  mockCompletedQty: number; // 0 for case1/case3; actual value for case2
};

// ─── WO Generation (BOM walk) ─────────────────────────────────────────────────

const REVIEWED_AT = "2026-06-10T08:00:00.000Z";

function buildBtWOs(
  partId: number,
  quantity: number,
  projectId: number,
  projectNumber: string,
  projectColor: ProjectColor | null,
  projectDueDate: string | null,
  topLevelRef: string,
  woIdCounter: { next: number },
  visited: Set<number>,
  parentPartName: string | null = null,
  ancestryPath: Array<{ partNumber: string; partName: string }> = []
): BtWorkOrder[] {
  if (visited.has(partId)) return [];
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part) return [];

  const visited2 = new Set(visited);
  visited2.add(partId);

  const woId = woIdCounter.next++;
  const priority = ((partId * 7 + projectId) % 5) + 1;

  const wo: BtWorkOrder = {
    woId,
    projectId,
    projectNumber,
    projectColor,
    topLevelRef,
    partId,
    partNumber: part.partNumber,
    partName: part.partName,
    partType: part.partType as "Part" | "Assembly",
    quantity,
    priority,
    dueDate: projectDueDate,
    routingTemplateId: "", // assigned post-generation
    status: "Unreleased",
    stockFulfillmentReviewedAt: REVIEWED_AT,
    parentPartName,
    ancestryPath,
  };

  const children: BtWorkOrder[] = [];
  if (part.childParts) {
    for (const child of part.childParts) {
      children.push(
        ...buildBtWOs(
          child.childPartId,
          quantity * child.quantity,
          projectId,
          projectNumber,
          projectColor,
          projectDueDate,
          topLevelRef,
          woIdCounter,
          visited2,
          part.partName,
          [...ancestryPath, { partNumber: part.partNumber, partName: part.partName }]
        )
      );
    }
  }

  return [wo, ...children];
}

function buildProjectBtWOs(
  projectId: number,
  projectNumber: string,
  projectColor: ProjectColor | null,
  projectDueDate: string | null,
  topLevels: Array<{ partId: number; qty: number; idx: number }>,
  startId: number
): BtWorkOrder[] {
  const woCounter = { next: startId };
  const wos: BtWorkOrder[] = [];
  for (const tl of topLevels) {
    const topLevelRef = `${projectNumber}.${String(tl.idx).padStart(2, "0")}`;
    wos.push(
      ...buildBtWOs(
        tl.partId,
        tl.qty,
        projectId,
        projectNumber,
        projectColor,
        projectDueDate,
        topLevelRef,
        woCounter,
        new Set()
      )
    );
  }
  return wos;
}

// Project meta (consistent with SF_PROJECTS)
const P10121 = SF_PROJECTS.find((p) => p.projectNumber === "10121")!;
const P10030 = SF_PROJECTS.find((p) => p.projectNumber === "10030")!;
const P10412 = SF_PROJECTS.find((p) => p.projectNumber === "10412")!;
const P10489 = SF_PROJECTS.find((p) => p.projectNumber === "10489")!;

const WOS_10121 = buildProjectBtWOs(
  P10121.projectId,
  "10121",
  P10121.color,
  P10121.dueDate,
  [
    { partId: 1908, qty: 1, idx: 1 },
    { partId: 1922, qty: 1, idx: 2 },
    { partId: 2035, qty: 1, idx: 3 },
    { partId: 1942, qty: 1, idx: 4 },
    { partId: 1929, qty: 1, idx: 5 },
    { partId: 1967, qty: 1, idx: 6 },
  ],
  10001
);

const WOS_10030 = buildProjectBtWOs(
  P10030.projectId,
  "10030",
  P10030.color,
  P10030.dueDate,
  [
    { partId: 1951, qty: 1, idx: 1 },
    { partId: 1954, qty: 1, idx: 2 },
    { partId: 2219, qty: 1, idx: 3 },
    { partId: 1943, qty: 1, idx: 4 },
    { partId: 1958, qty: 1, idx: 5 },
    { partId: 2063, qty: 1, idx: 6 },
    { partId: 2066, qty: 1, idx: 7 },
    { partId: 1948, qty: 1, idx: 8 },
  ],
  20001
);

const WOS_10412 = buildProjectBtWOs(
  P10412.projectId,
  "10412",
  P10412.color,
  P10412.dueDate,
  [
    { partId: 1942, qty: 1, idx: 1 },
    { partId: 2035, qty: 1, idx: 2 },
  ],
  30001
);

const WOS_10489 = buildProjectBtWOs(
  P10489.projectId,
  "10489",
  P10489.color,
  P10489.dueDate,
  [
    { partId: 1948, qty: 1, idx: 1 },
    { partId: 2066, qty: 1, idx: 2 },
  ],
  40001
);

const ALL_WOS_BASE: BtWorkOrder[] = [
  ...WOS_10121,
  ...WOS_10030,
  ...WOS_10412,
  ...WOS_10489,
];

// ─── Routing template assignment ──────────────────────────────────────────────

// Each partId maps to exactly one routing template — Assembly → tmpl_assembly,
// Part even partId → tmpl_mill, Part odd → tmpl_lathe.
// (A partId has exactly one routing template by spec definition; the earlier
// mismatch-demo data that split the same partId across templates was structurally invalid.)
function defaultTemplateId(partType: "Part" | "Assembly", partId: number): string {
  if (partType === "Assembly") return "tmpl_assembly";
  return partId % 2 === 0 ? "tmpl_mill" : "tmpl_lathe";
}

export const ALL_BT_WOS: BtWorkOrder[] = ALL_WOS_BASE.map((wo) => ({
  ...wo,
  routingTemplateId: defaultTemplateId(wo.partType, wo.partId),
}));

// ─── Candidate group computation ──────────────────────────────────────────────

export type BtCandidateGroup = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  woIds: number[];
  isSingleton: boolean;
};

// A candidate is a TRUE singleton only if no other WO of its PartID exists anywhere in the
// lens — including other candidates, Open standalone WOs, or Open batches of the same PartID.
// Candidates with an Open host of matching PartID have a composition decision to make and
// must NOT be treated as singletons (they become unlocked by default and visible in Batching).
export function computeCandidateGroups(
  wos: BtWorkOrder[],
  openWos: BtOpenWO[] = [],
  openBatches: BtOpenBatch[] = []
): BtCandidateGroup[] {
  // Build a set of partIds that have Open work in the lens
  const partIdsWithOpenWork = getPartIdsWithOpenWork(openWos, openBatches);

  const byPartId = new Map<number, BtWorkOrder[]>();
  for (const wo of wos) {
    if (!byPartId.has(wo.partId)) byPartId.set(wo.partId, []);
    byPartId.get(wo.partId)!.push(wo);
  }

  const groups: BtCandidateGroup[] = [];
  for (const [partId, partWOs] of byPartId) {
    const first = partWOs[0];
    if (!first) continue;
    // Singleton only when exactly 1 candidate AND no Open work for this PartID
    const isSingleton = partWOs.length === 1 && !partIdsWithOpenWork.has(partId);
    groups.push({
      partId,
      partNumber: first.partNumber,
      partName: first.partName,
      partType: first.partType,
      woIds: partWOs.map((w) => w.woId),
      isSingleton,
    });
  }

  // Non-singletons first (by partId asc), then singletons (by partId asc)
  return groups.sort((a, b) => {
    if (a.isSingleton !== b.isSingleton) return a.isSingleton ? 1 : -1;
    return a.partId - b.partId;
  });
}

// Note: computed before Open data is available in module init order.
// page.tsx recomputes live groups via useMemo with Open data after page load.
export const INITIAL_CANDIDATE_GROUPS: BtCandidateGroup[] =
  computeCandidateGroups(ALL_BT_WOS);

// ─── Default lock state computation ──────────────────────────────────────────

// True singletons default to Locked; all other candidates default to Unlocked.
// "True singleton" = exactly 1 candidate for this PartID AND no Open work in the lens.
// Candidates with Open work to compose with default to Unlocked (composition decision available).
// Called at initial load and on Reset Draft.
export function computeDefaultLockState(
  wos: BtWorkOrder[],
  openWos: BtOpenWO[] = [],
  openBatches: BtOpenBatch[] = []
): { lockedWoIds: Set<number>; plannedQty: Record<number, number | null> } {
  const partIdsWithOpenWork = getPartIdsWithOpenWork(openWos, openBatches);

  const byPartId = new Map<number, BtWorkOrder[]>();
  for (const wo of wos) {
    if (!byPartId.has(wo.partId)) byPartId.set(wo.partId, []);
    byPartId.get(wo.partId)!.push(wo);
  }

  const lockedWoIds = new Set<number>();
  const plannedQty: Record<number, number | null> = {};

  for (const [partId, partWOs] of byPartId) {
    const isTrueSingleton = partWOs.length === 1 && !partIdsWithOpenWork.has(partId);
    if (isTrueSingleton) {
      const wo = partWOs[0]!;
      lockedWoIds.add(wo.woId);
      // True singletons' planned qty defaults to their own demand
      plannedQty[wo.woId] = wo.quantity;
    }
    // Multi-WO candidates and candidates with Open hosts: unlocked, no planned qty set
  }

  return { lockedWoIds, plannedQty };
}

// ─── Phase 2: Open Production Rows data ──────────────────────────────────────

// Helper: derive partNumber, partName, partType from MOCK_PARTS by partId
function getPartInfo(partId: number): { partNumber: string; partName: string; partType: "Part" | "Assembly" } {
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  return {
    partNumber: part?.partNumber ?? `PN-${partId}`,
    partName: part?.partName ?? `Part ${partId}`,
    partType: (part?.partType as "Part" | "Assembly") ?? "Part",
  };
}

export const OPEN_WOS: BtOpenWO[] = [
  // partId 1942 — Upper Housing (Assembly → tmpl_assembly, steps: Prep/Assembly/QC)
  // case1: two Case 1 hosts for same partId → heuristic test (50001 dueDate Jul 15, 50011→50012 below)
  {
    openWoId: 50001,
    projectId: 1,
    projectNumber: "10030",
    projectColor: P10030.color,
    topLevelRef: "10030.04",
    partId: 1942,
    ...getPartInfo(1942),
    openQty: 2,
    priority: 3,
    dueDate: "2026-07-15",
    routingTemplateId: defaultTemplateId(getPartInfo(1942).partType, 1942),
    mockProductionState: "case1",
    mockHeadroom: 8,       // plenty of room
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 1948 — Drive Shaft (even partId → tmpl_mill, steps: Mill/Drill/Deburr/Inspect)
  // case2, tight headroom: only 1 unit of room remaining
  {
    openWoId: 50002,
    projectId: 2,
    projectNumber: "10489",
    projectColor: P10489.color,
    topLevelRef: "10489.01",
    partId: 1948,
    ...getPartInfo(1948),
    openQty: 4,
    priority: 4,
    dueDate: "2026-07-20",
    routingTemplateId: defaultTemplateId(getPartInfo(1948).partType, 1948),
    mockProductionState: "case2",
    mockHeadroom: 1,       // tight: only 1 more unit fits
    mockActiveStepIndex: 2, // active at Deburr (step index 2)
    mockCompletedQty: 3,   // 3 of 4 completed
  },
  // partId 1908 — Base Plate (even → tmpl_mill)
  {
    openWoId: 50003,
    projectId: 3,
    projectNumber: "10121",
    projectColor: P10121.color,
    topLevelRef: "10121.01",
    partId: 1908,
    ...getPartInfo(1908),
    openQty: 3,
    priority: 5,
    dueDate: "2026-06-30",
    routingTemplateId: defaultTemplateId(getPartInfo(1908).partType, 1908),
    mockProductionState: "case1",
    mockHeadroom: 9,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 1951 — End Cap Left (odd → tmpl_lathe, steps: Lathe/Turn/Deburr/Inspect)
  {
    openWoId: 50004,
    projectId: 4,
    projectNumber: "10030",
    projectColor: P10030.color,
    topLevelRef: "10030.01",
    partId: 1951,
    ...getPartInfo(1951),
    openQty: 6,
    priority: 2,
    dueDate: "2026-08-01",
    routingTemplateId: defaultTemplateId(getPartInfo(1951).partType, 1951),
    mockProductionState: "case1",
    mockHeadroom: 10,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 2035 — Cover Panel (odd → tmpl_lathe) — case3: active at Inspect (index 3, last)
  {
    openWoId: 50005,
    projectId: 5,
    projectNumber: "10412",
    projectColor: P10412.color,
    topLevelRef: "10412.02",
    partId: 2035,
    ...getPartInfo(2035),
    openQty: 1,
    priority: 1,
    dueDate: "2026-07-10",
    routingTemplateId: defaultTemplateId(getPartInfo(2035).partType, 2035),
    mockProductionState: "case3",
    mockHeadroom: 3,       // planner-verified capacity, shown in red
    mockActiveStepIndex: 3, // active at Inspect (final step, index 3)
    mockCompletedQty: 0,
  },
  // partId 1967 — Bushing Retainer (odd → tmpl_lathe)
  {
    openWoId: 50006,
    projectId: 6,
    projectNumber: "10121",
    projectColor: P10121.color,
    topLevelRef: "10121.06",
    partId: 1967,
    ...getPartInfo(1967),
    openQty: 8,
    priority: 3,
    dueDate: "2026-07-25",
    routingTemplateId: defaultTemplateId(getPartInfo(1967).partType, 1967),
    mockProductionState: "case1",
    mockHeadroom: 12,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 1954 — End Cap Right (even → tmpl_mill) — case2 with good headroom
  {
    openWoId: 50007,
    projectId: 7,
    projectNumber: "10030",
    projectColor: P10030.color,
    topLevelRef: "10030.02",
    partId: 1954,
    ...getPartInfo(1954),
    openQty: 5,
    priority: 2,
    dueDate: "2026-08-05",
    routingTemplateId: defaultTemplateId(getPartInfo(1954).partType, 1954),
    mockProductionState: "case2",
    mockHeadroom: 3,       // 3 more units fit
    mockActiveStepIndex: 1, // active at Drill (index 1)
    mockCompletedQty: 2,   // 2 of 5 completed
  },
  // partId 2066 — Gear Assembly (Assembly → tmpl_assembly)
  {
    openWoId: 50008,
    projectId: 8,
    projectNumber: "10489",
    projectColor: P10489.color,
    topLevelRef: "10489.02",
    partId: 2066,
    ...getPartInfo(2066),
    openQty: 2,
    priority: 4,
    dueDate: "2026-07-18",
    routingTemplateId: defaultTemplateId(getPartInfo(2066).partType, 2066),
    mockProductionState: "case1",
    mockHeadroom: 8,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 2219 — Spindle Housing (odd → tmpl_lathe) — case2, zero headroom (non-actionable)
  {
    openWoId: 50009,
    projectId: 9,
    projectNumber: "10030",
    projectColor: P10030.color,
    topLevelRef: "10030.03",
    partId: 2219,
    ...getPartInfo(2219),
    openQty: 1,
    priority: 5,
    dueDate: "2026-06-28",
    routingTemplateId: defaultTemplateId(getPartInfo(2219).partType, 2219),
    mockProductionState: "case2",
    mockHeadroom: 0,       // full; non-actionable → hidden by implicit filter
    mockActiveStepIndex: 2, // active at Deburr
    mockCompletedQty: 1,
  },
  // partId 1922 — Side Bracket (even → tmpl_mill)
  {
    openWoId: 50010,
    projectId: 10,
    projectNumber: "10121",
    projectColor: P10121.color,
    topLevelRef: "10121.02",
    partId: 1922,
    ...getPartInfo(1922),
    openQty: 3,
    priority: 3,
    dueDate: "2026-07-30",
    routingTemplateId: defaultTemplateId(getPartInfo(1922).partType, 1922),
    mockProductionState: "case1",
    mockHeadroom: 7,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 1948 — Drive Shaft — case1, later due date (heuristic: pick this over 50002)
  {
    openWoId: 50011,
    projectId: 11,
    projectNumber: "10030",
    projectColor: P10030.color,
    topLevelRef: "10030.08",
    partId: 1948,
    ...getPartInfo(1948),
    openQty: 4,
    priority: 4,
    dueDate: "2026-08-10",   // later than 50002 (Jul 20) → heuristic picks this one
    routingTemplateId: defaultTemplateId(getPartInfo(1948).partType, 1948),
    mockProductionState: "case1",
    mockHeadroom: 6,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 2035 — Cover Panel — case1 (second Case 1 host for same partId)
  {
    openWoId: 50012,
    projectId: 12,
    projectNumber: "10121",
    projectColor: P10121.color,
    topLevelRef: "10121.03",
    partId: 2035,
    ...getPartInfo(2035),
    openQty: 1,
    priority: 2,
    dueDate: "2026-07-22",
    routingTemplateId: defaultTemplateId(getPartInfo(2035).partType, 2035),
    mockProductionState: "case1",
    mockHeadroom: 5,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 1942 — Upper Housing — case3 (Assembly → tmpl_assembly, steps: Prep/Assembly/QC)
  {
    openWoId: 50013,
    projectId: 13,
    projectNumber: "10412",
    projectColor: P10412.color,
    topLevelRef: "10412.01",
    partId: 1942,
    ...getPartInfo(1942),
    openQty: 2,
    priority: 3,
    dueDate: "2026-08-15",
    routingTemplateId: defaultTemplateId(getPartInfo(1942).partType, 1942),
    mockProductionState: "case3",
    mockHeadroom: 4,       // planner-verified, shown in red
    mockActiveStepIndex: 2, // active at QC (final step for tmpl_assembly, index 2)
    mockCompletedQty: 0,
  },
  // partId 1929 — Pivot Pin (odd → tmpl_lathe)
  {
    openWoId: 50014,
    projectId: 14,
    projectNumber: "10121",
    projectColor: P10121.color,
    topLevelRef: "10121.05",
    partId: 1929,
    ...getPartInfo(1929),
    openQty: 10,
    priority: 1,
    dueDate: "2026-07-05",
    routingTemplateId: defaultTemplateId(getPartInfo(1929).partType, 1929),
    mockProductionState: "case1",
    mockHeadroom: 15,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 2063 — Seal Ring (odd → tmpl_lathe)
  {
    openWoId: 50015,
    projectId: 15,
    projectNumber: "10030",
    projectColor: P10030.color,
    topLevelRef: "10030.06",
    partId: 2063,
    ...getPartInfo(2063),
    openQty: 12,
    priority: 2,
    dueDate: "2026-08-20",
    routingTemplateId: defaultTemplateId(getPartInfo(2063).partType, 2063),
    mockProductionState: "case1",
    mockHeadroom: 18,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
];

export const OPEN_BATCHES: BtOpenBatch[] = [
  // partId 1942 (Upper Housing, Assembly → tmpl_assembly) — case1, another Case 1 host for heuristic test
  // dueDate Jul 12 — earlier than 50001 (Jul 15) and 50013 (Aug 15) → heuristic picks 50013 (latest)
  {
    batchId: "OPEN-BATCH-001",
    openBatchWoId: 60001,
    partId: 1942,
    ...getPartInfo(1942),
    openQty: 5,
    priority: 3,
    dueDate: "2026-07-12",
    routingTemplateId: defaultTemplateId(getPartInfo(1942).partType, 1942),
    memberWoIds: [60101, 60102],
    memberProjectNums: ["10030", "10489"],
    mockProductionState: "case1",
    mockHeadroom: 6,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 1948 (Drive Shaft, even → tmpl_mill) — case2 with insufficient headroom (non-actionable)
  {
    batchId: "OPEN-BATCH-002",
    openBatchWoId: 60002,
    partId: 1948,
    ...getPartInfo(1948),
    openQty: 8,
    priority: 4,
    dueDate: "2026-07-08",
    routingTemplateId: defaultTemplateId(getPartInfo(1948).partType, 1948),
    memberWoIds: [60103, 60104],
    memberProjectNums: ["10121", "10030"],
    mockProductionState: "case2",
    mockHeadroom: 0,       // full; non-actionable → hidden by implicit filter
    mockActiveStepIndex: 1, // active at Drill
    mockCompletedQty: 7,
  },
  // partId 2066 (Gear Assembly → tmpl_assembly) — case1
  {
    batchId: "OPEN-BATCH-003",
    openBatchWoId: 60003,
    partId: 2066,
    ...getPartInfo(2066),
    openQty: 3,
    priority: 4,
    dueDate: "2026-07-25",
    routingTemplateId: defaultTemplateId(getPartInfo(2066).partType, 2066),
    memberWoIds: [60105, 60106, 60107],
    memberProjectNums: ["10121", "10412", "10489"],
    mockProductionState: "case1",
    mockHeadroom: 7,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
  // partId 1951 (End Cap Left, odd → tmpl_lathe) — case3: active at Inspect (index 3, final)
  {
    batchId: "OPEN-BATCH-004",
    openBatchWoId: 60004,
    partId: 1951,
    ...getPartInfo(1951),
    openQty: 4,
    priority: 2,
    dueDate: "2026-07-30",
    routingTemplateId: defaultTemplateId(getPartInfo(1951).partType, 1951),
    memberWoIds: [60108, 60109],
    memberProjectNums: ["10030", "10121"],
    mockProductionState: "case3",
    mockHeadroom: 3,       // planner-verified, shown in red
    mockActiveStepIndex: 3, // active at Inspect (final step, index 3)
    mockCompletedQty: 0,
  },
  // partId 1954 (End Cap Right, even → tmpl_mill) — case2 with sufficient headroom (actionable)
  {
    batchId: "OPEN-BATCH-005",
    openBatchWoId: 60005,
    partId: 1954,
    ...getPartInfo(1954),
    openQty: 6,
    priority: 2,
    dueDate: "2026-08-02",
    routingTemplateId: defaultTemplateId(getPartInfo(1954).partType, 1954),
    memberWoIds: [60110, 60111],
    memberProjectNums: ["10030", "10412"],
    mockProductionState: "case2",
    mockHeadroom: 4,       // 4 units still fit
    mockActiveStepIndex: 1, // active at Drill
    mockCompletedQty: 3,
  },
  // partId 2063 (Seal Ring, odd → tmpl_lathe) — case1
  {
    batchId: "OPEN-BATCH-006",
    openBatchWoId: 60006,
    partId: 2063,
    ...getPartInfo(2063),
    openQty: 8,
    priority: 2,
    dueDate: "2026-08-10",
    routingTemplateId: defaultTemplateId(getPartInfo(2063).partType, 2063),
    memberWoIds: [60112, 60113, 60114],
    memberProjectNums: ["10030", "10489"],
    mockProductionState: "case1",
    mockHeadroom: 12,
    mockActiveStepIndex: null,
    mockCompletedQty: 0,
  },
];

// ─── Phase 2: Open row helper functions ──────────────────────────────────────

// Returns the set of partIds that have at least one Open Production Row (WO or batch)
export function getPartIdsWithOpenWork(
  openWos: BtOpenWO[],
  openBatches: BtOpenBatch[]
): Set<number> {
  const result = new Set<number>();
  for (const wo of openWos) result.add(wo.partId);
  for (const batch of openBatches) result.add(batch.partId);
  return result;
}

// Returns combined set of openWoId and openBatchWoId — used to identify "Open row host IDs"
export function getOpenRowHostIds(
  openWos: BtOpenWO[],
  openBatches: BtOpenBatch[]
): Set<number> {
  const result = new Set<number>();
  for (const wo of openWos) result.add(wo.openWoId);
  for (const batch of openBatches) result.add(batch.openBatchWoId);
  return result;
}

// Whether an Open row accepts drops: Case 1 only
export function isEligibleOpenTarget(
  openHostId: number,
  openWos: BtOpenWO[],
  openBatches: BtOpenBatch[]
): boolean {
  const openWo = openWos.find((w) => w.openWoId === openHostId);
  if (openWo) return openWo.mockProductionState === "case1";
  const openBatch = openBatches.find((b) => b.openBatchWoId === openHostId);
  if (openBatch) return openBatch.mockProductionState === "case1";
  return false;
}

// ─── Session state ─────────────────────────────────────────────────────────────

export type BtSessionState = {
  // chipHome[woId] = hostWoId where the chip currently lives (initially woId itself)
  // For chips placed on Open rows, hostWoId is the openWoId or openBatchWoId.
  chipHome: Record<number, number>;
  // lockedWoIds: WO IDs of rows that are locked (composition settled, quantity planning active).
  // Singletons default to Locked. Multi-WO candidates default to Unlocked.
  lockedWoIds: Set<number>;
  // plannedQty[hostWoId] = planned qty for locked rows (null = not set / unlocked row)
  plannedQty: Record<number, number | null>;
  // confirmedWoIds: WOs transitioned to Open (removed from view)
  confirmedWoIds: Set<number>;
  // committedBatches: created at Confirm Draft
  committedBatches: Array<{
    batchId: string;
    memberWoIds: number[];
    isStandalone: boolean;
  }>;
  // showHiddenSingletons: whether the singleton queue is visible
  showHiddenSingletons: boolean;
  // Phase 2: draft chip additions to Open rows.
  // openRowChips[openHostId] = array of candidate woIds dragged onto this Open row in current draft
  openRowChips: Record<number, number[]>;
  // Auto-batch tier selection (persisted across uses in session)
  autoBatchTier: "candidates-only" | "include-unstarted-wip";
};

export function buildInitialSessionState(wos: BtWorkOrder[]): BtSessionState {
  const chipHome: Record<number, number> = {};
  for (const wo of wos) {
    chipHome[wo.woId] = wo.woId;
  }

  const { lockedWoIds, plannedQty } = computeDefaultLockState(wos, OPEN_WOS, OPEN_BATCHES);

  return {
    chipHome,
    lockedWoIds,
    plannedQty,
    confirmedWoIds: new Set(),
    committedBatches: [],
    showHiddenSingletons: false,
    openRowChips: {},
    autoBatchTier: "candidates-only",
  };
}

export const INITIAL_SESSION_STATE: BtSessionState =
  buildInitialSessionState(ALL_BT_WOS);

// ─── Derived computations ─────────────────────────────────────────────────────

// All woIds whose chip is currently in hostWoId's cell
export function getChipsInCell(
  chipHome: Record<number, number>,
  hostWoId: number
): number[] {
  return Object.entries(chipHome)
    .filter(([, host]) => host === hostWoId)
    .map(([id]) => Number(id));
}

export type DerivedRowValues = {
  demand: number;
  priority: number;
  dueDate: string | null;
  isDraftBatch: boolean; // true when cell has 2+ chips
  // per-field change flags for bright blue signaling
  demandChanged: boolean;
  priorityChanged: boolean;
  dueDateChanged: boolean;
  chipsInCell: number[];
  hasChips: boolean; // cell has at least one chip
};

export function getDerivedRowValues(
  hostWoId: number,
  wos: BtWorkOrder[],
  chipHome: Record<number, number>
): DerivedRowValues {
  const chipsInCell = getChipsInCell(chipHome, hostWoId);
  const homeWo = wos.find((w) => w.woId === hostWoId)!;

  if (chipsInCell.length === 0) {
    return {
      demand: homeWo.quantity,
      priority: homeWo.priority,
      dueDate: homeWo.dueDate,
      isDraftBatch: false,
      demandChanged: false,
      priorityChanged: false,
      dueDateChanged: false,
      chipsInCell: [],
      hasChips: false,
    };
  }

  const chipWOs = chipsInCell
    .map((id) => wos.find((w) => w.woId === id)!)
    .filter(Boolean);

  const demand = chipWOs.reduce((sum, w) => sum + w.quantity, 0);
  const priority = Math.max(...chipWOs.map((w) => w.priority));
  const nonNullDates = chipWOs
    .map((w) => w.dueDate)
    .filter((d): d is string => d !== null)
    .sort();
  const dueDate: string | null = nonNullDates.length > 0 ? (nonNullDates[0] ?? null) : null;

  return {
    demand,
    priority,
    dueDate,
    isDraftBatch: chipsInCell.length >= 2,
    demandChanged: demand !== homeWo.quantity,
    priorityChanged: priority !== homeWo.priority,
    dueDateChanged: dueDate !== homeWo.dueDate,
    chipsInCell,
    hasChips: true,
  };
}

// Derived values for an Open row with draft chips added
export type OpenRowDerivedValues = {
  demand: number;         // openQty + sum of draft candidate demands
  priority: number;       // max(openRow.priority, ...draftChip.priorities)
  dueDate: string | null; // min(openRow.dueDate, ...draftChip.dueDates)
  demandChanged: boolean;
  priorityChanged: boolean;
  dueDateChanged: boolean;
};

export function getOpenRowDerivedValues(
  openHostId: number,
  openWos: BtOpenWO[],
  openBatches: BtOpenBatch[],
  draftChipWoIds: number[],
  candidateWos: BtWorkOrder[]
): OpenRowDerivedValues {
  const openWo = openWos.find((w) => w.openWoId === openHostId);
  const openBatch = openBatches.find((b) => b.openBatchWoId === openHostId);

  const baseQty = openWo?.openQty ?? openBatch?.openQty ?? 0;
  const basePriority = openWo?.priority ?? openBatch?.priority ?? 1;
  const baseDueDate = openWo?.dueDate ?? openBatch?.dueDate ?? null;

  if (draftChipWoIds.length === 0) {
    return {
      demand: baseQty,
      priority: basePriority,
      dueDate: baseDueDate,
      demandChanged: false,
      priorityChanged: false,
      dueDateChanged: false,
    };
  }

  const chipWOs = draftChipWoIds
    .map((id) => candidateWos.find((w) => w.woId === id)!)
    .filter(Boolean);

  const addedDemand = chipWOs.reduce((sum, w) => sum + w.quantity, 0);
  const demand = baseQty + addedDemand;
  const priority = Math.max(basePriority, ...chipWOs.map((w) => w.priority));

  const draftDates = chipWOs
    .map((w) => w.dueDate)
    .filter((d): d is string => d !== null);
  const allDates = [
    ...(baseDueDate ? [baseDueDate] : []),
    ...draftDates,
  ].sort();
  const dueDate: string | null = allDates.length > 0 ? (allDates[0] ?? null) : null;

  return {
    demand,
    priority,
    dueDate,
    demandChanged: demand !== baseQty,
    priorityChanged: priority !== basePriority,
    dueDateChanged: dueDate !== baseDueDate,
  };
}

// Eligibility rule (re-derived from first principles to fix de-emphasis bug):
//
// A chip C can drop on row R when:
//   Rule 1: R is C's own home row (targetHostWoId === dragWoId), OR
//   Rule 2: R is a host row (root WO chip present in cell) AND C shares R's PartID.
//
// Root WO immobility: a chip is the root of its home row. The root is anchored ONLY
// when the row is in HOST state (root + guests). In HOME state (root alone), the root
// chip is draggable — that is how manual batches are formed from the initial state.
//
// Shell rows (chip has moved away, cell empty) are valid only for their own root returning
// home (Rule 1). No other chip may land on a shell row.
//
// The prior implementation allowed "drop on current host" as a shortcut before the PartID
// check. This conflated the home-row case with peer-row eligibility, producing incorrect
// de-emphasis when the drag source chip was at home (the common default state).
export function isEligibleTarget(
  dragWoId: number,
  targetHostWoId: number,
  wos: BtWorkOrder[],
  chipHome: Record<number, number>,
  confirmedWoIds: Set<number>,
  lockedWoIds: Set<number>
): boolean {
  if (confirmedWoIds.has(targetHostWoId)) return false;
  if (confirmedWoIds.has(dragWoId)) return false;

  // Lock constraints: chips cannot leave locked rows; locked rows cannot receive chips.
  const currentHost = chipHome[dragWoId];
  if (currentHost !== undefined && lockedWoIds.has(currentHost)) return false;
  if (lockedWoIds.has(targetHostWoId)) return false;

  // Rule 1: a chip can always return to its own home row.
  if (targetHostWoId === dragWoId) return true;

  // Root WO immobility: root chip cannot leave when its row is in HOST state
  // (root present + at least one guest). In HOME state (root alone), the chip IS
  // draggable — this is how the planner manually forms batches.
  //
  // Bug in prior version: fired unconditionally when currentHost === dragWoId, blocking
  // ALL home-state drags and making manual batch formation impossible. The host-state
  // guard (rowOccupancy > 1) is the correct discriminator.
  if (currentHost === dragWoId) {
    const rowOccupancy = Object.values(chipHome).filter((h) => h === dragWoId).length;
    if (rowOccupancy > 1) return false; // host state → root anchored
    // home state (occupancy === 1) → root can leave to form a batch
  }

  // Rule 2: target must be a host row — its root WO chip must still be present in the cell.
  // Shell rows (chipHome[target] ≠ target) are invalid drop targets for any other chip.
  if (chipHome[targetHostWoId] !== targetHostWoId) return false;

  // PartID match: chips compose only with peers of the same PartID.
  const dragWo = wos.find((w) => w.woId === dragWoId);
  const targetWo = wos.find((w) => w.woId === targetHostWoId);
  if (!dragWo || !targetWo) return false;
  return dragWo.partId === targetWo.partId;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

let _batchIdCounter = 1;

export function moveChip(
  woId: number,
  targetHostWoId: number,
  state: BtSessionState,
  wos: BtWorkOrder[]
): BtSessionState {
  const currentHost = state.chipHome[woId];
  if (currentHost === targetHostWoId) return state; // no-op

  if (
    !isEligibleTarget(
      woId,
      targetHostWoId,
      wos,
      state.chipHome,
      state.confirmedWoIds,
      state.lockedWoIds
    )
  ) {
    return state;
  }

  const newChipHome = { ...state.chipHome, [woId]: targetHostWoId };

  console.log(
    `[AuditLog] Chip WO-${woId} moved: cell ${currentHost} → cell ${targetHostWoId}`
  );

  return { ...state, chipHome: newChipHome };
}

// Open chips (the identity chip shown on Open rows) are static divs in the UI — not
// created with useDraggable, so they are immobile by construction. This guard ensures
// the data layer also rejects any attempt to move an Open chip via the chipHome map.
// (Defensive: the UI already prevents this from the user side.)

// Add a candidate chip to an Open row's draft composition
export function addChipToOpenRow(
  candidateWoId: number,
  openHostId: number,
  state: BtSessionState
): BtSessionState {
  const existing = state.openRowChips[openHostId] ?? [];
  if (existing.includes(candidateWoId)) return state;
  const newOpenRowChips = {
    ...state.openRowChips,
    [openHostId]: [...existing, candidateWoId],
  };
  // Also record where the candidate chip is "homed" — it's now at the open row
  const newChipHome = { ...state.chipHome, [candidateWoId]: openHostId };
  console.log(
    `[AuditLog] Chip WO-${candidateWoId} assigned to Open row ${openHostId}`
  );
  return { ...state, openRowChips: newOpenRowChips, chipHome: newChipHome };
}

// Remove a candidate chip from an Open row (return it home)
export function removeChipFromOpenRow(
  candidateWoId: number,
  openHostId: number,
  state: BtSessionState
): BtSessionState {
  const existing = state.openRowChips[openHostId] ?? [];
  const newList = existing.filter((id) => id !== candidateWoId);
  const newOpenRowChips = { ...state.openRowChips };
  if (newList.length === 0) {
    delete newOpenRowChips[openHostId];
  } else {
    newOpenRowChips[openHostId] = newList;
  }
  const newChipHome = { ...state.chipHome, [candidateWoId]: candidateWoId };
  console.log(
    `[AuditLog] Chip WO-${candidateWoId} removed from Open row ${openHostId}, returned home`
  );
  return { ...state, openRowChips: newOpenRowChips, chipHome: newChipHome };
}

// Lock/unlock a single row. Disabled for source rows (chip moved away).
export function toggleLock(
  hostWoId: number,
  state: BtSessionState,
  wos: BtWorkOrder[]
): BtSessionState {
  // Source rows cannot be locked independently
  const isSourceRow = state.chipHome[hostWoId] !== hostWoId;
  if (isSourceRow) return state;

  const isCurrentlyLocked = state.lockedWoIds.has(hostWoId);
  const newLockedWoIds = new Set(state.lockedWoIds);
  const newPlannedQty = { ...state.plannedQty };

  if (isCurrentlyLocked) {
    newLockedWoIds.delete(hostWoId);
    delete newPlannedQty[hostWoId];
  } else {
    newLockedWoIds.add(hostWoId);
    const derived = getDerivedRowValues(hostWoId, wos, state.chipHome);
    newPlannedQty[hostWoId] = derived.demand;
  }

  return { ...state, lockedWoIds: newLockedWoIds, plannedQty: newPlannedQty };
}

// Multi-select: lock a set of WO IDs (skips source rows and already-locked rows silently)
export function lockMultiple(
  woIds: number[],
  state: BtSessionState,
  wos: BtWorkOrder[]
): { newState: BtSessionState; count: number } {
  const newLockedWoIds = new Set(state.lockedWoIds);
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;

  for (const woId of woIds) {
    if (state.chipHome[woId] !== woId) continue; // source row — skip
    if (state.lockedWoIds.has(woId)) continue; // already locked — skip

    newLockedWoIds.add(woId);
    const derived = getDerivedRowValues(woId, wos, state.chipHome);
    newPlannedQty[woId] = derived.demand;
    count++;
  }

  return {
    newState: { ...state, lockedWoIds: newLockedWoIds, plannedQty: newPlannedQty },
    count,
  };
}

// Multi-select: unlock a set of WO IDs (skips already-unlocked rows silently, clears planned qty)
export function unlockMultiple(
  woIds: number[],
  state: BtSessionState
): { newState: BtSessionState; count: number } {
  const newLockedWoIds = new Set(state.lockedWoIds);
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;

  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue; // already unlocked — skip

    newLockedWoIds.delete(woId);
    delete newPlannedQty[woId];
    count++;
  }

  return {
    newState: { ...state, lockedWoIds: newLockedWoIds, plannedQty: newPlannedQty },
    count,
  };
}

// Multi-select: reset planned qty to demand for locked rows (skips unlocked rows silently)
export function resetPlannedToDemand(
  woIds: number[],
  state: BtSessionState,
  wos: BtWorkOrder[]
): { newState: BtSessionState; count: number } {
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;

  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue; // unlocked — skip
    const derived = getDerivedRowValues(woId, wos, state.chipHome);
    const current = state.plannedQty[woId] ?? derived.demand;
    if (current !== derived.demand) {
      newPlannedQty[woId] = derived.demand;
      count++;
    }
  }

  return { newState: { ...state, plannedQty: newPlannedQty }, count };
}

// Multi-select: set planned qty = N × Demand for locked rows (skips unlocked silently)
export function multiplyPlannedQty(
  woIds: number[],
  multiplier: number,
  state: BtSessionState,
  wos: BtWorkOrder[]
): { newState: BtSessionState; count: number } {
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;

  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue;
    const derived = getDerivedRowValues(woId, wos, state.chipHome);
    const newQty = Math.max(Math.round(derived.demand * multiplier), derived.demand);
    newPlannedQty[woId] = newQty;
    count++;
  }

  return { newState: { ...state, plannedQty: newPlannedQty }, count };
}

// Multi-select: set planned qty = Demand + N for locked rows (skips unlocked silently)
export function addToPlannedQty(
  woIds: number[],
  addend: number,
  state: BtSessionState,
  wos: BtWorkOrder[]
): { newState: BtSessionState; count: number } {
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;

  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue;
    const derived = getDerivedRowValues(woId, wos, state.chipHome);
    const current = state.plannedQty[woId] ?? derived.demand;
    newPlannedQty[woId] = Math.max(current + addend, derived.demand);
    count++;
  }

  return { newState: { ...state, plannedQty: newPlannedQty }, count };
}

export function updatePlannedQty(
  hostWoId: number,
  qty: number | null,
  state: BtSessionState
): BtSessionState {
  return {
    ...state,
    plannedQty: { ...state.plannedQty, [hostWoId]: qty },
  };
}

export type ConfirmDraftResult = {
  newState: BtSessionState;
  stats: { totalWOs: number; draftBatches: number; standalone: number; openRowsExtended: number };
};

// Confirm Draft scoped to visibleLockedHostWoIds — the set of WO IDs
// that are both (a) locked and (b) visible in the current view + filters.
// The UI computes this set and passes it in.
// Phase 2: also commits Open rows that received draft chip additions in openRowChips.
export function confirmDraft(
  state: BtSessionState,
  wos: BtWorkOrder[],
  visibleLockedHostWoIds: Set<number>
): ConfirmDraftResult {
  const newConfirmedWoIds = new Set(state.confirmedWoIds);
  const newCommittedBatches = [...state.committedBatches];
  let draftBatches = 0;
  let standalone = 0;
  let totalWOs = 0;
  let openRowsExtended = 0;

  // Commit candidate-to-candidate batches (original Phase 1 logic)
  for (const hostWoId of visibleLockedHostWoIds) {
    if (state.confirmedWoIds.has(hostWoId)) continue;

    const chipsInCell = getChipsInCell(state.chipHome, hostWoId);
    if (chipsInCell.length === 0) continue;

    // Exclude chips that are in Open rows (already handled below)
    const openRowHostIds = getOpenRowHostIds(OPEN_WOS, OPEN_BATCHES);
    const nonOpenChips = chipsInCell.filter((id) => !openRowHostIds.has(state.chipHome[id] ?? id) || id === hostWoId);

    const plannedQtyAtCommit =
      state.plannedQty[hostWoId] ??
      nonOpenChips.reduce((sum, id) => {
        const wo = wos.find((w) => w.woId === id);
        return sum + (wo?.quantity ?? 0);
      }, 0);

    totalWOs += nonOpenChips.length;

    if (nonOpenChips.length >= 2) {
      draftBatches++;
      const batchId = `BATCH-${_batchIdCounter++}`;
      newCommittedBatches.push({
        batchId,
        memberWoIds: nonOpenChips,
        isStandalone: false,
      });
      console.log(
        `[AuditLog] Batch ${batchId} created — members: ${nonOpenChips.join(", ")}, plannedQty: ${plannedQtyAtCommit}`
      );
    } else if (nonOpenChips.length === 1) {
      standalone++;
      const batchId = `STANDALONE-${_batchIdCounter++}`;
      newCommittedBatches.push({
        batchId,
        memberWoIds: nonOpenChips,
        isStandalone: true,
      });
      console.log(
        `[AuditLog] WO ${nonOpenChips[0]} confirmed as standalone Open, plannedQty: ${plannedQtyAtCommit}`
      );
    }

    for (const woId of nonOpenChips) {
      newConfirmedWoIds.add(woId);
    }
  }

  // Phase 2: extend Confirm Draft scope to Open rows with draft additions.
  // Open rows that received candidate chips are committed atomically alongside
  // candidate-to-candidate batches. The stats return openRowsExtended so the
  // UI can surface "M Open rows extended" in the confirmation toast.
  for (const [openHostIdStr, draftWoIds] of Object.entries(state.openRowChips)) {
    const openHostId = Number(openHostIdStr);
    if (draftWoIds.length === 0) continue;

    for (const candidateWoId of draftWoIds) {
      if (!newConfirmedWoIds.has(candidateWoId)) {
        newConfirmedWoIds.add(candidateWoId);
        totalWOs += 1;
      }
    }
    openRowsExtended++;

    console.log(
      `[AuditLog] Open row ${openHostId} extended with candidates: ${draftWoIds.join(", ")}`
    );
  }

  // Remove confirmed WOs from mutable state
  const newChipHome = { ...state.chipHome };
  const newLockedWoIds = new Set(state.lockedWoIds);
  const newPlannedQty = { ...state.plannedQty };
  const newOpenRowChips = { ...state.openRowChips };

  for (const woId of newConfirmedWoIds) {
    if (!state.confirmedWoIds.has(woId)) {
      delete newChipHome[woId];
      newLockedWoIds.delete(woId);
      delete newPlannedQty[woId];
    }
  }

  // Re-home any chips that were pointing at a now-confirmed host
  for (const [chipWoIdStr, hostId] of Object.entries(newChipHome)) {
    const chipWoId = Number(chipWoIdStr);
    if (newConfirmedWoIds.has(hostId) && !newConfirmedWoIds.has(chipWoId)) {
      newChipHome[chipWoId] = chipWoId;
    }
  }

  // Clear open row chips for confirmed WOs
  for (const [openHostIdStr, draftWoIds] of Object.entries(newOpenRowChips)) {
    const openHostId = Number(openHostIdStr);
    const remaining = draftWoIds.filter((id) => !newConfirmedWoIds.has(id));
    if (remaining.length === 0) {
      delete newOpenRowChips[openHostId];
    } else {
      newOpenRowChips[openHostId] = remaining;
    }
  }

  return {
    newState: {
      ...state,
      chipHome: newChipHome,
      lockedWoIds: newLockedWoIds,
      plannedQty: newPlannedQty,
      confirmedWoIds: newConfirmedWoIds,
      committedBatches: newCommittedBatches,
      openRowChips: newOpenRowChips,
    },
    stats: { totalWOs, draftBatches, standalone, openRowsExtended },
  };
}

// ─── Auto-Batch Candidates ────────────────────────────────────────────────────

export type AutoBatchResult = {
  newState: BtSessionState;
  stats: { totalBatched: number; batchesCreated: number };
};

export function autoBatchCandidates(
  state: BtSessionState,
  wos: BtWorkOrder[],
  visibleWoIds: number[],
  // The set of hostWoIds that are Open Production Rows.
  // The auto-batcher excludes any chip whose current host is in this set —
  // those represent explicit planner decisions to join existing Open work.
  openRowHostWoIds: Set<number>,
  tier: "candidates-only" | "include-unstarted-wip" = "candidates-only",
  openWos: BtOpenWO[] = OPEN_WOS,
  openBatches: BtOpenBatch[] = OPEN_BATCHES
): AutoBatchResult {
  // Step 1: classify each visible chip as eligible or excluded.
  const eligibleWoIds: number[] = [];
  for (const woId of visibleWoIds) {
    const currentHost = state.chipHome[woId];
    if (currentHost === undefined) continue;

    // Phase 2 branch: chip manually placed onto an Open Production Row → exclude.
    if (openRowHostWoIds.has(currentHost) && currentHost !== woId) continue;

    // Lock constraint: chips in locked rows are immobile — auto-batch skips them.
    if (state.lockedWoIds.has(currentHost)) continue;

    eligibleWoIds.push(woId);
  }

  // Step 2: reset all eligible chips to home.
  const newChipHome = { ...state.chipHome };
  for (const woId of eligibleWoIds) {
    newChipHome[woId] = woId;
  }

  // Also reset openRowChips for eligible candidates (they're being re-batched)
  const newOpenRowChips = { ...state.openRowChips };
  for (const [openHostIdStr, draftWoIds] of Object.entries(newOpenRowChips)) {
    const remaining = draftWoIds.filter((id) => !eligibleWoIds.includes(id));
    if (remaining.length === 0) {
      delete newOpenRowChips[Number(openHostIdStr)];
    } else {
      newOpenRowChips[Number(openHostIdStr)] = remaining;
    }
  }

  // Step 3: group eligible candidates by partId.
  const byPartId = new Map<number, number[]>();
  for (const woId of eligibleWoIds) {
    const wo = wos.find((w) => w.woId === woId);
    if (!wo) continue;
    if (!byPartId.has(wo.partId)) byPartId.set(wo.partId, []);
    byPartId.get(wo.partId)!.push(woId);
  }

  // Step 4: form one draft batch per partId group with 2+ eligible members.
  // Host = lowest WO ID in the group (deterministic).
  let totalBatched = 0;
  let batchesCreated = 0;

  for (const [partIdStr, woIds] of byPartId) {
    const partId = Number(partIdStr);
    if (woIds.length < 2) {
      // "include-unstarted-wip" tier: try to match singleton to Case 1 Open row
      if (tier === "include-unstarted-wip" && woIds.length === 1) {
        const candidateWoId = woIds[0]!;
        // Find Case 1 Open rows for this partId
        const case1OpenWos = openWos.filter(
          (w) => w.partId === partId && w.mockProductionState === "case1"
        );
        const case1OpenBatches = openBatches.filter(
          (b) => b.partId === partId && b.mockProductionState === "case1"
        );

        // Combine and pick best host: prefer latest dueDate, then lowest openHostId
        type OpenHost = { openHostId: number; dueDate: string | null };
        const candidates: OpenHost[] = [
          ...case1OpenWos.map((w) => ({ openHostId: w.openWoId, dueDate: w.dueDate })),
          ...case1OpenBatches.map((b) => ({ openHostId: b.openBatchWoId, dueDate: b.dueDate })),
        ];

        if (candidates.length > 0) {
          // Sort: latest dueDate first (nulls last), then lowest openHostId
          candidates.sort((a, b) => {
            if (a.dueDate && b.dueDate) return b.dueDate.localeCompare(a.dueDate);
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            return a.openHostId - b.openHostId;
          });

          const bestHost = candidates[0]!;
          // Assign chip to this Open row
          newChipHome[candidateWoId] = bestHost.openHostId;
          const existingDraft = newOpenRowChips[bestHost.openHostId] ?? [];
          newOpenRowChips[bestHost.openHostId] = [...existingDraft, candidateWoId];
          totalBatched += 1;
          batchesCreated += 1; // count as a "batch" for stats
          console.log(
            `[AuditLog] Auto-batch (unstarted-wip) WO-${candidateWoId} → Open row ${bestHost.openHostId}`
          );
        }
      }
      continue;
    }

    const sorted = [...woIds].sort((a, b) => a - b);
    const hostWoId = sorted[0]!;

    for (const woId of sorted) {
      if (woId !== hostWoId) {
        newChipHome[woId] = hostWoId;
      }
    }

    totalBatched += sorted.length;
    batchesCreated++;
    console.log(
      `[AuditLog] Auto-batch group partId=${wos.find((w) => w.woId === hostWoId)?.partId}: host WO-${hostWoId}, members: ${sorted.join(", ")}`
    );

    // "include-unstarted-wip" tier: also check if Open rows exist for this partId
    // Note: with 2+ candidates already batched together, we don't add them to Open rows
    // (they'll form their own new batch). This tier only helps singletons find a home.
  }

  return {
    newState: { ...state, chipHome: newChipHome, openRowChips: newOpenRowChips },
    stats: { totalBatched, batchesCreated },
  };
}

// ─── Reset Draft ──────────────────────────────────────────────────────────────

// Return ALL chips home, restore default lock states (singletons locked, batch candidates
// unlocked), clear all Planned Qty edits, and clear Open row draft assignments.
export function resetDraft(
  state: BtSessionState,
  wos: BtWorkOrder[]
): BtSessionState {
  const visibleWos = wos.filter((w) => !state.confirmedWoIds.has(w.woId));

  const newChipHome: Record<number, number> = {};
  for (const wo of visibleWos) {
    newChipHome[wo.woId] = wo.woId;
  }

  const { lockedWoIds, plannedQty } = computeDefaultLockState(visibleWos, OPEN_WOS, OPEN_BATCHES);

  console.log("[AuditLog] Draft reset — all chips returned home, lock states restored to defaults, Open row assignments cleared");

  return {
    ...state,
    chipHome: newChipHome,
    lockedWoIds,
    plannedQty,
    openRowChips: {}, // Phase 2: also clear Open row draft assignments
  };
}
