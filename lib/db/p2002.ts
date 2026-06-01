import { Prisma } from "@prisma/client";

/**
 * Returns true when `err` is a Prisma P2002 unique-constraint violation on the
 * given single field.
 *
 * Two detection paths are needed:
 *
 * - Native query engine path: Prisma populates `meta.target` as a string[]
 *   containing the column names involved in the violation. We check whether
 *   fieldName is present in that array.
 *
 * - Driver adapter path: when using a Prisma driver adapter (required by
 *   the project's Neon serverless deployment — see ADR-009), `meta.target` is
 *   omitted. We fall back to string-matching the error message, which Prisma
 *   formats as 'Unique constraint failed on the fields: ("fieldName")'.
 */
export function isP2002OnField(err: unknown, fieldName: string): boolean {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return false;
  }

  const target = (err.meta as { target?: unknown } | undefined)?.target;

  if (Array.isArray(target)) {
    return (target as string[]).includes(fieldName);
  }

  // Driver adapter fallback: message contains the field name in quoted form.
  return err.message.includes(`"${fieldName}"`);
}

/**
 * Returns true when `err` is a Prisma P2002 unique-constraint violation on the
 * given composite of fields (set equality — order does not matter).
 *
 * Two detection paths are needed:
 *
 * - Native query engine path: `meta.target` is a string[] of the column names
 *   in the violated constraint. We verify all fieldNames are present and that
 *   no extra fields appear (exact set match).
 *
 * - Driver adapter path: `meta.target` is omitted. We fall back to parsing the
 *   error message. Prisma formats composite violations as:
 *     'Unique constraint failed on the fields: ("a","b")'  or
 *     'Unique constraint failed on the fields: (a, b)'
 *   We verify that all fieldNames appear in the message; a partial match does
 *   not count.
 */
export function isP2002OnComposite(err: unknown, fieldNames: string[]): boolean {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return false;
  }

  const target = (err.meta as { target?: unknown } | undefined)?.target;

  if (Array.isArray(target)) {
    const targetSet = new Set(target as string[]);
    const fieldSet = new Set(fieldNames);
    if (targetSet.size !== fieldSet.size) return false;
    for (const f of fieldSet) {
      if (!targetSet.has(f)) return false;
    }
    return true;
  }

  // Driver adapter fallback: verify every field name appears in the message.
  // Quoted form ("fieldName") covers the standard Prisma message format.
  return fieldNames.every((f) => err.message.includes(`"${f}"`) || err.message.includes(f));
}
