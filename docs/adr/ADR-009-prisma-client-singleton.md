# ADR-009: Single Shared Prisma Client Singleton

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

Next.js's development server hot-reloads application modules when files change.
Each module reload re-executes module-level code, including any `new PrismaClient()`
instantiation. Each `PrismaClient` instance opens its own connection pool to
the database. With frequent hot-reloads during development, naively instantiating
the client at module level exhausts the database's connection limit quickly.
This is a documented, well-known issue with Next.js + Prisma.

## Decision

A single `PrismaClient` instance is created once and stored on `globalThis`
in development. In production, a single instance is created at module load
(no `globalThis` needed because hot-reload does not occur). Both paths are
handled in a single file at `/lib/db/prisma.ts`, which is the only place in
the codebase where `PrismaClient` is instantiated. All other modules import
the client from this file.

```typescript
// lib/db/prisma.ts (structure)
const globalForPrisma = global as typeof global & { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## Consequences

**Positive:**

- Connection pool exhaustion does not occur during development regardless of
  how many hot-reloads happen, because the same client instance is reused.
- One import path (`/lib/db/prisma`) means there is one place to change if
  the client configuration ever needs to be updated.
- This is the pattern recommended by Prisma's own Next.js documentation and
  is widely recognized by developers familiar with the stack.

**Negative:**

- The `globalThis` usage is a deliberate workaround for a framework behavior
  rather than a clean design. It relies on the module system's semantics in a
  way that is not immediately obvious to a reader unfamiliar with the pattern.
- If a module instantiates `new PrismaClient()` directly (a mistake), the
  singleton guarantee breaks silently. There is no compile-time enforcement;
  only code review and convention prevent it.
- In a future serverless/edge architecture where multiple isolated function
  contexts exist simultaneously, a per-process singleton may not be the right
  model. This is not a Rev 1 concern.

## Alternatives considered

- **`new PrismaClient()` per request:** Creates and destroys a connection pool
  on every request. Avoids the global state but exhausts database connections
  in development and adds latency in production. Not viable.
- **PgBouncer or an external connection pooler:** Correct solution at scale —
  a pooler sits between the application and the database and manages connections
  independently of application restarts. Adds operational infrastructure that
  is not justified for Rev 1.
- **Neon's serverless HTTP driver:** Neon provides a driver that issues queries
  over HTTP, which is stateless and avoids connection pool concerns entirely.
  A possible future direction but introduces a different client API and was not
  evaluated during Phase 0.
