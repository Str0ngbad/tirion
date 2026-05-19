# ADR-011: Neon Database Branches for Dev/Test/Prod Isolation

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

The BUILD_ROADMAP called for Docker Compose to run a local PostgreSQL instance
for development and a separate container for test database isolation. This is
the conventional approach for Next.js + Prisma local development.

Neon — already chosen for the production database (ADR-001) — offers database
branching as a first-class feature. A Neon branch is a copy-on-write fork of
a database at a point in time, with its own connection string, that can be
created and deleted in seconds. This enables dev/test/prod isolation entirely
within Neon, without any local infrastructure.

This is a deviation from the BUILD_ROADMAP and is captured in DEVIATIONS.md.
It warrants an ADR because it has consequences that extend beyond the Phase 0
setup decision.

## Decision

Three Neon branches replace the planned Docker Compose setup:

- **`main`** — production database, connected to the Vercel production
  deployment
- **`dev`** — development database, used during active feature work
- **`test`** — test database, used exclusively by Vitest integration tests

Each branch has its own `DATABASE_URL`. Branch credentials are stored in the
appropriate `.env` files. Migrations are developed against the dev branch using
`npx prisma migrate dev`, which generates a migration file and applies it to
dev. Once a migration is validated in dev, it is applied to main via
`npx prisma migrate deploy` (run from CI or the deployment pipeline). The test
branch receives migrations via `migrate deploy` against the test connection
string, or by being re-branched off main after the migration is deployed.

## Consequences

**Positive:**

- No local software installation required beyond Node.js and npm. A new
  environment is set up by checking out the repo and adding the `.env` file.
  Docker does not need to be installed or running.
- The dev and test databases run on the same PostgreSQL engine version as
  production. There is no risk of behavior differences between local and
  production (e.g., date handling, JSON operators, index behavior).
- Neon branches are free on the Neon free tier for the data volumes Tirion
  will have in Rev 1. No additional cost.
- Branch creation is fast (seconds). A fresh test branch can be created from
  the current `main` state at any time.

**Negative:**

- Every database operation during development requires a network round-trip
  to Neon's servers. Local Docker PostgreSQL queries are sub-millisecond;
  Neon queries have network latency (typically 5-30ms depending on region and
  connection). This is noticeable during test runs with many database operations.
- Development requires an active internet connection. Offline development is
  not possible.
- If Neon has an outage, development is blocked entirely. Local Docker
  would be unaffected by a cloud provider's availability.
- Connection to the correct branch must be managed carefully. A misconfigured
  `DATABASE_URL` in the test environment could write to the dev branch (or
  worse, production) during test runs.

## Alternatives considered

- **Docker Compose with local PostgreSQL (as originally planned):** Offline
  capability, zero latency, no cloud dependency. Requires Docker installed and
  running. The engine parity concern is minor but real (local PostgreSQL version
  may differ from Neon's version). Rejected because the Neon branching
  capability eliminates the local setup burden without meaningful downside for
  the Rev 1 use case.
- **SQLite for local development, PostgreSQL for production:** A common
  pattern for development speed. Creates real risk: SQLite and PostgreSQL
  differ in type handling, constraint behavior, and supported SQL syntax.
  Tirion's schema uses PostgreSQL-specific features. Not viable.
- **Single shared Neon database with schema prefixes for isolation:** Avoids
  branch management but creates contention during test runs and makes it easy
  to accidentally pollute dev data with test writes. Rejected in favor of
  proper branch isolation.
