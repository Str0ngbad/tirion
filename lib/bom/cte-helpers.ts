import type { PrismaClient } from "@prisma/client";

type DescendantRow = { path: number[] | string };
type DepthRow = { max_depth: number | bigint | string };

function toNumberArray(val: number[] | string): number[] {
  if (Array.isArray(val)) return val.map(Number);
  // Postgres array arrives as "{1,2,3}" string with some driver adapters
  const inner = (val as string).replace(/^\{/, "").replace(/\}$/, "");
  if (!inner) return [];
  return inner.split(",").map(Number);
}

/**
 * Returns the ordered chain of Part IDs forming the proposed cycle,
 * or null if no cycle would be created.
 *
 * Algorithm: walk the proposed child's subtree downward. If the proposed
 * parent appears anywhere in the descendant set, adding (parent→child)
 * creates a cycle. The cycle chain is preserved via Postgres array
 * accumulation so it can be included in error responses.
 *
 * The cycle guard (NOT child = ANY(path)) is defensive against any stored
 * cycles in the data — prevents infinite recursion.
 */
export async function detectCycle(
  prisma: PrismaClient,
  parentPartId: number,
  childPartId: number,
): Promise<number[] | null> {
  if (parentPartId === childPartId) return [parentPartId, parentPartId];

  const rows = await prisma.$queryRaw<DescendantRow[]>`
    WITH RECURSIVE descendants(part_id, path) AS (
      SELECT ${childPartId}::int AS part_id,
             ARRAY[${childPartId}::int] AS path
      UNION ALL
      SELECT b."childPartId",
             d.path || b."childPartId"
      FROM "BOM" b
      JOIN descendants d ON b."parentPartId" = d.part_id
      WHERE NOT (b."childPartId" = ANY(d.path))
    )
    SELECT path FROM descendants WHERE part_id = ${parentPartId}::int LIMIT 1
  `;

  if (rows.length === 0) return null;

  // path starts at childPartId and ends at parentPartId.
  // Render the full cycle as: parentPartId → chain → parentPartId.
  const chain = toNumberArray(rows[0]!.path);
  return [parentPartId, ...chain.slice(0, -1), parentPartId];
}

/**
 * Returns the maximum depth of any ancestor chain ending at parentPartId.
 * Depth 1 means the part has no ancestors (it is a root).
 */
export async function getMaxAncestorDepth(
  prisma: PrismaClient,
  parentPartId: number,
): Promise<number> {
  const rows = await prisma.$queryRaw<DepthRow[]>`
    WITH RECURSIVE ancestors(part_id, depth, path) AS (
      SELECT ${parentPartId}::int, 1, ARRAY[${parentPartId}::int]
      UNION ALL
      SELECT b."parentPartId",
             a.depth + 1,
             a.path || b."parentPartId"
      FROM "BOM" b
      JOIN ancestors a ON b."childPartId" = a.part_id
      WHERE NOT (b."parentPartId" = ANY(a.path))
    )
    SELECT COALESCE(MAX(depth), 1)::int AS max_depth FROM ancestors
  `;

  return Number(rows[0]?.max_depth ?? 1);
}

/**
 * Returns the maximum depth of any descendant chain starting at childPartId.
 * Depth 1 means the part has no descendants.
 */
export async function getMaxDescendantDepth(
  prisma: PrismaClient,
  childPartId: number,
): Promise<number> {
  const rows = await prisma.$queryRaw<DepthRow[]>`
    WITH RECURSIVE descendants(part_id, depth, path) AS (
      SELECT ${childPartId}::int, 1, ARRAY[${childPartId}::int]
      UNION ALL
      SELECT b."childPartId",
             d.depth + 1,
             d.path || b."childPartId"
      FROM "BOM" b
      JOIN descendants d ON b."parentPartId" = d.part_id
      WHERE NOT (b."childPartId" = ANY(d.path))
    )
    SELECT COALESCE(MAX(depth), 1)::int AS max_depth FROM descendants
  `;

  return Number(rows[0]?.max_depth ?? 1);
}
