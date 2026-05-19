# ADR-001: Tech Stack — Next.js, TypeScript, Prisma, PostgreSQL, Vercel

**Status:** Accepted
**Date:** 2026-05-07
**Phase:** 0

## Context

Tirion is a manufacturing production management tool intended to replace
spreadsheet-driven workflows for small-to-mid manufacturers. The first
revision must be deployable within 1-2 weeks by a single non-engineer
working with AI coding assistance, must be hostable on free or low-cost
tiers, and must serve as a portfolio artifact demonstrable to hiring
managers in Product and engineering roles.

Selection criteria, weighted in this order:

1. Time to working deployment for a single contributor
2. Maturity and breadth of documentation (because the work is AI-assisted
   and falls back on public Q&A frequently)
3. Industry recognition for portfolio purposes
4. Free-tier viability for Rev 1, with clear paid-tier path for production
5. Avoidance of operational complexity that would distract from product work

## Decision

The stack:

- **Language:** TypeScript with strict mode enabled
- **Framework:** Next.js (App Router) with React
- **Database:** PostgreSQL, hosted on Neon (Postgres-as-a-service)
- **ORM:** Prisma
- **API style:** REST via Next.js API Routes, with Zod for request validation
- **Frontend styling:** Tailwind CSS with shadcn/ui components
- **Testing:** Vitest
- **Logging:** Pino
- **Error tracking:** Sentry
- **Hosting:** Vercel (app) + Neon (database)
- **Repository:** GitHub

## Consequences

**Positive:**

- Deployment to a public URL is achievable in hours, not days. Vercel +
  Neon + GitHub compose with near-zero configuration.
- Every tool in the stack has extensive documentation, large communities,
  and well-known patterns. AI-assisted development against this stack
  produces fewer surprises than against bleeding-edge alternatives.
- The combination is recognizable to engineering hiring managers as a
  current, professional choice. No tool requires defense as an unusual
  pick.
- Free tiers cover the build phase and initial usage; scaling paths are
  conventional (Vercel paid tier, Neon paid tier).
- TypeScript strict mode plus Prisma's generated types provide
  significant correctness guarantees at the compiler level, reducing the
  test surface needed to maintain confidence.

**Negative:**

- Vendor coupling: Vercel and Neon are commercial services. A future
  migration to self-hosted infrastructure or a different platform would
  require non-trivial work.
- Stack churn risk: Next.js, Prisma, and the React ecosystem move quickly.
  We have already encountered version-specific breaking changes during
  Phase 0 (Prisma 7 generator config, Sentry SDK source-map config). The
  pace continues.
- Server components and the App Router are still maturing as a paradigm.
  Some patterns are not yet community-canonical.

## Alternatives considered

- **Rails or Django:** More batteries-included, faster for CRUD-heavy apps,
  but smaller relevance to current engineering job markets and slower for
  rich frontend work.
- **tRPC instead of REST:** Type-safe end-to-end, less boilerplate, but
  REST is a deliberate learning and portfolio goal for this build.
- **SQLite for the database:** SQLite excels in single-process desktop
  deployments but is the wrong fit for serverless hosting. On Vercel,
  function invocations don't share a persistent filesystem, so a SQLite
  file would be either ephemeral or stored remotely with significant
  latency and no concurrent-write support. A network-accessible database
  service is required by the hosting model, not by the schema's
  complexity.
- **Supabase instead of Neon:** Supabase bundles auth and other features
  Rev 1 does not need. Adopting it would mean either committing to its
  auth model early (premature) or carrying unused infrastructure.
- **Cloudflare Workers, Railway, Fly.io for hosting:** All viable, but
  Vercel's Next.js integration is purpose-built and removes deployment
  friction entirely.
