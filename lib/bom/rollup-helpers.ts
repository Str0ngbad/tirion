import type { BomNode } from "./types";

const STALE_AGE_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export function computeBuildable(node: BomNode): number {
  if (node.partType === "Part") {
    if (!node.quantity) return 0;
    const stock = node.isActive ? (node.stockCount ?? 0) : 0;
    return Math.floor(stock / node.quantity);
  }

  if (!node.children || node.children.length === 0) return 0;

  const childBuildables = node.children.map((child) => {
    if (!child.quantity) return 0;
    if (child.partType === "Part") {
      const stock = child.isActive ? (child.stockCount ?? 0) : 0;
      return Math.floor(stock / child.quantity);
    }
    const childStock = child.isActive ? (child.stockCount ?? 0) : 0;
    const childBuildable = computeBuildable(child);
    const effective = Math.min(childStock, childBuildable);
    return Math.floor(effective / child.quantity);
  });

  return Math.min(...childBuildables);
}

export function computeCostRollup(node: BomNode): number | null {
  if (node.partType === "Part") {
    return node.cost;
  }

  if (!node.children || node.children.length === 0) return 0;

  let sum = 0;
  for (const child of node.children) {
    if (!child.quantity) continue;
    if (child.partType === "Part") {
      if (child.cost === null) return null;
      sum += child.cost * child.quantity;
    } else {
      const childRollup = computeCostRollup(child);
      if (childRollup === null) return null;
      sum += childRollup * child.quantity;
    }
  }
  return sum;
}

export type Freshness = "ok" | "stale" | "missing";

export function computeFreshness(node: BomNode, now: Date): Freshness {
  if (node.partType === "Part") {
    if (node.cost === null) return "missing";
    if (!node.costLastUpdated) return "stale";
    const ageMs = now.getTime() - new Date(node.costLastUpdated).getTime();
    if (ageMs > STALE_AGE_MS) return "stale";
    return "ok";
  }

  if (!node.children || node.children.length === 0) return "ok";

  let result: Freshness = "ok";
  for (const child of node.children) {
    const childFreshness = computeFreshness(child, now);
    if (childFreshness === "missing") return "missing";
    if (childFreshness === "stale") result = "stale";
  }
  return result;
}
