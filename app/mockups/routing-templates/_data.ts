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
  // Forward-looking: Projects will have a formal color system. Ad-hoc hex used here.
  projectColor: string;
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

// Project color constants — one color per project reference
const PROJECT_COLORS: Record<string, string> = {
  "PROJ-A": "#3b82f6",
  "PROJ-B": "#ef4444",
  "PROJ-C": "#10b981",
  "PROJ-D": "#f59e0b",
  "PROJ-E": "#8b5cf6",
};

// ─── Template 1 — Machined Part (32 parts, 18 WOs, 145 stock) ─────────────────
// Parts inlined directly into MOCK_TEMPLATES below (stock values adjusted to sum to 145).

const t1Wos: MockAffectedWo[] = [
  { woId: 1001, woNumber: "WO-20260001", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "BRK-101", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 1002, woNumber: "WO-20260002", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "BRK-103", currentStep: "Receive", status: "Awaiting Material", batchContext: "BATCH-005" },
  { woId: 1003, woNumber: "WO-20260003", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-100", partNumber: "PLT-330", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-005" },
  { woId: 1004, woNumber: "WO-20260010", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "SHF-701", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 1005, woNumber: "WO-20260011", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "SHF-703", currentStep: "Receive", status: "Open", batchContext: null },
  { woId: 1006, woNumber: "WO-20260012", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "HSG-401", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-007" },
  { woId: 1007, woNumber: "WO-20260013", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-200", partNumber: "PIN-602", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-007" },
  { woId: 1008, woNumber: "WO-20260020", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-300", partNumber: "BLK-001", currentStep: "Receive", status: "Open", batchContext: null },
  { woId: 1009, woNumber: "WO-20260021", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-300", partNumber: "FLG-201", currentStep: "Machine", status: "Awaiting Material", batchContext: null },
  { woId: 1010, woNumber: "WO-20260022", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-300", partNumber: "NZL-101", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 1011, woNumber: "WO-20260030", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-400", partNumber: "SPC-901", currentStep: "Receive", status: "Open", batchContext: null },
  { woId: 1012, woNumber: "WO-20260031", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-400", partNumber: "SPC-903", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-009" },
  { woId: 1013, woNumber: "WO-20260032", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-400", partNumber: "CVR-311", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-009" },
  { woId: 1014, woNumber: "WO-20260033", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-400", partNumber: "MNT-502", currentStep: "Receive", status: "Awaiting Purchase", batchContext: null },
  { woId: 1015, woNumber: "WO-20260040", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-500", partNumber: "BLK-003", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 1016, woNumber: "WO-20260041", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-500", partNumber: "FLG-202", currentStep: "Receive", status: "Open", batchContext: null },
  { woId: 1017, woNumber: "WO-20260042", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-500", partNumber: "PLT-331", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 1018, woNumber: "WO-20260043", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-500", partNumber: "CAP-205", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-012" },
];

// affectedStockCount = sum of stockOnHand for t1Parts = 8+12+4+6+3+9+14+5+7+11+4+8+2+18+10+3+1 = 125
// Let me recalculate: 8+0+12+0+4+0+6+0+3+0+9+0+14+0+5+0+7+0+11+0+4+0+8+0+2+0+18+0+10+0+3+1 = 125
// That doesn't match 145. Let me adjust some values to hit 145.
// Current sum: 8+12+4+6+3+9+14+5+7+11+4+8+2+18+10+3+1 = 125. Need 20 more.
// Let me bump BLK-003 from 18 to 20, NZL-102 from 10 to 18, FLG-203 from 1 to 7 → 20+18+7 = 45 vs 18+10+1 = 29. Diff = 16.
// Actually let me just adjust individual values:
// Current: 8,12,4,6,3,9,14,5,7,11,4,8,2,18,10,3,1 = 125. Need 145.
// Adjust BRK-101 8→15 (+7), PIN-602 14→20 (+6), SHF-703 11→18 (+7) → 125+20=145 ✓

// ─── Template 2 — Machined + Blackened Part (28 parts, 14 WOs, 102 stock) ────
const t2Parts: MockReferencingPart[] = [
  { partId: 201, partNumber: "BRK-201", partName: "Angled Bracket", stockOnHand: 5 },
  { partId: 202, partNumber: "BRK-202", partName: "Z-Bracket", stockOnHand: 0 },
  { partId: 203, partNumber: "BRK-203", partName: "L-Bracket", stockOnHand: 8 },
  { partId: 204, partNumber: "BRK-204", partName: "T-Bracket", stockOnHand: 0 },
  { partId: 205, partNumber: "CVR-321", partName: "Access Cover", stockOnHand: 4 },
  { partId: 206, partNumber: "CVR-322", partName: "Inspection Cover", stockOnHand: 0 },
  { partId: 207, partNumber: "FTG-100", partName: "Straight Fitting", stockOnHand: 6 },
  { partId: 208, partNumber: "FTG-101", partName: "Elbow Fitting", stockOnHand: 0 },
  { partId: 209, partNumber: "FTG-102", partName: "Tee Fitting", stockOnHand: 9 },
  { partId: 210, partNumber: "FTG-103", partName: "Cross Fitting", stockOnHand: 0 },
  { partId: 211, partNumber: "HSG-410", partName: "Gearbox Housing", stockOnHand: 3 },
  { partId: 212, partNumber: "HSG-411", partName: "Bearing Housing", stockOnHand: 0 },
  { partId: 213, partNumber: "HSG-412", partName: "Seal Housing", stockOnHand: 7 },
  { partId: 214, partNumber: "LVR-100", partName: "Control Lever", stockOnHand: 0 },
  { partId: 215, partNumber: "LVR-101", partName: "Actuator Lever", stockOnHand: 4 },
  { partId: 216, partNumber: "MNT-510", partName: "Pivot Mount", stockOnHand: 0 },
  { partId: 217, partNumber: "MNT-511", partName: "Swing Mount", stockOnHand: 6 },
  { partId: 218, partNumber: "PLT-340", partName: "Gusset Plate", stockOnHand: 0 },
  { partId: 219, partNumber: "PLT-341", partName: "Shim Plate", stockOnHand: 11 },
  { partId: 220, partNumber: "PLT-342", partName: "Stop Plate", stockOnHand: 0 },
  { partId: 221, partNumber: "SHF-710", partName: "Cam Shaft", stockOnHand: 5 },
  { partId: 222, partNumber: "SHF-711", partName: "Idler Shaft", stockOnHand: 0 },
  { partId: 223, partNumber: "SHF-712", partName: "Counter Shaft", stockOnHand: 8 },
  { partId: 224, partNumber: "SLV-100", partName: "Bronze Sleeve", stockOnHand: 0 },
  { partId: 225, partNumber: "SLV-101", partName: "Steel Sleeve", stockOnHand: 12 },
  { partId: 226, partNumber: "SLV-102", partName: "Thrust Sleeve", stockOnHand: 0 },
  { partId: 227, partNumber: "WHL-100", partName: "Feed Wheel", stockOnHand: 9 },
  { partId: 228, partNumber: "WHL-101", partName: "Index Wheel", stockOnHand: 5 },
];

const t2Wos: MockAffectedWo[] = [
  { woId: 2001, woNumber: "WO-20260050", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-110", partNumber: "BRK-201", currentStep: "Blacken", status: "In Progress", batchContext: null },
  { woId: 2002, woNumber: "WO-20260051", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-110", partNumber: "BRK-203", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-006" },
  { woId: 2003, woNumber: "WO-20260052", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-110", partNumber: "FTG-102", currentStep: "Receive", status: "Open", batchContext: "BATCH-006" },
  { woId: 2004, woNumber: "WO-20260060", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-210", partNumber: "HSG-411", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 2005, woNumber: "WO-20260061", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-210", partNumber: "HSG-413", currentStep: "Blacken", status: "In Progress", batchContext: null },
  { woId: 2006, woNumber: "WO-20260062", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-210", partNumber: "SHF-710", currentStep: "Receive", status: "Awaiting Material", batchContext: null },
  { woId: 2007, woNumber: "WO-20260070", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-310", partNumber: "PLT-341", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-010" },
  { woId: 2008, woNumber: "WO-20260071", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-310", partNumber: "SLV-101", currentStep: "Blacken", status: "In Progress", batchContext: "BATCH-010" },
  { woId: 2009, woNumber: "WO-20260072", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-310", partNumber: "WHL-100", currentStep: "Machine", status: "Open", batchContext: null },
  { woId: 2010, woNumber: "WO-20260080", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-410", partNumber: "LVR-101", currentStep: "Blacken", status: "In Progress", batchContext: null },
  { woId: 2011, woNumber: "WO-20260081", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-410", partNumber: "SHF-712", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 2012, woNumber: "WO-20260082", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-410", partNumber: "MNT-511", currentStep: "Receive", status: "Awaiting Purchase", batchContext: null },
  { woId: 2013, woNumber: "WO-20260090", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-510", partNumber: "CVR-321", currentStep: "Blacken", status: "In Progress", batchContext: "BATCH-013" },
  { woId: 2014, woNumber: "WO-20260091", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-510", partNumber: "WHL-101", currentStep: "Machine", status: "Open", batchContext: "BATCH-013" },
];

// t2 stock sum: 5+8+4+6+9+3+7+4+6+11+5+8+12+9+5 = 102 ✓

// ─── Template 3 — Machined + Painted Part (17 parts, 9 WOs, 56 stock) ────────
const t3Parts: MockReferencingPart[] = [
  { partId: 301, partNumber: "BRK-301", partName: "Painted Bracket", stockOnHand: 5 },
  { partId: 302, partNumber: "BRK-302", partName: "Trim Bracket", stockOnHand: 0 },
  { partId: 303, partNumber: "CVR-330", partName: "Decorative Cover", stockOnHand: 7 },
  { partId: 304, partNumber: "CVR-331", partName: "Panel Cover", stockOnHand: 0 },
  { partId: 305, partNumber: "DOR-100", partName: "Access Door", stockOnHand: 3 },
  { partId: 306, partNumber: "DOR-101", partName: "Service Door", stockOnHand: 0 },
  { partId: 307, partNumber: "DOR-102", partName: "Guard Door", stockOnHand: 4 },
  { partId: 308, partNumber: "GRD-100", partName: "Safety Guard", stockOnHand: 0 },
  { partId: 309, partNumber: "GRD-101", partName: "Drive Guard", stockOnHand: 8 },
  { partId: 310, partNumber: "HSG-420", partName: "Painted Housing", stockOnHand: 0 },
  { partId: 311, partNumber: "PNL-100", partName: "Control Panel", stockOnHand: 6 },
  { partId: 312, partNumber: "PNL-101", partName: "Junction Panel", stockOnHand: 0 },
  { partId: 313, partNumber: "PNL-102", partName: "Side Panel", stockOnHand: 9 },
  { partId: 314, partNumber: "PLT-350", partName: "Face Plate", stockOnHand: 0 },
  { partId: 315, partNumber: "PLT-351", partName: "Name Plate", stockOnHand: 4 },
  { partId: 316, partNumber: "SHD-100", partName: "Heat Shield", stockOnHand: 0 },
  { partId: 317, partNumber: "SHD-101", partName: "Splash Shield", stockOnHand: 10 },
];

const t3Wos: MockAffectedWo[] = [
  { woId: 3001, woNumber: "WO-20260100", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-120", partNumber: "BRK-301", currentStep: "Paint", status: "In Progress", batchContext: null },
  { woId: 3002, woNumber: "WO-20260101", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-120", partNumber: "CVR-330", currentStep: "Machine", status: "In Progress", batchContext: "BATCH-008" },
  { woId: 3003, woNumber: "WO-20260102", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-220", partNumber: "GRD-101", currentStep: "Paint", status: "In Progress", batchContext: "BATCH-008" },
  { woId: 3004, woNumber: "WO-20260103", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-220", partNumber: "PNL-100", currentStep: "Machine", status: "Open", batchContext: null },
  { woId: 3005, woNumber: "WO-20260104", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-320", partNumber: "PNL-102", currentStep: "Receive", status: "Awaiting Material", batchContext: null },
  { woId: 3006, woNumber: "WO-20260105", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-320", partNumber: "PLT-351", currentStep: "Paint", status: "In Progress", batchContext: null },
  { woId: 3007, woNumber: "WO-20260106", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-420", partNumber: "SHD-101", currentStep: "Machine", status: "In Progress", batchContext: null },
  { woId: 3008, woNumber: "WO-20260107", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-420", partNumber: "DOR-100", currentStep: "Paint", status: "In Progress", batchContext: "BATCH-014" },
  { woId: 3009, woNumber: "WO-20260108", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-520", partNumber: "DOR-102", currentStep: "Receive", status: "Open", batchContext: "BATCH-014" },
];

// t3 stock sum: 5+7+3+4+8+6+9+4+10 = 56 ✓

// ─── Template 4 — Welded Assembly (12 parts, 8 WOs, 0 stock) ─────────────────
const t4Parts: MockReferencingPart[] = [
  { partId: 401, partNumber: "FRM-100", partName: "Main Frame", stockOnHand: 0 },
  { partId: 402, partNumber: "FRM-101", partName: "Sub-Frame", stockOnHand: 0 },
  { partId: 403, partNumber: "FRM-102", partName: "Cross Frame", stockOnHand: 0 },
  { partId: 404, partNumber: "GST-100", partName: "Corner Gusset", stockOnHand: 0 },
  { partId: 405, partNumber: "GST-101", partName: "Web Gusset", stockOnHand: 0 },
  { partId: 406, partNumber: "GST-102", partName: "Rib Gusset", stockOnHand: 0 },
  { partId: 407, partNumber: "WLD-100", partName: "Tube Weldment", stockOnHand: 0 },
  { partId: 408, partNumber: "WLD-101", partName: "Box Weldment", stockOnHand: 0 },
  { partId: 409, partNumber: "WLD-102", partName: "Ring Weldment", stockOnHand: 0 },
  { partId: 410, partNumber: "WLD-103", partName: "Plate Weldment", stockOnHand: 0 },
  { partId: 411, partNumber: "BKT-100", partName: "Weld Bracket", stockOnHand: 0 },
  { partId: 412, partNumber: "BKT-101", partName: "Gusset Bracket", stockOnHand: 0 },
];

const t4Wos: MockAffectedWo[] = [
  { woId: 4001, woNumber: "WO-20260110", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-130", partNumber: "FRM-100", currentStep: "Weld", status: "In Progress", batchContext: null },
  { woId: 4002, woNumber: "WO-20260111", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-130", partNumber: "WLD-100", currentStep: "Assemble", status: "In Progress", batchContext: null },
  { woId: 4003, woNumber: "WO-20260112", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-230", partNumber: "FRM-101", currentStep: "Machine", status: "Open", batchContext: null },
  { woId: 4004, woNumber: "WO-20260113", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-230", partNumber: "WLD-103", currentStep: "Weld", status: "In Progress", batchContext: "BATCH-011" },
  { woId: 4005, woNumber: "WO-20260114", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-330", partNumber: "FRM-102", currentStep: "Weld", status: "In Progress", batchContext: "BATCH-011" },
  { woId: 4006, woNumber: "WO-20260115", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-330", partNumber: "GST-100", currentStep: "Assemble", status: "Open", batchContext: null },
  { woId: 4007, woNumber: "WO-20260116", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-430", partNumber: "WLD-101", currentStep: "Machine", status: "Open", batchContext: null },
  { woId: 4008, woNumber: "WO-20260117", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-530", partNumber: "BKT-100", currentStep: "Weld", status: "Awaiting Material", batchContext: null },
];

// ─── Template 5 — Welded + Painted Assembly (8 parts, 5 WOs, 0 stock) ────────
const t5Parts: MockReferencingPart[] = [
  { partId: 501, partNumber: "FRM-200", partName: "Painted Frame", stockOnHand: 0 },
  { partId: 502, partNumber: "FRM-201", partName: "Chassis Frame", stockOnHand: 0 },
  { partId: 503, partNumber: "WLD-200", partName: "Painted Weldment", stockOnHand: 0 },
  { partId: 504, partNumber: "WLD-201", partName: "Enclosure Weldment", stockOnHand: 0 },
  { partId: 505, partNumber: "WLD-202", partName: "Support Weldment", stockOnHand: 0 },
  { partId: 506, partNumber: "BKT-200", partName: "Painted Bracket Weld", stockOnHand: 0 },
  { partId: 507, partNumber: "GST-200", partName: "Structural Gusset", stockOnHand: 0 },
  { partId: 508, partNumber: "GST-201", partName: "Stiffener Gusset", stockOnHand: 0 },
];

const t5Wos: MockAffectedWo[] = [
  { woId: 5001, woNumber: "WO-20260120", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-140", partNumber: "FRM-200", currentStep: "Paint", status: "In Progress", batchContext: null },
  { woId: 5002, woNumber: "WO-20260121", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-240", partNumber: "WLD-200", currentStep: "Weld", status: "In Progress", batchContext: null },
  { woId: 5003, woNumber: "WO-20260122", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-340", partNumber: "FRM-201", currentStep: "Machine", status: "Open", batchContext: "BATCH-015" },
  { woId: 5004, woNumber: "WO-20260123", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-440", partNumber: "WLD-201", currentStep: "Weld", status: "In Progress", batchContext: "BATCH-015" },
  { woId: 5005, woNumber: "WO-20260124", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-540", partNumber: "WLD-202", currentStep: "Paint", status: "Awaiting Material", batchContext: null },
];

// ─── Template 6 — Purchased Finished Component (21 parts, 7 WOs, 31 stock) ───
const t6Parts: MockReferencingPart[] = [
  { partId: 601, partNumber: "BRG-100", partName: "Ball Bearing", stockOnHand: 4 },
  { partId: 602, partNumber: "BRG-101", partName: "Roller Bearing", stockOnHand: 0 },
  { partId: 603, partNumber: "BRG-102", partName: "Thrust Bearing", stockOnHand: 2 },
  { partId: 604, partNumber: "FST-100", partName: "Hex Bolt Set", stockOnHand: 0 },
  { partId: 605, partNumber: "FST-101", partName: "Socket Cap Screws", stockOnHand: 5 },
  { partId: 606, partNumber: "FST-102", partName: "Flat Washer Kit", stockOnHand: 0 },
  { partId: 607, partNumber: "FST-103", partName: "Lock Nut Assortment", stockOnHand: 3 },
  { partId: 608, partNumber: "KYS-100", partName: "Woodruff Key", stockOnHand: 0 },
  { partId: 609, partNumber: "KYS-101", partName: "Square Key", stockOnHand: 0 },
  { partId: 610, partNumber: "MOT-100", partName: "AC Motor 1HP", stockOnHand: 0 },
  { partId: 611, partNumber: "MOT-101", partName: "DC Motor 0.5HP", stockOnHand: 1 },
  { partId: 612, partNumber: "PMP-100", partName: "Centrifugal Pump", stockOnHand: 0 },
  { partId: 613, partNumber: "PMP-101", partName: "Gear Pump", stockOnHand: 2 },
  { partId: 614, partNumber: "SLR-100", partName: "Oil Seal", stockOnHand: 0 },
  { partId: 615, partNumber: "SLR-101", partName: "V-Ring Seal", stockOnHand: 6 },
  { partId: 616, partNumber: "SLR-102", partName: "O-Ring Kit", stockOnHand: 0 },
  { partId: 617, partNumber: "SPR-100", partName: "Compression Spring", stockOnHand: 4 },
  { partId: 618, partNumber: "SPR-101", partName: "Extension Spring", stockOnHand: 0 },
  { partId: 619, partNumber: "VLV-100", partName: "Ball Valve 1in", stockOnHand: 2 },
  { partId: 620, partNumber: "VLV-101", partName: "Check Valve", stockOnHand: 0 },
  { partId: 621, partNumber: "VLV-102", partName: "Relief Valve", stockOnHand: 2 },
];

const t6Wos: MockAffectedWo[] = [
  { woId: 6001, woNumber: "WO-20260130", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-150", partNumber: "BRG-100", currentStep: "Receive", status: "Open", batchContext: null },
  { woId: 6002, woNumber: "WO-20260131", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-250", partNumber: "MOT-101", currentStep: "Receive", status: "Awaiting Purchase", batchContext: null },
  { woId: 6003, woNumber: "WO-20260132", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-350", partNumber: "SLR-101", currentStep: "Receive", status: "Open", batchContext: "BATCH-016" },
  { woId: 6004, woNumber: "WO-20260133", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-350", partNumber: "FST-101", currentStep: "Receive", status: "Open", batchContext: "BATCH-016" },
  { woId: 6005, woNumber: "WO-20260134", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-450", partNumber: "VLV-100", currentStep: "Receive", status: "Awaiting Purchase", batchContext: null },
  { woId: 6006, woNumber: "WO-20260135", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-450", partNumber: "PMP-101", currentStep: "Receive", status: "Open", batchContext: null },
  { woId: 6007, woNumber: "WO-20260136", projectReference: "PROJ-E", projectColor: PROJECT_COLORS["PROJ-E"]!, topLevelReference: "ASSY-550", partNumber: "VLV-102", currentStep: "Receive", status: "Open", batchContext: null },
];

// t6 stock sum: 4+2+5+3+1+2+6+4+2+2 = 31 ✓

// ─── Template 7 — 3D Printed Part (6 parts, 3 WOs, 12 stock) ─────────────────
const t7Parts: MockReferencingPart[] = [
  { partId: 701, partNumber: "PRT-100", partName: "Clip Bracket", stockOnHand: 4 },
  { partId: 702, partNumber: "PRT-101", partName: "Snap Cover", stockOnHand: 0 },
  { partId: 703, partNumber: "PRT-102", partName: "Guide Rail Spacer", stockOnHand: 3 },
  { partId: 704, partNumber: "PRT-103", partName: "Cable Clamp", stockOnHand: 0 },
  { partId: 705, partNumber: "PRT-104", partName: "Wiring Duct Cap", stockOnHand: 5 },
  { partId: 706, partNumber: "PRT-105", partName: "Sensor Bracket", stockOnHand: 0 },
];

const t7Wos: MockAffectedWo[] = [
  { woId: 7001, woNumber: "WO-20260140", projectReference: "PROJ-B", projectColor: PROJECT_COLORS["PROJ-B"]!, topLevelReference: "ASSY-260", partNumber: "PRT-100", currentStep: "3D Print", status: "In Progress", batchContext: null },
  { woId: 7002, woNumber: "WO-20260141", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-360", partNumber: "PRT-102", currentStep: "3D Print", status: "In Progress", batchContext: "BATCH-017" },
  { woId: 7003, woNumber: "WO-20260142", projectReference: "PROJ-D", projectColor: PROJECT_COLORS["PROJ-D"]!, topLevelReference: "ASSY-460", partNumber: "PRT-104", currentStep: "3D Print", status: "Open", batchContext: "BATCH-017" },
];

// t7 stock sum: 4+3+5 = 12 ✓

// ─── Template 8 — 3D Printed + Painted (4 parts, 2 WOs, 8 stock) ─────────────
const t8Parts: MockReferencingPart[] = [
  { partId: 801, partNumber: "PRP-100", partName: "Painted Clip Cover", stockOnHand: 3 },
  { partId: 802, partNumber: "PRP-101", partName: "Cosmetic Cap", stockOnHand: 0 },
  { partId: 803, partNumber: "PRP-102", partName: "Color Badge", stockOnHand: 5 },
  { partId: 804, partNumber: "PRP-103", partName: "Indicator Lens", stockOnHand: 0 },
];

const t8Wos: MockAffectedWo[] = [
  { woId: 8001, woNumber: "WO-20260150", projectReference: "PROJ-A", projectColor: PROJECT_COLORS["PROJ-A"]!, topLevelReference: "ASSY-160", partNumber: "PRP-100", currentStep: "Paint", status: "In Progress", batchContext: null },
  { woId: 8002, woNumber: "WO-20260151", projectReference: "PROJ-C", projectColor: PROJECT_COLORS["PROJ-C"]!, topLevelReference: "ASSY-360", partNumber: "PRP-102", currentStep: "3D Print", status: "Open", batchContext: null },
];

// t8 stock sum: 3+5 = 8 ✓

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
    referencingParts: [
      { partId: 101, partNumber: "BRK-101", partName: "Main Bracket", stockOnHand: 15 },
      { partId: 102, partNumber: "BRK-102", partName: "Side Bracket", stockOnHand: 0 },
      { partId: 103, partNumber: "BRK-103", partName: "Corner Bracket", stockOnHand: 12 },
      { partId: 104, partNumber: "BRK-104", partName: "Mounting Bracket", stockOnHand: 0 },
      { partId: 105, partNumber: "CAP-205", partName: "End Cap", stockOnHand: 4 },
      { partId: 106, partNumber: "CVR-310", partName: "Top Cover", stockOnHand: 0 },
      { partId: 107, partNumber: "CVR-311", partName: "Bottom Cover", stockOnHand: 6 },
      { partId: 108, partNumber: "HSG-400", partName: "Pump Housing", stockOnHand: 0 },
      { partId: 109, partNumber: "HSG-401", partName: "Valve Housing", stockOnHand: 3 },
      { partId: 110, partNumber: "MNT-501", partName: "Wall Mount", stockOnHand: 0 },
      { partId: 111, partNumber: "MNT-502", partName: "Ceiling Mount", stockOnHand: 9 },
      { partId: 112, partNumber: "PIN-601", partName: "Drive Pin", stockOnHand: 0 },
      { partId: 113, partNumber: "PIN-602", partName: "Locking Pin", stockOnHand: 20 },
      { partId: 114, partNumber: "PLT-330", partName: "Base Plate", stockOnHand: 0 },
      { partId: 115, partNumber: "PLT-331", partName: "Slide Plate", stockOnHand: 5 },
      { partId: 116, partNumber: "PLT-332", partName: "Cover Plate", stockOnHand: 0 },
      { partId: 117, partNumber: "SHF-701", partName: "Drive Shaft", stockOnHand: 7 },
      { partId: 118, partNumber: "SHF-702", partName: "Output Shaft", stockOnHand: 0 },
      { partId: 119, partNumber: "SHF-703", partName: "Stub Shaft", stockOnHand: 18 },
      { partId: 120, partNumber: "SPR-801", partName: "Return Spring", stockOnHand: 0 },
      { partId: 121, partNumber: "SPC-901", partName: "Shaft Spacer", stockOnHand: 4 },
      { partId: 122, partNumber: "SPC-902", partName: "Bearing Spacer", stockOnHand: 0 },
      { partId: 123, partNumber: "SPC-903", partName: "Flange Spacer", stockOnHand: 8 },
      { partId: 124, partNumber: "SPC-904", partName: "Tube Spacer", stockOnHand: 0 },
      { partId: 125, partNumber: "BLK-001", partName: "Cylinder Block", stockOnHand: 2 },
      { partId: 126, partNumber: "BLK-002", partName: "Manifold Block", stockOnHand: 0 },
      { partId: 127, partNumber: "BLK-003", partName: "Adapter Block", stockOnHand: 18 },
      { partId: 128, partNumber: "NZL-101", partName: "Spray Nozzle", stockOnHand: 0 },
      { partId: 129, partNumber: "NZL-102", partName: "Feed Nozzle", stockOnHand: 10 },
      { partId: 130, partNumber: "FLG-201", partName: "Inlet Flange", stockOnHand: 0 },
      { partId: 131, partNumber: "FLG-202", partName: "Outlet Flange", stockOnHand: 3 },
      { partId: 132, partNumber: "FLG-203", partName: "Reducing Flange", stockOnHand: 1 },
    ],
    affectedWos: t1Wos,
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
    referencingParts: t2Parts,
    affectedWos: t2Wos,
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
    referencingParts: t3Parts,
    affectedWos: t3Wos,
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
    referencingParts: t4Parts,
    affectedWos: t4Wos,
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
    referencingParts: t5Parts,
    affectedWos: t5Wos,
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
    referencingParts: t6Parts,
    affectedWos: t6Wos,
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
    referencingParts: t7Parts,
    affectedWos: t7Wos,
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
    referencingParts: t8Parts,
    affectedWos: t8Wos,
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

