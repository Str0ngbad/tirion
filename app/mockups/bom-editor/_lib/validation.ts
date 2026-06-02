import { MOCK_PARTS } from "@/app/mockups/parts/_data";

export const DEPTH_SOFT = 6;
export const DEPTH_HARD = 8;

// ─── Cycle detection ─────────────────────────────────────────────────────────

/**
 * Returns true if adding `candidateId` as a child of `parentId` would create
 * a cycle (i.e., `parentId` is already reachable transitively from `candidateId`).
 */
export function wouldCreateCycle(parentId: number, candidateId: number): boolean {
  return hasDescendant(candidateId, parentId, new Set());
}

function hasDescendant(root: number, target: number, visited: Set<number>): boolean {
  if (root === target) return true;
  if (visited.has(root)) return false;
  visited.add(root);
  const part = MOCK_PARTS.find((p) => p.partId === root);
  if (!part) return false;
  return part.childParts.some((c) => hasDescendant(c.childPartId, target, visited));
}

/**
 * Returns the cycle chain as an array of partIds:
 *   [parentId, candidateId, …path through candidate's subtree…, parentId]
 * Returns null if no cycle would be created.
 */
export function findCycleChain(parentId: number, candidateId: number): number[] | null {
  const path: number[] = [];
  if (!findPathDown(candidateId, parentId, path, new Set())) return null;
  return [parentId, ...path];
}

function findPathDown(
  current: number,
  target: number,
  path: number[],
  visited: Set<number>
): boolean {
  if (visited.has(current)) return false;
  visited.add(current);
  path.push(current);
  if (current === target) return true;
  const part = MOCK_PARTS.find((p) => p.partId === current);
  if (part) {
    for (const child of part.childParts) {
      if (findPathDown(child.childPartId, target, path, visited)) return true;
    }
  }
  path.pop();
  return false;
}

// ─── Depth validation ─────────────────────────────────────────────────────────

/**
 * Computes the maximum total BOM depth that would result from adding
 * `candidateId` as a child of `parentId`.
 *
 * total = maxAncestorDepth(parentId) + 1 + maxDescendantDepth(candidateId)
 */
export function computeAddDepth(parentId: number, candidateId: number): number {
  return maxAncestorDepth(parentId, new Set()) + 1 + maxDescendantDepth(candidateId, new Set());
}

/** Max steps upward from `partId` to any root (an Assembly with no parents). */
function maxAncestorDepth(partId: number, visited: Set<number>): number {
  if (visited.has(partId)) return 0;
  visited.add(partId);
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part || part.parentAssemblies.length === 0) return 0;
  const depths = part.parentAssemblies.map((a) => maxAncestorDepth(a.assemblyPartId, new Set(visited)));
  return 1 + Math.max(...depths, 0);
}

/** Max steps downward from `partId` to any leaf. */
function maxDescendantDepth(partId: number, visited: Set<number>): number {
  if (visited.has(partId)) return 0;
  visited.add(partId);
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part || part.childParts.length === 0) return 0;
  const depths = part.childParts.map((c) => maxDescendantDepth(c.childPartId, new Set(visited)));
  return 1 + Math.max(...depths, 0);
}

// ─── Edit-distance fuzzy match ────────────────────────────────────────────────

/**
 * For Part Number search: compare the search string against the candidate's
 * prefix of equal length. This avoids inflated distances when the user is
 * mid-typing (e.g., "41-02-1-" vs "41-02-0-AB" — the prefix "41-02-0-" has
 * distance 1, but the full string comparison gives distance 2).
 * If search is longer than the candidate, falls back to full edit distance.
 */
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
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[n]!;
}

/**
 * Returns a rank for relevance sorting (lower = better match):
 *  1 exact PN, 2 prefix PN, 3 substring PN, 4 edit-distance PN,
 *  5 substring Name, 6 edit-distance Name, 99 no match
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

/** Returns true if the query matches the part number or name via substring or edit-distance. */
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
  const threshold = 1;
  // Part number: prefix-based edit distance (avoids inflation mid-typing)
  if (partNumberEditDistanceMatches(q, pn, threshold)) return true;
  // Part name: sliding window edit distance
  for (let i = 0; i <= nm.length - q.length + threshold; i++) {
    const window = nm.substring(i, i + q.length + threshold);
    if (editDistance(q, window) <= threshold) return true;
  }
  return false;
}
