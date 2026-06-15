// Batching Lens mockup — synthetic data
// Phase 1: candidate-only workspace. All WOs are Unreleased + stockFulfillmentReviewedAt set.
// No Active Production Rows (Open WOs/batches) exist in Phase 1 data.
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
  visited: Set<number>
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
          visited2
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

export function computeCandidateGroups(wos: BtWorkOrder[]): BtCandidateGroup[] {
  const byPartId = new Map<number, BtWorkOrder[]>();
  for (const wo of wos) {
    if (!byPartId.has(wo.partId)) byPartId.set(wo.partId, []);
    byPartId.get(wo.partId)!.push(wo);
  }

  const groups: BtCandidateGroup[] = [];
  for (const [partId, partWOs] of byPartId) {
    const first = partWOs[0];
    if (!first) continue;
    groups.push({
      partId,
      partNumber: first.partNumber,
      partName: first.partName,
      partType: first.partType,
      woIds: partWOs.map((w) => w.woId),
      isSingleton: partWOs.length === 1,
    });
  }

  // Non-singletons first (by partId asc), then singletons (by partId asc)
  return groups.sort((a, b) => {
    if (a.isSingleton !== b.isSingleton) return a.isSingleton ? 1 : -1;
    return a.partId - b.partId;
  });
}

export const INITIAL_CANDIDATE_GROUPS: BtCandidateGroup[] =
  computeCandidateGroups(ALL_BT_WOS);

// ─── Session state ─────────────────────────────────────────────────────────────

export type BtSessionState = {
  // chipHome[woId] = hostWoId where the chip currently lives (initially woId itself)
  chipHome: Record<number, number>;
  // confirmToggles[hostWoId] = true → confirm ON for that cell
  confirmToggles: Record<number, boolean>;
  // plannedQty[hostWoId] = manually set planned qty (null = unset)
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
};

export function buildInitialSessionState(wos: BtWorkOrder[]): BtSessionState {
  const chipHome: Record<number, number> = {};
  const confirmToggles: Record<number, boolean> = {};
  const plannedQty: Record<number, number | null> = {};

  for (const wo of wos) {
    chipHome[wo.woId] = wo.woId;
    confirmToggles[wo.woId] = true;
    plannedQty[wo.woId] = null;
  }

  return {
    chipHome,
    confirmToggles,
    plannedQty,
    confirmedWoIds: new Set(),
    committedBatches: [],
    showHiddenSingletons: false,
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

// Whether a cell's confirm toggle should be interactive (has at least one chip)
export function isToggleActive(
  hostWoId: number,
  chipHome: Record<number, number>
): boolean {
  return getChipsInCell(chipHome, hostWoId).length > 0;
}

// Eligibility check: can dragWoId's chip be dropped in targetHostWoId's cell?
export function isEligibleTarget(
  dragWoId: number,
  targetHostWoId: number,
  wos: BtWorkOrder[],
  chipHome: Record<number, number>,
  confirmedWoIds: Set<number>
): boolean {
  if (confirmedWoIds.has(targetHostWoId)) return false;
  if (confirmedWoIds.has(dragWoId)) return false;

  // Dropping back on the current host is technically a no-op, but allowed
  const currentHost = chipHome[dragWoId];
  if (currentHost === targetHostWoId) return true; // "return home" is always valid

  const dragWo = wos.find((w) => w.woId === dragWoId);
  const targetWo = wos.find((w) => w.woId === targetHostWoId);
  if (!dragWo || !targetWo) return false;

  // PartID must match — routing template check is redundant because a partId
  // has exactly one routing template by definition.
  if (dragWo.partId !== targetWo.partId) return false;

  return true;
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

  if (!isEligibleTarget(woId, targetHostWoId, wos, state.chipHome, state.confirmedWoIds)) {
    return state;
  }

  const newChipHome = { ...state.chipHome, [woId]: targetHostWoId };

  console.log(
    `[AuditLog] Chip WO-${woId} moved: cell ${currentHost} → cell ${targetHostWoId}`
  );

  return { ...state, chipHome: newChipHome };
}

export function toggleConfirm(
  hostWoId: number,
  state: BtSessionState
): BtSessionState {
  if (!isToggleActive(hostWoId, state.chipHome)) return state;
  return {
    ...state,
    confirmToggles: {
      ...state.confirmToggles,
      [hostWoId]: !state.confirmToggles[hostWoId],
    },
  };
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
  stats: { totalWOs: number; draftBatches: number; standalone: number };
};

export function confirmDraft(
  state: BtSessionState,
  wos: BtWorkOrder[]
): ConfirmDraftResult {
  // Collect all unique host cells (rows that have chips)
  const hostWoIds = new Set(Object.values(state.chipHome));

  const newConfirmedWoIds = new Set(state.confirmedWoIds);
  const newCommittedBatches = [...state.committedBatches];
  let draftBatches = 0;
  let standalone = 0;
  let totalWOs = 0;

  for (const hostWoId of hostWoIds) {
    if (state.confirmedWoIds.has(hostWoId)) continue;
    if (!state.confirmToggles[hostWoId]) continue; // toggle OFF

    const chipsInCell = getChipsInCell(state.chipHome, hostWoId);
    if (chipsInCell.length === 0) continue;

    totalWOs += chipsInCell.length;

    if (chipsInCell.length >= 2) {
      draftBatches++;
      const batchId = `BATCH-${_batchIdCounter++}`;
      newCommittedBatches.push({
        batchId,
        memberWoIds: chipsInCell,
        isStandalone: false,
      });
      console.log(
        `[AuditLog] Batch ${batchId} created — members: ${chipsInCell.join(", ")}`
      );
    } else {
      standalone++;
      const batchId = `STANDALONE-${_batchIdCounter++}`;
      newCommittedBatches.push({
        batchId,
        memberWoIds: chipsInCell,
        isStandalone: true,
      });
      console.log(
        `[AuditLog] WO ${chipsInCell[0]} confirmed as standalone Open`
      );
    }

    for (const woId of chipsInCell) {
      newConfirmedWoIds.add(woId);
    }
  }

  // Remove confirmed WOs from mutable state
  const newChipHome = { ...state.chipHome };
  const newConfirmToggles = { ...state.confirmToggles };
  const newPlannedQty = { ...state.plannedQty };

  for (const woId of newConfirmedWoIds) {
    if (!state.confirmedWoIds.has(woId)) {
      delete newChipHome[woId];
      delete newConfirmToggles[woId];
      delete newPlannedQty[woId];
    }
  }

  // Re-home any chips that were pointing at a now-confirmed host
  for (const [chipWoIdStr, hostId] of Object.entries(newChipHome)) {
    const chipWoId = Number(chipWoIdStr);
    if (newConfirmedWoIds.has(hostId) && !newConfirmedWoIds.has(chipWoId)) {
      // Orphaned chip — return it home
      newChipHome[chipWoId] = chipWoId;
    }
  }

  return {
    newState: {
      ...state,
      chipHome: newChipHome,
      confirmToggles: newConfirmToggles,
      plannedQty: newPlannedQty,
      confirmedWoIds: newConfirmedWoIds,
      committedBatches: newCommittedBatches,
    },
    stats: { totalWOs, draftBatches, standalone },
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
  // Phase 2: pass the set of hostWoIds that are Open Production Rows.
  // The auto-batcher excludes any chip whose current host is in this set —
  // those represent explicit planner decisions to join existing Open work.
  // Phase 1: no Open rows exist, so this is always an empty set.
  openRowHostWoIds: Set<number>
): AutoBatchResult {
  // Step 1: classify each visible chip as eligible or excluded.
  const eligibleWoIds: number[] = [];
  for (const woId of visibleWoIds) {
    const currentHost = state.chipHome[woId];
    if (currentHost === undefined) continue;

    // Phase 2 branch: chip manually placed onto an Open Production Row → exclude.
    // The planner made an explicit operational decision; the auto-batcher respects it.
    if (openRowHostWoIds.has(currentHost) && currentHost !== woId) continue;

    eligibleWoIds.push(woId);
  }

  // Step 2: reset all eligible chips to home.
  const newChipHome = { ...state.chipHome };
  for (const woId of eligibleWoIds) {
    newChipHome[woId] = woId;
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

  for (const [, woIds] of byPartId) {
    if (woIds.length < 2) continue; // singleton-eligible stays home — no batch formed

    const sorted = [...woIds].sort((a, b) => a - b);
    const hostWoId = sorted[0]!;

    for (const woId of sorted) {
      if (woId !== hostWoId) {
        newChipHome[woId] = hostWoId;
      }
    }

    totalBatched += sorted.length;
    batchesCreated++;
    console.log(`[AuditLog] Auto-batch group partId=${wos.find(w => w.woId === hostWoId)?.partId}: host WO-${hostWoId}, members: ${sorted.join(', ')}`);
  }

  return {
    newState: { ...state, chipHome: newChipHome },
    stats: { totalBatched, batchesCreated },
  };
}

// ─── Reset Draft ──────────────────────────────────────────────────────────────

export function resetDraft(state: BtSessionState): BtSessionState {
  // Return ALL chips home — including any placed on Open Production Rows.
  // Unlike auto-batch (which preserves Open-row placements), Reset Draft is
  // the planner's explicit "clear everything" action.
  const newChipHome = { ...state.chipHome };
  for (const woIdStr of Object.keys(newChipHome)) {
    const woId = Number(woIdStr);
    newChipHome[woId] = woId;
  }
  console.log("[AuditLog] Draft reset — all chips returned home");
  return { ...state, chipHome: newChipHome };
}
