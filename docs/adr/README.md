# Architecture Decision Records

This directory contains the architectural decisions made for the Tirion project. Each ADR captures one decision — the context that prompted it, the decision itself, the consequences, and the alternatives considered.

The format is intentionally lightweight: each ADR is ~300-400 words, written in plain language, and structured so that a future engineer (or hiring manager, or contributor) can understand both *what* was decided and *why* without reading the full spec corpus.

For the rationale behind using ADRs and the format used here, see [ADR-001](./ADR-001-tech-stack.md), which establishes the canonical template for the project.

## Status legend

- **Accepted** — the decision is current and binding.
- **Superseded** — replaced by a later ADR; the file remains in place for historical reference.
- **Deprecated** — the decision is no longer applied but has not been formally replaced.

All ADRs in Rev 1 are currently Accepted.

## Index

| # | Title | Status | Summary |
|---|---|---|---|
| [001](./ADR-001-tech-stack.md) | Tech Stack | Accepted | Next.js + TypeScript + Prisma + PostgreSQL (Neon) + Vercel for the Rev 1 production stack. |
| [002](./ADR-002-typescript-strict-mode.md) | TypeScript Strict Mode | Accepted | `strict: true` with a no-`any` policy and exhaustive enum handling, to catch state-machine bugs at compile time. |
| [003](./ADR-003-rest-api-style.md) | REST API Style | Accepted | REST over Next.js API Routes with Zod validation, chosen over tRPC/GraphQL for portfolio learning value and future external consumer support. |
| [004](./ADR-004-prisma-orm.md) | Prisma as ORM | Accepted | Prisma for schema-first ORM with auto-generated TypeScript types; covers most query patterns without dropping into raw SQL. |
| [005](./ADR-005-pino-logging.md) | Pino for Structured Logging | Accepted | Pino for JSON-structured logs in production, `pino-pretty` for human-readable dev output, with a shared logger instance. |
| [006](./ADR-006-sentry-error-tracking.md) | Sentry for Error Tracking | Accepted | Sentry to capture unhandled exceptions in production, with source maps and SDK initialization wired into the Next.js application. |
| [007](./ADR-007-vitest.md) | Vitest for Testing | Accepted | Vitest over Jest for native TypeScript + ESM support and faster execution, with pragmatic coverage focused on business logic and transactions. |
| [008](./ADR-008-manual-user-selection.md) | Manual User Selection, No Auth in Rev 1 | Accepted | User identity passed via `X-User-Id` header without verification; authorization (role checks) is enforced server-side, authentication deferred to Rev 2. |
| [009](./ADR-009-prisma-client-singleton.md) | Prisma Client Singleton | Accepted | Single `PrismaClient` instance attached to `globalThis` to prevent connection pool exhaustion during Next.js hot reload in development. |
| [010](./ADR-010-conventional-commits.md) | Conventional Commits | Accepted | Conventional Commits format (`feat:`, `fix:`, `chore:`, etc.) for scannable history and tooling compatibility, enforced by discipline rather than commitlint in Rev 1. |
| [011](./ADR-011-neon-branches-for-isolation.md) | Neon Branches for Dev/Test/Prod | Accepted | Three Neon database branches (`main`, `dev`, `test`) replace planned Docker Compose; migrations flow dev → main → test via standard Prisma commands. |
| [012](./ADR-012-commits-via-claude-code.md) | All Commits Routed Through Claude Code | Accepted | All Rev 1 commits go through Claude Code's commit workflow so `PostToolUse` hooks fire; recovery path documented for direct-terminal commits when unavoidable. |
| [013](./ADR-013-cross-surface-navigation.md) | Cross-surface navigation via layered modals | Accepted | 2026-05-31 |

## Adding a new ADR

When a new architectural decision is made:

1. Copy the structure from an existing ADR (ADR-001 is the canonical template).
2. Use the next available number with a descriptive slug: `ADR-013-some-decision.md`.
3. Set Status to "Accepted" and Date to the current date.
4. Update this index file with the new entry.
5. Commit the ADR and the index update together.

If an existing ADR is superseded by a new one, update the older ADR's Status to "Superseded" with a reference to the new ADR, and note the supersession in this index.
