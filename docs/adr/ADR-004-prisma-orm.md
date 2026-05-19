# ADR-004: Prisma as the ORM

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

Tirion's schema is non-trivial: 20+ models, multiple enums, self-referential
BOM relationships, FK integrity requirements, and a strict requirement that
every state-changing operation writes to AuditLog within the same database
transaction. The data access layer needs to support complex multi-table writes,
enforce migration discipline, and generate TypeScript types that the rest of
the codebase depends on.

## Decision

Prisma, with `schema.prisma` as the canonical schema definition. Migrations
are generated via `prisma migrate dev` and committed to the repository.
The Prisma client is generated at build time and imported throughout the
application via a singleton (see ADR-009). Raw SQL is not used except where
Prisma genuinely cannot express the query.

## Consequences

**Positive:**

- Prisma generates TypeScript types automatically from the schema. These types
  flow through the entire codebase — route handlers, business logic, tests —
  without manual maintenance. Changes to the schema surface immediately as
  compile errors at every affected call site.
- The migration system produces a committed, auditable migration history.
  Applying migrations to a new environment is deterministic.
- Prisma's `$transaction` API supports the multi-write transactional pattern
  (state change + AuditLog write) that every state-changing operation requires.
- Strong Next.js community support and documentation. Patterns for the Prisma
  singleton, Neon compatibility, and testing with real databases are
  well-documented.

**Negative:**

- Prisma introduces a runtime dependency (the query engine) in addition to the
  generated client. Startup time is slightly higher than a thin SQL driver.
- The Prisma DSL is its own schema language; developers must learn it in
  addition to SQL. Edge cases in complex queries (recursive CTEs, window
  functions) require dropping to `$queryRaw`.
- Prisma 7 changed the generator configuration format, which caused setup
  friction during Phase 0. The ecosystem moves faster than its documentation
  in some areas.
- The generated client is not usable at the edge (Vercel Edge Runtime) without
  the Prisma Accelerate adapter or the Neon serverless driver. This is not a
  Rev 1 concern but constrains future architectural choices.

## Alternatives considered

- **Drizzle ORM:** SQL-first, lighter runtime, TypeScript-native schema
  definition. Compelling for new projects but had a smaller community and
  fewer Next.js-specific patterns at the time of this decision. Migration
  tooling was less mature than Prisma's.
- **Raw SQL with `pg` or `postgres.js`:** Full control, no DSL overhead, no
  runtime dependency. Requires manual type definitions for every query result,
  which becomes a maintenance burden at Tirion's schema size. Also loses the
  auto-generated migration history.
- **TypeORM or Sequelize:** Established ORMs with decorator-based schemas.
  Carry legacy patterns and have fallen behind Prisma and Drizzle in community
  momentum and TypeScript-first ergonomics.
