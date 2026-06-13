// Stock Fulfillment mockup — synthetic data
// All state is managed as plain objects so React detects updates via functional setState.
// No API calls. No persistence.

import { MOCK_PARTS } from "@/app/mockups/parts/_data";
import {
  ProjectColor,
  PROJECT_COLOR_MAP,
} from "@/app/mockups/project-creation/_data";

export type { ProjectColor };
export { PROJECT_COLOR_MAP };

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SfWoStatus = "Unreleased" | "Open" | "Complete" | "Skipped";

export type SfProject = {
  projectId: number;
  projectNumber: string;
  projectName: string;
  customerName: string | null;
  dueDate: string | null;
  color: ProjectColor | null;
};

export type SfWorkOrder = {
  woId: number;
  projectId: number;
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  // Demand quantity for this WO (product of quantities up the BOM chain)
  quantity: number;
  parentWoId: number | null;
  // DFS pre-order within its project; used for intra-project sort
  bomOrder: number;
  // Path from project root to (but not including) this WO's own part.
  // bomPath[0] = top-level ref (e.g. "10121.04")
  // bomPath[1..n] = partNumbers of ancestor assemblies
  bomPath: string[];
  // Mutable fields — updated by actions
  status: SfWoStatus;
  // null = undecided; set when explicitly passed-through, auto-passed, or fulfilled
  reviewedAt: string | null;
};

export type SfAuditEntry = {
  id: number;
  timestamp: string;
  action: string;
  woId: number | null;
  partId: number | null;
  detail: string;
  userId: number;
  userName: string;
};

export type SfState = {
  projects: SfProject[];
  workOrders: SfWorkOrder[];
  stockCounts: Record<number, number>; // partId → current stock
  auditLog: SfAuditEntry[];
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const SF_PROJECTS: SfProject[] = [
  {
    projectId: 4,
    projectNumber: "10121",
    projectName: "PB-M Cell 2024-Q4",
    customerName: "Customer D",
    dueDate: "2026-07-15",
    color: "green",
  },
  {
    projectId: 5,
    projectNumber: "10030",
    projectName: "PB-M Wrap Drive Integration",
    customerName: "Customer E",
    dueDate: "2026-08-30",
    color: "brown",
  },
  {
    projectId: 6,
    projectNumber: "10412",
    projectName: "Customer F Tailstock Retrofit",
    customerName: "Customer F",
    dueDate: "2026-09-20",
    color: "yellow",
  },
  {
    projectId: 7,
    projectNumber: "10489",
    projectName: "Customer G Photo Eye Package",
    customerName: "Customer G",
    dueDate: null,
    color: "lightPurple",
  },
];

// ─── Stock overrides ──────────────────────────────────────────────────────────
//
// MOCKUP: Applied on top of natural MOCK_PARTS stockCount values.
//
// 1942 (Tailstock Brake Assembly) → 1
//   Projects 10121 and 10412 both have this as a top-level (cumulative demand = 2).
//   Stock = 1 allows one WO to be a candidate. Fulfilling 10412's WO cascades 18
//   descendant WOs to Skipped and auto-passes-through 10121's WO (stock drops to 0).
//
// 1949 (Photo Eye Cable Assembly) → 1
//   Projects 10030 and 10489 both have this in their Photo Eye Kit tree.
//   Stock = 1 with cumulative demand = 2 makes both candidates. Fulfilling one
//   auto-passes the other, demonstrating the sub-assembly-level auto-pass scenario.

const STOCK_OVERRIDES: Record<number, number> = {
  1942: 1,
  1949: 1,
};

// ─── BOM walk + WO generation ─────────────────────────────────────────────────

function buildSfWOs(
  partId: number,
  quantity: number,
  parentWoId: number | null,
  projectId: number,
  ancestorPath: string[], // bomPath for this WO (excludes own partNumber)
  woIdCounter: { next: number },
  bomOrderCounter: { next: number },
  visited: Set<number>
): SfWorkOrder[] {
  if (visited.has(partId)) return [];
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part) return [];

  const visited2 = new Set(visited);
  visited2.add(partId);

  const woId = woIdCounter.next++;
  const bomOrder = bomOrderCounter.next++;

  const wo: SfWorkOrder = {
    woId,
    projectId,
    partId,
    partNumber: part.partNumber,
    partName: part.partName,
    partType: part.partType as "Part" | "Assembly",
    quantity,
    parentWoId,
    bomOrder,
    bomPath: ancestorPath,
    status: "Unreleased",
    reviewedAt: null,
  };

  // Children's bomPath gains this part's partNumber as the last ancestor
  const childPath = [...ancestorPath, part.partNumber];
  const children: SfWorkOrder[] = [];
  if (part.childParts) {
    for (const child of part.childParts) {
      children.push(
        ...buildSfWOs(
          child.childPartId,
          quantity * child.quantity,
          woId,
          projectId,
          childPath,
          woIdCounter,
          bomOrderCounter,
          visited2
        )
      );
    }
  }

  return [wo, ...children];
}

function buildProjectWOs(
  projectId: number,
  projectNumber: string,
  topLevels: Array<{ partId: number; qty: number; idx: number }>,
  startId: number
): SfWorkOrder[] {
  const woCounter = { next: startId };
  const orderCounter = { next: 1 };
  const wos: SfWorkOrder[] = [];
  for (const tl of topLevels) {
    const topLevelRef = `${projectNumber}.${String(tl.idx).padStart(2, "0")}`;
    wos.push(
      ...buildSfWOs(
        tl.partId,
        tl.qty,
        null,
        projectId,
        [topLevelRef], // bomPath for the top-level WO is just its ref
        woCounter,
        orderCounter,
        new Set()
      )
    );
  }
  return wos;
}

// ─── WO generation at module init ────────────────────────────────────────────

// 10121 — 6 top-levels (same as project-creation mockup, independent WO IDs here)
const WOS_10121 = buildProjectWOs(4, "10121", [
  { partId: 1908, qty: 1, idx: 1 }, // 1K Base Tooling
  { partId: 1922, qty: 1, idx: 2 }, // 19-07-0-00 Wired Probe Assembly
  { partId: 2035, qty: 1, idx: 3 }, // 18-01-3-00 CW 10.5in Cutter Plate Assembly
  { partId: 1942, qty: 1, idx: 4 }, // Tailstock Brake Assembly — seeded stock=1, competes with 10412
  { partId: 1929, qty: 1, idx: 5 }, // 12-10-4-00 Tool Setter Package
  { partId: 1967, qty: 1, idx: 6 }, // 18-06-0-00 1K Cradle Assembly
], 10001);

// 10030 — 8 top-levels
const WOS_10030 = buildProjectWOs(5, "10030", [
  { partId: 1951, qty: 1, idx: 1 }, // 51-01-0-00 PB-M Base Assembly
  { partId: 1954, qty: 1, idx: 2 }, // 55-10-0-00 PB-M Wrap Around Drive Assembly
  { partId: 2219, qty: 1, idx: 3 }, // 52-31-0-00 PB-M Lower Column 2.0
  { partId: 1943, qty: 1, idx: 4 }, // 52-19-4-00 1,000 lb. Capacity Upper Column
  { partId: 1958, qty: 1, idx: 5 }, // 58-16-0-00 Computer Console Assembly
  { partId: 2063, qty: 1, idx: 6 }, // 55-10-1-00 PB-M WAD Tensioner Assembly
  { partId: 2066, qty: 1, idx: 7 }, // 59-16-3-00 1 inch PB-M End Stop Assembly — competes with 10489
  { partId: 1948, qty: 1, idx: 8 }, // 58-17-0-00 Photo Eye Kit — competes with 10489; contains 1949
], 20001);

// 10412 — 2 top-levels, both shared with 10121 (cross-project competition)
const WOS_10412 = buildProjectWOs(6, "10412", [
  { partId: 1942, qty: 1, idx: 1 }, // Tailstock Brake Assembly — seeded stock=1, competes with 10121
  { partId: 2035, qty: 1, idx: 2 }, // 18-01-3-00 CW 10.5in Cutter Plate Assembly — competes with 10121
], 30001);

// 10489 — 2 top-levels, both shared with 10030 (cross-project competition)
const WOS_10489 = buildProjectWOs(7, "10489", [
  { partId: 1948, qty: 1, idx: 1 }, // Photo Eye Kit — competes with 10030; 1949 seeded stock=1
  { partId: 2066, qty: 1, idx: 2 }, // End Stop Assembly — competes with 10030
], 40001);

const ALL_WOS = [...WOS_10121, ...WOS_10030, ...WOS_10412, ...WOS_10489];

// ─── Initial stock counts ─────────────────────────────────────────────────────

function buildInitialStockCounts(): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const w of ALL_WOS) {
    if (!(w.partId in counts)) {
      const part = MOCK_PARTS.find((p) => p.partId === w.partId);
      counts[w.partId] = STOCK_OVERRIDES[w.partId] ?? (part?.stockCount ?? 0);
    }
  }
  return counts;
}

// ─── Initial state ────────────────────────────────────────────────────────────

export const INITIAL_SF_STATE: SfState = {
  projects: SF_PROJECTS,
  workOrders: ALL_WOS,
  stockCounts: buildInitialStockCounts(),
  auditLog: [],
};

// ─── Derived state: candidates ────────────────────────────────────────────────

// Returns the candidate list sorted by: dueDate ASC (nulls last), projectId, then
// Location ASC (nulls last) within BOM sibling groups, preserving DFS pre-order.
// Defensive rule: Assembly WOs are excluded when any descendant in the same project
// is already Complete (descendant-then-ancestor enforcement).
export function computeCandidates(state: SfState): SfWorkOrder[] {
  const { workOrders, stockCounts, projects } = state;

  // Step 1: basic eligibility
  const basicEligible = workOrders.filter(
    (w) =>
      w.status === "Unreleased" &&
      w.reviewedAt === null &&
      (stockCounts[w.partId] ?? 0) >= w.quantity
  );

  // Step 2: remove Assembly candidates that have a Complete descendant in the same project
  const completeIds = new Set(
    workOrders.filter((w) => w.status === "Complete").map((w) => w.woId)
  );

  const disqualifiedIds = new Set<number>();
  for (const candidate of basicEligible) {
    if (candidate.partType !== "Assembly") continue;
    const descendants = getDescendantWoIds(workOrders, candidate.woId);
    if (descendants.some((id) => completeIds.has(id))) {
      disqualifiedIds.add(candidate.woId);
    }
  }

  const filtered = basicEligible.filter((w) => !disqualifiedIds.has(w.woId));

  // Step 3: sort — (dueDate, projectId) for inter-project order, then location-aware
  // DFS within each project.
  const dueDateByProject: Record<number, string | null> = {};
  for (const p of projects) dueDateByProject[p.projectId] = p.dueDate;

  // Determine project emit order by (dueDate ASC nulls-last, projectId ASC)
  const projectIds = [
    ...new Set(
      filtered
        .slice()
        .sort((a, b) => {
          const da = dueDateByProject[a.projectId];
          const db = dueDateByProject[b.projectId];
          if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return da < db ? -1 : 1;
          }
          return a.projectId - b.projectId;
        })
        .map((w) => w.projectId)
    ),
  ];

  // Group candidates by project
  const byProject = new Map<number, SfWorkOrder[]>();
  for (const wo of filtered) {
    if (!byProject.has(wo.projectId)) byProject.set(wo.projectId, []);
    byProject.get(wo.projectId)!.push(wo);
  }

  // Emit each project's candidates in location-aware DFS order
  const result: SfWorkOrder[] = [];
  for (const pid of projectIds) {
    result.push(...locationSortedProject(byProject.get(pid)!));
  }
  return result;
}

// Sort a single project's candidates in DFS pre-order with Location as the sibling
// tiebreaker. Top-level WOs (parentWoId === null) keep their bomOrder (reference
// sequence .01, .02, …). Children of any Assembly sort by Location ascending nulls-last,
// then bomOrder for stability.
function locationSortedProject(projectCandidates: SfWorkOrder[]): SfWorkOrder[] {
  const candidateIds = new Set(projectCandidates.map((c) => c.woId));

  // Group by actual parentWoId
  const byParent = new Map<number | null, SfWorkOrder[]>();
  for (const wo of projectCandidates) {
    const key = wo.parentWoId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(wo);
  }

  // Sort each sibling group
  for (const [parentId, siblings] of byParent) {
    if (parentId === null) {
      // True top-level references: preserve bomOrder (.01, .02, …)
      siblings.sort((a, b) => a.bomOrder - b.bomOrder);
    } else {
      // Children of any Assembly: sort by Location (nulls last), then bomOrder
      siblings.sort((a, b) => {
        const la = MOCK_PARTS.find((p) => p.partId === a.partId)?.inventoryLocation ?? null;
        const lb = MOCK_PARTS.find((p) => p.partId === b.partId)?.inventoryLocation ?? null;
        if (la !== lb) {
          if (la === null) return 1;
          if (lb === null) return -1;
          return la < lb ? -1 : 1;
        }
        return a.bomOrder - b.bomOrder;
      });
    }
  }

  // Determine traversal roots: candidates with no candidate ancestor.
  // True top-levels (parentWoId === null) form one group each.
  // Orphan candidates (non-null parentWoId whose parent is not a candidate) are grouped by
  // their actual parentWoId so siblings remain together and location-sorted.
  const rootGroups: Array<{ minBomOrder: number; wos: SfWorkOrder[] }> = [];

  for (const wo of byParent.get(null) ?? []) {
    rootGroups.push({ minBomOrder: wo.bomOrder, wos: [wo] });
  }
  for (const [parentId, group] of byParent) {
    if (parentId === null || candidateIds.has(parentId)) continue;
    rootGroups.push({
      minBomOrder: Math.min(...group.map((o) => o.bomOrder)),
      wos: group,
    });
  }
  rootGroups.sort((a, b) => a.minBomOrder - b.minBomOrder);

  // DFS emission
  function dfsEmit(wo: SfWorkOrder): SfWorkOrder[] {
    const out: SfWorkOrder[] = [wo];
    for (const child of byParent.get(wo.woId) ?? []) {
      out.push(...dfsEmit(child));
    }
    return out;
  }

  const result: SfWorkOrder[] = [];
  for (const group of rootGroups) {
    for (const wo of group.wos) {
      result.push(...dfsEmit(wo));
    }
  }
  return result;
}

// ─── Derived state: project stats ────────────────────────────────────────────

export type SfProjectStats = {
  projectId: number;
  candidateCount: number;
  // All Unreleased WOs that are NOT current candidates. Invariant: candidateCount + pendingReleaseCount = unreleasedCount
  pendingReleaseCount: number;
  unreleasedCount: number;
};

export function computeProjectStats(
  state: SfState,
  candidates: SfWorkOrder[]
): Record<number, SfProjectStats> {
  const candidateSet = new Set(candidates.map((c) => c.woId));
  const result: Record<number, SfProjectStats> = {};
  for (const p of state.projects) {
    result[p.projectId] = {
      projectId: p.projectId,
      candidateCount: 0,
      pendingReleaseCount: 0,
      unreleasedCount: 0,
    };
  }
  for (const w of state.workOrders) {
    const s = result[w.projectId];
    if (!s) continue;
    if (candidateSet.has(w.woId)) s.candidateCount++;
    if (w.status === "Unreleased") s.unreleasedCount++;
  }
  for (const s of Object.values(result)) {
    s.pendingReleaseCount = s.unreleasedCount - s.candidateCount;
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns all descendant WO IDs (any depth) via parentWoId chain, within any project.
export function getDescendantWoIds(
  workOrders: SfWorkOrder[],
  woId: number
): number[] {
  const result: number[] = [];
  const queue = [woId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const w of workOrders) {
      if (w.parentWoId === id) {
        result.push(w.woId);
        queue.push(w.woId);
      }
    }
  }
  return result;
}

// Returns candidate WOs for the same partId across all projects (for inline expansion).
// Filters to candidates only so the expansion matches the Cumulative Demand column's semantic.
export function getCompetingCandidates(
  candidates: SfWorkOrder[],
  partId: number
): SfWorkOrder[] {
  return candidates.filter((w) => w.partId === partId);
}

// Walk up parentWoId chain and return ancestor WOs closest-first, top-level last.
export function getAncestryChain(
  workOrders: SfWorkOrder[],
  wo: SfWorkOrder
): Array<{ partNumber: string; partName: string }> {
  const chain: Array<{ partNumber: string; partName: string }> = [];
  let currentId = wo.parentWoId;
  while (currentId !== null) {
    const parent = workOrders.find((w) => w.woId === currentId);
    if (!parent) break;
    chain.push({ partNumber: parent.partNumber, partName: parent.partName });
    currentId = parent.parentWoId;
  }
  return chain;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 1, name: "Admin" };
let _auditIdCounter = 1;

function nextAuditId(): number {
  return _auditIdCounter++;
}

export type FulfillResult =
  | { ok: true; state: SfState; autoPassedThrough: string[] }
  | { ok: false; error: string };

// Fulfill a WO from stock. For Assembly WOs, cascades all descendants to Skipped.
// Returns error if action-time descendant-then-ancestor rule is violated.
export function fulfillWo(state: SfState, woId: number): FulfillResult {
  const wo = state.workOrders.find((w) => w.woId === woId);
  if (!wo) return { ok: false, error: "Work order not found." };
  if (wo.status !== "Unreleased")
    return { ok: false, error: "Work order is not Unreleased." };

  // Action-time: Assembly WO cannot be fulfilled if a descendant in the same project is Complete
  if (wo.partType === "Assembly") {
    const descendants = getDescendantWoIds(state.workOrders, woId);
    const hasCompleteDescendant = descendants.some(
      (id) => state.workOrders.find((w) => w.woId === id)?.status === "Complete"
    );
    if (hasCompleteDescendant) {
      return {
        ok: false,
        error: `Cannot fulfill ${wo.partNumber} from stock — a descendant WO is already Complete. Sub-components must be fulfilled before the parent assembly.`,
      };
    }
  }

  const now = new Date().toISOString();
  const newStockForPart = Math.max(
    0,
    (state.stockCounts[wo.partId] ?? 0) - wo.quantity
  );
  const newStockCounts = { ...state.stockCounts, [wo.partId]: newStockForPart };

  // Cascade: all descendants of this WO in same project → Skipped
  const descendantIds = new Set(getDescendantWoIds(state.workOrders, woId));

  // Auto-pass-through: other Unreleased/undecided WOs for the same partId
  // whose demand now exceeds the new stock count
  const autoPassedIds = new Set<number>();
  const autoPassedThrough: string[] = [];
  for (const w of state.workOrders) {
    if (
      w.woId !== woId &&
      w.partId === wo.partId &&
      w.status === "Unreleased" &&
      w.reviewedAt === null &&
      w.quantity > newStockForPart
    ) {
      autoPassedIds.add(w.woId);
      const proj = state.projects.find((p) => p.projectId === w.projectId);
      autoPassedThrough.push(
        `${proj?.projectNumber ?? String(w.projectId)} — ${w.partNumber}`
      );
    }
  }

  const newWorkOrders = state.workOrders.map((w) => {
    if (w.woId === woId)
      return { ...w, status: "Complete" as SfWoStatus, reviewedAt: now };
    if (descendantIds.has(w.woId))
      return { ...w, status: "Skipped" as SfWoStatus, reviewedAt: now };
    if (autoPassedIds.has(w.woId)) return { ...w, reviewedAt: now };
    return w;
  });

  const auditEntries: SfAuditEntry[] = [
    {
      id: nextAuditId(),
      timestamp: now,
      action: "FulfillFromStock",
      woId,
      partId: wo.partId,
      detail: `Fulfilled WO ${woId} (${wo.partNumber} ×${wo.quantity}) from stock. Stock: ${state.stockCounts[wo.partId] ?? 0} → ${newStockForPart}.${descendantIds.size > 0 ? ` Cascaded ${descendantIds.size} descendant WO(s) to Skipped.` : ""}`,
      userId: MOCK_USER.id,
      userName: MOCK_USER.name,
    },
  ];

  for (const id of autoPassedIds) {
    const apt = state.workOrders.find((w) => w.woId === id)!;
    auditEntries.push({
      id: nextAuditId(),
      timestamp: now,
      action: "AutoPassThrough",
      woId: id,
      partId: apt.partId,
      detail: `Auto-passed WO ${id} (${apt.partNumber}) — stock depleted to ${newStockForPart}.`,
      userId: MOCK_USER.id,
      userName: MOCK_USER.name,
    });
  }

  return {
    ok: true,
    state: {
      ...state,
      workOrders: newWorkOrders,
      stockCounts: newStockCounts,
      auditLog: [...state.auditLog, ...auditEntries],
    },
    autoPassedThrough,
  };
}

// Mark a WO as explicitly passed-through (reviewedAt stamped, status stays Unreleased).
export function passThrough(state: SfState, woId: number): SfState {
  const now = new Date().toISOString();
  const wo = state.workOrders.find((w) => w.woId === woId)!;

  return {
    ...state,
    workOrders: state.workOrders.map((w) =>
      w.woId === woId ? { ...w, reviewedAt: now } : w
    ),
    auditLog: [
      ...state.auditLog,
      {
        id: nextAuditId(),
        timestamp: now,
        action: "PassThrough",
        woId,
        partId: wo.partId,
        detail: `Passed through WO ${woId} (${wo.partNumber}) — will proceed to production without stock fulfillment.`,
        userId: MOCK_USER.id,
        userName: MOCK_USER.name,
      },
    ],
  };
}

// Reconcile stock for a part. Auto-passes WOs whose demand now exceeds the new count.
export function reconcileStock(
  state: SfState,
  partId: number,
  newCount: number,
  reason: string
): SfState {
  const now = new Date().toISOString();
  const oldCount = state.stockCounts[partId] ?? 0;

  const autoPassedIds = new Set<number>();
  for (const w of state.workOrders) {
    if (
      w.partId === partId &&
      w.status === "Unreleased" &&
      w.reviewedAt === null &&
      w.quantity > newCount
    ) {
      autoPassedIds.add(w.woId);
    }
  }

  const newWorkOrders = state.workOrders.map((w) =>
    autoPassedIds.has(w.woId) ? { ...w, reviewedAt: now } : w
  );

  const auditEntries: SfAuditEntry[] = [
    {
      id: nextAuditId(),
      timestamp: now,
      action: "ReconcileStock",
      woId: null,
      partId,
      detail: `Reconciled stock for part ${partId}: ${oldCount} → ${newCount}. Reason: ${reason}`,
      userId: MOCK_USER.id,
      userName: MOCK_USER.name,
    },
  ];
  for (const id of autoPassedIds) {
    const apt = state.workOrders.find((w) => w.woId === id)!;
    auditEntries.push({
      id: nextAuditId(),
      timestamp: now,
      action: "AutoPassThrough",
      woId: id,
      partId,
      detail: `Auto-passed WO ${id} (${apt.partNumber}) after reconciliation — new stock ${newCount} < demand ${apt.quantity}.`,
      userId: MOCK_USER.id,
      userName: MOCK_USER.name,
    });
  }

  return {
    ...state,
    workOrders: newWorkOrders,
    stockCounts: { ...state.stockCounts, [partId]: newCount },
    auditLog: [...state.auditLog, ...auditEntries],
  };
}

// Release Pending Release WOs (non-candidate Unreleased) for a single project → Open.
// candidateWoIds: the current candidate set — excluded from this release so candidates stay in the view.
export function releaseProject(state: SfState, projectId: number, candidateWoIds: ReadonlySet<number>): SfState {
  const now = new Date().toISOString();
  const released: number[] = [];

  const newWorkOrders = state.workOrders.map((w) => {
    if (w.projectId === projectId && w.status === "Unreleased" && !candidateWoIds.has(w.woId)) {
      released.push(w.woId);
      return { ...w, status: "Open" as SfWoStatus, reviewedAt: w.reviewedAt ?? now };
    }
    return w;
  });

  return {
    ...state,
    workOrders: newWorkOrders,
    auditLog: [
      ...state.auditLog,
      {
        id: nextAuditId(),
        timestamp: now,
        action: "ReleaseProject",
        woId: null,
        partId: null,
        detail: `Released ${released.length} WO(s) for project ${projectId} to Open.`,
        userId: MOCK_USER.id,
        userName: MOCK_USER.name,
      },
    ],
  };
}

// Release Pending Release WOs (non-candidate Unreleased) across all projects (or a filtered subset) → Open.
export function releaseAll(
  state: SfState,
  candidateWoIds: ReadonlySet<number>,
  projectIds?: number[]
): SfState {
  const now = new Date().toISOString();
  const scope = projectIds ? new Set(projectIds) : null;
  const released: number[] = [];

  const newWorkOrders = state.workOrders.map((w) => {
    if (
      w.status === "Unreleased" &&
      !candidateWoIds.has(w.woId) &&
      (scope === null || scope.has(w.projectId))
    ) {
      released.push(w.woId);
      return { ...w, status: "Open" as SfWoStatus, reviewedAt: w.reviewedAt ?? now };
    }
    return w;
  });

  return {
    ...state,
    workOrders: newWorkOrders,
    auditLog: [
      ...state.auditLog,
      {
        id: nextAuditId(),
        timestamp: now,
        action: "ReleaseAll",
        woId: null,
        partId: null,
        detail: `Released ${released.length} WO(s)${scope ? ` for ${scope.size} project(s)` : " across all projects"} to Open.`,
        userId: MOCK_USER.id,
        userName: MOCK_USER.name,
      },
    ],
  };
}
