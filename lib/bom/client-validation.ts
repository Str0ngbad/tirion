import type { BomNode } from "./types";

export const DEPTH_SOFT = 6;
export const DEPTH_HARD = 8;

// ─── Cycle detection ─────────────────────────────────────────────────────────

/**
 * Returns true if adding candidateId as a child of parentId would create a cycle,
 * based on the loaded BomNode tree. The backend is the authority for cross-tree cycles.
 */
export function wouldCreateCycle(
  parentId: number,
  candidateId: number,
  root: BomNode
): boolean {
  if (candidateId === parentId) return true;
  const candidateNode = findNode(root, candidateId);
  if (!candidateNode) return false;
  return isDescendant(candidateNode, parentId);
}

/**
 * Returns [parentId, ...path from candidateId to parentId] or null if no cycle detected.
 */
export function findCycleChain(
  parentId: number,
  candidateId: number,
  root: BomNode
): number[] | null {
  if (candidateId === parentId) return [parentId, parentId];
  const candidateNode = findNode(root, candidateId);
  if (!candidateNode) return null;
  const path: number[] = [];
  if (!findPathDown(candidateNode, parentId, path)) return null;
  return [parentId, ...path];
}

function findNode(node: BomNode, targetId: number): BomNode | null {
  if (node.partId === targetId) return node;
  for (const child of node.children) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}

function isDescendant(node: BomNode, targetId: number): boolean {
  for (const child of node.children) {
    if (child.partId === targetId) return true;
    if (isDescendant(child, targetId)) return true;
  }
  return false;
}

function findPathDown(node: BomNode, targetId: number, path: number[]): boolean {
  path.push(node.partId);
  if (node.partId === targetId) return true;
  for (const child of node.children) {
    if (findPathDown(child, targetId, path)) return true;
  }
  path.pop();
  return false;
}

// ─── Depth computation ────────────────────────────────────────────────────────

/**
 * Estimates resulting max BOM depth if candidateId is added as a child of parentId.
 * Uses the loaded tree for both ancestor depth and candidate subtree depth.
 * Backend is the authority for the exact depth across the full BOM graph.
 */
export function computeAddDepth(
  parentId: number,
  candidateId: number,
  root: BomNode
): number {
  const parentDepth = findDepthInTree(root, parentId, 0) ?? 0;
  const candidateNode = findNode(root, candidateId);
  const candidateSubtreeDepth = candidateNode ? maxDescendantDepth(candidateNode) : 0;
  return parentDepth + 1 + candidateSubtreeDepth;
}

function findDepthInTree(node: BomNode, targetId: number, d: number): number | null {
  if (node.partId === targetId) return d;
  for (const child of node.children) {
    const found = findDepthInTree(child, targetId, d + 1);
    if (found !== null) return found;
  }
  return null;
}

function maxDescendantDepth(node: BomNode): number {
  if (!node.children.length) return 0;
  return 1 + Math.max(...node.children.map(maxDescendantDepth));
}

// ─── Fuzzy part matching ──────────────────────────────────────────────────────

function partNumberEditDistanceMatches(
  search: string,
  candidatePartNumber: string,
  threshold: number
): boolean {
  const target =
    search.length <= candidatePartNumber.length
      ? candidatePartNumber.slice(0, search.length)
      : candidatePartNumber;
  return editDistance(search, target) <= threshold;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[n]!;
}

/**
 * Returns a relevance rank (lower = better):
 *   1 exact PN, 2 prefix PN, 3 substring PN, 4 edit-distance PN,
 *   5 substring Name, 6 edit-distance Name, 99 no match
 */
export function rankPartMatch(
  partNumber: string,
  partName: string,
  query: string
): number {
  if (!query) return 99;
  const q = query.toLowerCase();
  const pn = partNumber.toLowerCase();
  const nm = partName.toLowerCase();
  if (pn === q) return 1;
  if (pn.startsWith(q)) return 2;
  if (pn.includes(q)) return 3;
  if (q.length >= 3 && partNumberEditDistanceMatches(q, pn, 1)) return 4;
  if (nm.includes(q)) return 5;
  if (q.length >= 3) {
    for (let i = 0; i <= nm.length - q.length + 1; i++) {
      const w = nm.substring(i, i + q.length + 1);
      if (editDistance(q, w) <= 1) return 6;
    }
  }
  return 99;
}

export function partMatchesQuery(
  partNumber: string,
  partName: string,
  query: string
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const pn = partNumber.toLowerCase();
  const nm = partName.toLowerCase();
  if (pn.includes(q) || nm.includes(q)) return true;
  if (q.length < 3) return false;
  if (partNumberEditDistanceMatches(q, pn, 1)) return true;
  for (let i = 0; i <= nm.length - q.length + 1; i++) {
    const w = nm.substring(i, i + q.length + 1);
    if (editDistance(q, w) <= 1) return true;
  }
  return false;
}
