import { MOCK_PARTS, MockPart } from "@/app/mockups/parts/_data";

export type BomNode = {
  part: MockPart;
  quantity: number;
  displayOrder: number;
  children: BomNode[];
};

// Build a full recursive BOM tree for an assembly, stopping at circular refs.
export function buildBomTree(
  assemblyId: number,
  visited: Set<number> = new Set()
): BomNode[] {
  if (visited.has(assemblyId)) return [];
  visited.add(assemblyId);

  const assembly = MOCK_PARTS.find((p) => p.partId === assemblyId);
  if (!assembly || assembly.childParts.length === 0) return [];

  return assembly.childParts.map((child, idx) => {
    const childPart = MOCK_PARTS.find((p) => p.partId === child.childPartId);
    if (!childPart) {
      const phantom: MockPart = {
        partId: child.childPartId,
        partNumber: child.childPartNumber,
        partName: child.childPartName,
        partType: "Part",
        procurementType: "Make",
        description: null,
        blankLength: null,
        notes: null,
        materialSpec: null,
        stockSize: null,
        defaultVendor: null,
        routingTemplate: null,
        stockCount: 0,
        inventoryLocation: null,
        isActive: true,
        createdAt: "",
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
        auditLog: [],
      };
      return { part: phantom, quantity: child.quantity, displayOrder: idx + 1, children: [] };
    }

    const children =
      childPart.partType === "Assembly"
        ? buildBomTree(childPart.partId, new Set(visited))
        : [];

    return { part: childPart, quantity: child.quantity, displayOrder: idx + 1, children };
  });
}

// Compute buildable rollup for an assembly node.
export function computeBuildable(nodes: BomNode[]): number {
  if (nodes.length === 0) return 0;

  const contributions = nodes.map(({ part, quantity, children }) => {
    const stock = part.stockCount ?? 0;
    if (part.partType === "Assembly") {
      const childBuildable = computeBuildable(children);
      const effective = Math.min(stock, childBuildable);
      return Math.floor(effective / quantity);
    }
    return Math.floor(stock / quantity);
  });

  return Math.min(...contributions);
}

// Compute subtree cost rollup for an assembly node list.
export function computeCostRollup(nodes: BomNode[]): number | null {
  let total = 0;
  for (const { part, quantity, children } of nodes) {
    if (part.partType === "Assembly") {
      const sub = computeCostRollup(children);
      if (sub === null) return null;
      total += sub * quantity;
    } else {
      if (part.cost === null) return null;
      total += part.cost * quantity;
    }
  }
  return total;
}

// Check cost freshness across a subtree.
// Returns: 'missing' | 'stale' | 'ok'
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export type CostFreshness = "missing" | "stale" | "ok";

export function subtreeCostFreshness(nodes: BomNode[]): CostFreshness {
  let worst: CostFreshness = "ok";
  const today = new Date("2026-06-01").getTime();
  for (const { part, children } of nodes) {
    if (part.partType === "Part") {
      if (part.cost === null) return "missing";
      if (part.costLastUpdated === null) {
        if (worst === "ok") worst = "stale";
      } else {
        const age = today - new Date(part.costLastUpdated).getTime();
        if (age > SIX_MONTHS_MS && worst === "ok") worst = "stale";
      }
    } else {
      const sub = subtreeCostFreshness(children);
      if (sub === "missing") return "missing";
      if (sub === "stale" && worst === "ok") worst = "stale";
    }
  }
  return worst;
}

export function collectAssemblies(): MockPart[] {
  return MOCK_PARTS.filter((p) => p.partType === "Assembly" && p.isActive).sort((a, b) =>
    a.partNumber.localeCompare(b.partNumber)
  );
}
