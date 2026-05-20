# CLAUDE.md — Tirion Build Instructions for Claude Code

This file provides essential context for working on the Tirion codebase.
Read this in full at the start of any new session.

---

## What This Project Is

Tirion is a manufacturing production management tool for small-to-mid
manufacturers. It manages parts libraries, BOM hierarchies, projects,
production batches, and work order execution across multiple process types
(machining, welding, assembly, etc.).

The Rev 1 spec is complete and lives in `/spec/`. The spec is the source
of truth — when in doubt, read the spec.

---

## Critical Workflow Rules

### Always read the spec before implementing

Every feature has a spec document. Before writing code for a feature:

1. Read the relevant view spec in `/spec/`
2. Cross-reference `terminology_lock.md`, `state_model.md`, and `schema.md`
3. Check `open-questions.md` for related decisions
4. Check `DEVIATIONS.md` for any prior discoveries that affect this work

If the spec is silent or ambiguous on a question, **stop and ask** — don't
invent. Document the question in `DEVIATIONS.md`.

### Work in small, reviewable chunks

The user reviews diffs but does not read code at a deep level. Each commit
should:
- Do one thing
- Have a clear conventional commit message (`feat:`, `fix:`, `chore:`, etc.)
- Include any relevant test updates
- Update related documentation if behavior changed

Bias toward smaller commits. The user will review each diff for behavior;
small diffs make this faster.

### Never silently deviate from the spec

If during implementation you discover that the spec is wrong, incomplete, or
contradictory:

1. Stop
2. Document the discovery in `DEVIATIONS.md` with the entry template
3. Surface the question to the user before proceeding
4. Wait for direction before implementing

The spec may need updating. The user makes that call. Silent improvisation
is the failure mode to avoid.

### Maintain the test backlog

When you encounter something that should have a test but is being deferred
(per the pragmatic Rev 1 testing approach), add it to `TESTS_BACKLOG.md`
with a brief description. Don't lose these.

---

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Framework:** Next.js 14+ with App Router
- **Database:** PostgreSQL (hosted on Neon for production, Docker for local dev)
- **ORM:** Prisma
- **API:** REST via Next.js API Routes, Zod for validation
- **Frontend:** React 18+, Tailwind CSS, shadcn/ui components
- **Testing:** Vitest for unit and integration tests
- **Deployment:** Vercel for app, Neon for database

### Why these choices

- TypeScript: the schema has many enums and complex state transitions;
  type safety is load-bearing
- Next.js + REST: REST API is a deliberate choice over tRPC because the API
  is part of the project's product/portfolio value (future integrations,
  AI tool use, B2B integrations)
- Prisma: schema-first ORM that generates TypeScript types automatically
- shadcn/ui: copy-pasteable Tailwind components, no opinionated design system
  to fight against — Tirion's grids and views need custom layouts

Don't add new top-level dependencies without checking with the user.

---

## File Organization

Standard Next.js App Router conventions:

```
/app                  # Routes (page.tsx, layout.tsx, route.ts)
  /api                # API endpoints
    /[resource]
      /route.ts       # REST endpoint handlers
  /(views)            # Application views (Project Creation, Stock Fulfillment, etc.)
/components           # Shared React components
  /ui                 # shadcn/ui primitives
  /[feature]          # Feature-specific components
/lib                  # Business logic, utilities, types
  /db                 # Prisma client and helpers
  /actions            # Server actions and shared business logic
  /schemas            # Zod schemas for validation
  /types              # Shared TypeScript types
/prisma
  /schema.prisma      # The Prisma schema
  /migrations         # Migration history
/spec                 # The locked Rev 1 spec corpus (read-only)
/tests                # Vitest tests
```

### Where business logic lives

**Business logic lives in `/lib`, not in route handlers.** Route handlers
should be thin — validate input, call business logic, format response.

The state machine logic (WO state transitions, step state derivation,
cascade behavior, etc.) is the heart of the system and belongs in
testable functions in `/lib`.

### Where API endpoints live

REST endpoints in `/app/api/[resource]/route.ts` (or nested for
sub-resources). Each endpoint:

1. Validates the request with Zod
2. Authenticates/authorizes
3. Calls business logic from `/lib`
4. Returns appropriate status code and response body

Don't put business logic in route handlers. Don't make raw Prisma calls
in route handlers — they go through `/lib`.

---

## Conventions

### Naming

- **Files:** kebab-case (`work-order.ts`, `stock-fulfillment-view.tsx`)
- **TypeScript variables/functions:** camelCase
- **TypeScript types/interfaces/enums:** PascalCase
- **React components:** PascalCase (file and component name match)
- **Database tables/columns:** snake_case (Prisma default; configured via `@@map`)
- **Prisma models:** PascalCase (Prisma default)

### TypeScript

- Strict mode enabled
- No unjustified `any`. If you need `any`, comment why
- Exhaustive enum handling — use the `never` check pattern in switches
- Prefer `type` over `interface` unless you need declaration merging
- Re-export shared types from `/lib/types`

### Comments

- **Sparse on simple code, JSDoc on complex business logic**
- Comments should explain *why*, not *what*
- Reference spec sections when implementing tricky business logic:
  `// See spec/project_creation_view_spec.md PC-10 for the from-stock prompt rule`

### Commits

Conventional Commits format:

- `feat: add Stock Fulfillment release endpoint`
- `fix: cascade reverse should set Open + Purchase Waiting`
- `chore: update Prisma client`
- `refactor: extract WO state machine into /lib/state-machines`
- `test: add cascade reverse integration tests`
- `docs: update DEVIATIONS.md with batching gate finding`

Keep commits small and focused. Each commit should be reviewable in under
a minute.

### Imports

- Use absolute imports from `/` (configured via `tsconfig.json` paths)
- Group imports: external libs, then internal modules, then types
- No barrel files except where Prisma generates them

---

## API Conventions

The API is part of Tirion's product value — it's designed to support a
future headless Rev 2 where external clients (mobile apps, integrations,
AI agents) consume it directly. These conventions enforce consistency
across all endpoints.

### Endpoint Naming: Action-Oriented

Use action-oriented endpoint names that describe what the endpoint does, not
just what resource it touches.

**Correct:**
- `POST /api/v1/work-orders/{id}/cancel`
- `POST /api/v1/work-orders/{id}/split`
- `POST /api/v1/supply-orders/{id}/lines/{lineId}/mark-fulfilled`
- `POST /api/v1/supply-orders/{id}/lines/{lineId}/set-exception`

**Incorrect (resource-oriented):**
- `PATCH /api/v1/work-orders/{id}` with `{ "status": "Cancelled" }`
- `PATCH /api/v1/supply-order-lines/{id}` with `{ "isFulfilled": true }`

Action-oriented endpoints make the API surface read like the operations
the system performs, mirror how the spec corpus describes those operations,
and produce intuitive endpoints for future integrators ("how do I cancel
a WO? POST to /cancel"). Standard REST CRUD applies for simple resource
reads (`GET /api/v1/work-orders/{id}`) and creates (`POST /api/v1/work-orders`)
where there's no business operation involved.

### Versioning: URL-Based, Starting at v1

All endpoints live under `/api/v1/`. Even though Rev 1 ships with a single
frontend (no external consumers), establishing the version prefix from day
one makes future Rev 2 expansion trivial. Never use `/api/` without a
version prefix.

When breaking changes become necessary in the future, introduce `/api/v2/`
and run both in parallel during transition. Never break an existing
versioned endpoint.

### Response Shape: Bare Object for Success, Envelope for Errors

Successful responses return the requested data as a bare object:

```json
{
  "workOrderId": 123,
  "status": "Open",
  "quantity": 10
}
```

For collection endpoints, wrap in `{ data: [...] }` to allow future addition
of pagination metadata without breaking changes:

```json
{
  "data": [{...}, {...}, {...}],
  "pagination": {
    "cursor": "eyJ...",
    "hasMore": true
  }
}
```

Error responses always use a standardized envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "New WO Demand must be greater than 0",
    "details": {
      "field": "newWoDemand",
      "constraint": "WS-1"
    }
  }
}
```

The `code` is a stable machine-readable identifier; the `message` is a
human-readable description; `details` carries structured context (validation
field names, hard-rule references, etc.).

### Field Casing: camelCase Throughout

API responses use camelCase field names (matches TypeScript convention).
The Prisma layer's snake_case database columns are mapped to camelCase
in the application layer; API responses never expose snake_case.

### HTTP Status Codes

- `200 OK` — successful GET, successful POST that returns data
- `201 Created` — POST that creates a resource (return the created resource)
- `204 No Content` — successful POST/PATCH/DELETE with no return body
- `400 Bad Request` — validation errors (with error envelope)
- `401 Unauthorized` — auth failure (Rev 2; not used in Rev 1's manual user model)
- `403 Forbidden` — permission denied
- `404 Not Found` — resource doesn't exist
- `409 Conflict` — operation conflicts with current state (e.g., trying to Cancel a non-leaf WO)
- `500 Internal Server Error` — unexpected failure (logged; user sees generic message)

### Pagination: Cursor-Based

For collection endpoints, use cursor-based pagination rather than offset-based.
Cursors handle insertions during pagination correctly; offsets create
duplicate-or-skip issues when the underlying data changes mid-pagination.

```
GET /api/v1/work-orders?cursor=eyJ...&limit=50
```

Rev 1 may not need pagination for most endpoints (small data volumes), but
when added, use cursors.

### Validation: Zod Schemas

Every endpoint validates its input with a Zod schema. The Zod schema lives
alongside the route handler in `/app/api/.../route.ts` or in a co-located
`schema.ts` for reuse. Validation failures return `400 Bad Request` with
the error envelope structured by Zod's error output.

### Authentication and Authorization

Rev 1 uses the manual user selection model — no actual authentication.
Endpoints accept a user identity in a header (`X-User-Id` or similar) and
trust it. This is the Rev 1 simplification per `configuration_management_spec.md`.

When Rev 2 adds authentication, the authorization layer (role checks,
permission enforcement) wraps endpoint handlers without requiring endpoint
rewrites — the authorization concern is separated from the operation concern.

---

## Repository Conventions

### Branch Strategy

Solo development uses a simplified flow:

- `main` is the long-lived branch; always deployable
- Feature work happens on short-lived feature branches: `feat/stock-fulfillment-release`, `fix/batch-cascade-bug`
- Merge feature branches via squash-merge to keep `main` history clean
- Branch names use kebab-case after the type prefix

For multi-step features, use feature branches even though you're working
solo — it gives you a clean rollback point and a single commit on `main`
once merged.

### README.md

The repo's `README.md` should contain:

- One-paragraph description of Tirion and its purpose
- Tech stack summary
- Local development quick-start (link to detailed instructions in CLAUDE.md)
- Spec corpus location and brief explanation
- License notice
- Status (Rev 1 in development, etc.)

Keep it short — detailed conventions live in CLAUDE.md.

### .gitignore

At minimum:

- `node_modules/`
- `.next/`
- `.env`, `.env.local`, `.env.*.local` (but commit `.env.example`)
- `.claude/settings.local.json` (local hook overrides)
- Build artifacts, logs, OS-specific files

Prisma-generated files (`prisma/migrations/`) ARE committed.

### .env.example

Always maintain a `.env.example` file showing all environment variables the
project expects, with placeholder values. Never commit real `.env` files.

### Pull Request / Commit Review

Solo developer reviewing own + Claude Code's commits:
- Review every commit for adherence to this file's principles
- Self-review before merging — pretend you're a senior engineer reviewing
  a junior engineer's PR
- The self-review hook (per Hooks section) provides automated assistance
  but doesn't replace your own review

---

## Patterns to Follow

### State transitions

All state transitions on Work Orders, Steps, Batches, Projects, and Blockers
follow this pattern:

1. Validation (can this transition happen from current state?)
2. Side effects (cascades, derived state updates)
3. Database write inside a transaction
4. AuditLog write in the same transaction
5. Return updated state

State machines belong in `/lib/state-machines`. They're pure functions of
(currentState, transition, context) → newState. They don't directly touch
the database; the calling code wraps them in transactions.

### AuditLog writes

Every state-changing action writes to AuditLog in the same transaction.
Never write to AuditLog separately — it must be transactional.

The action type comes from the AuditAction lookup table (see schema). To
add a new action type, INSERT a row in AuditAction first.

### Transactions

Use Prisma's `$transaction` for any multi-write operation. The compilation
of a Project, the cascade on Stock Fulfillment, the Release event — all
of these are single transactions.

If a transaction would write more than ~50 rows, consider whether batching
or chunking is appropriate. The user has a reasonable shop dataset; large
projects might generate hundreds of WOs.

### Validation

All API endpoints use Zod schemas for input validation. Schemas live in
`/lib/schemas` and are reused in:
- API endpoint validation
- Form validation on the frontend (via react-hook-form + Zod resolver)
- Type derivation for TypeScript

### Error handling

API errors return appropriate HTTP status codes:
- 400 for validation errors (with Zod error details in the response)
- 401 for unauthorized
- 403 for forbidden (permission denied)
- 404 for not found
- 409 for state conflicts (e.g., trying to release an already-released WO)
- 422 for semantic validation failures (request well-formed but business rule violated)
- 500 for unexpected errors

Use a shared error response shape:
```typescript
{ error: { code: string, message: string, details?: unknown } }
```

### Database queries

Use Prisma's typed queries. Don't drop into raw SQL except where Prisma
genuinely can't express the query (rare).

For complex queries (cumulative demand calculations, derived states),
extract into named functions in `/lib/queries` so they're testable and reusable.

---

## What Not To Do

- Don't add libraries without checking with the user
- Don't change database schema without a Prisma migration
- Don't bypass the AuditLog requirement for state changes
- Don't put business logic in route handlers or React components
- Don't use the `any` type without justification
- Don't add tests for trivial CRUD or UI components (per Rev 1 testing approach)
- Don't add E2E tests in Rev 1 (deferred to Rev 2)
- Don't silently deviate from the spec — flag and ask
- Don't refactor large parts of the codebase without explicit user direction
- Don't optimize prematurely — get it working first
- Don't write defensive code for impossible cases

---

## What To Do

- Read specs before implementing features
- Ask clarifying questions when the spec is ambiguous
- Write tests for business logic and transactions
- Add to TESTS_BACKLOG.md when deferring tests
- Add to DEVIATIONS.md when discoveries diverge from spec
- Update the spec (with user approval) when DEVIATIONS warrant it
- Use Conventional Commits with descriptive messages
- Cross-reference spec sections in code comments for non-obvious business logic
- Bias toward small, focused commits

---

## Hooks and Project Maintenance

This project uses a Claude Code hook system to automate project maintenance.
Hooks fire deterministically on every commit — they are not subject to
your judgment about whether they should run.

The hook system is configured as a single `PostToolUse` entry on the `Bash`
matcher in `.claude/settings.json`. That entry invokes `.claude/hooks/dispatch.sh`,
which routes to the four maintenance scripts when the bash command was a
`git commit`. All other bash commands pass through unaffected.

**Why a single dispatcher rather than four separate hook entries:** an earlier
configuration registered four separate `PostToolUse` entries, each reading the
hook payload from stdin. Multiple hook entries each calling `cat` on stdin
consume the payload sequentially, so only the first hook receives the actual
data; the rest see empty input and never run their sub-scripts. The dispatcher
pattern reads stdin once and routes internally, which avoids the stdin
starvation issue. If you ever need to add a fifth hook, add it as another
function inside `dispatch.sh`, not as a separate `PostToolUse` entry.

**The four maintenance scripts, all in `.claude/hooks/`:**

1. **`update_manifest.sh`** — regenerates `project_manifest.md` after every
   commit. The manifest is a map of every meaningful file, function, API
   endpoint, and database query in the project. Use it to find code instead
   of scanning the whole repository. Do not edit the manifest manually; the
   hook overwrites it on the next commit.

2. **`update_tracker.sh`** — regenerates `project_tracker.md` after every
   commit. Shows what's been built versus what's still in spec. Reference
   this to understand build progress and identify what to work on next.

3. **`update_deviations.sh`** — appends a structured entry to `DEVIATIONS.md`
   when the commit message contains both of the following footer tags:
   - `Deviates-From: <spec reference>` (e.g., `Deviates-From: spec/schema.md`)
   - `Deviation-Summary: <short description>`
   Both tags are required, case-sensitive, and must be at the start of their
   respective lines. If either is absent, the hook does nothing. When a commit
   deliberately deviates from the spec, include both tags in the commit message
   footer so the deviation is logged automatically. The phase is auto-detected
   from `project_tracker.md`.

4. **`run_review.sh`** — spawns a Claude Code sub-agent to review the
   just-committed changes for spec compliance, code quality, and adherence
   to this file's principles. The review surfaces in-session output. Note:
   there is a known issue where the sub-agent's write to
   `.claude/reviews/log.md` is sandbox-blocked, so reviews do not persist
   across sessions. The verdicts are still visible in the session where the
   commit was made; the persistence gap is logged in `TESTS_BACKLOG.md` for
   future investigation.

**The commit-routing rule:**

All commits during Rev 1 development must go through Claude Code's commit
workflow. Direct terminal commits via `git commit` bypass `PostToolUse`
hooks entirely — none of the four maintenance scripts will fire. The rule
is documented in detail in `docs/adr/ADR-012-commits-via-claude-code.md`,
including the recovery procedure if a direct commit is unavoidable
(manual run of `update_manifest.sh` and `update_tracker.sh`, with a note
in the commit message that automated hooks did not fire).

**Disabling a hook locally:**

If a hook is producing problems during a specific phase of work, it can be
temporarily disabled via `.claude/settings.local.json` (your personal
override, not committed). Do not modify `.claude/settings.json` to disable
hooks — that affects the project for everyone and breaks the discipline
the hook system establishes.

If you (Claude Code) need to make a project-level change that conflicts
with how the hooks operate, raise it explicitly with the developer rather
than working around the hook.

---

## Local Development

### Setup

```bash
# Install dependencies
npm install

# Set up local database (Docker)
docker compose up -d postgres

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed the database (if seed script exists)
npx prisma db seed

# Start the dev server
npm run dev
```

### Environment variables

- `DATABASE_URL` — PostgreSQL connection string (Neon for prod, local Docker for dev)
- See `.env.example` for required variables

### Running tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Spec Reference Map

When working on a feature, here's where to find the spec:

| Feature | Primary spec |
|---------|--------------|
| Parts management | `spec/parts_master_spec.md` |
| Routing templates | `spec/routing_template_editor_spec.md` |
| BOM editing | `spec/bom_editor_spec.md` |
| Project creation, drafts, metadata | `spec/project_creation_view_spec.md` |
| Stock fulfillment | `spec/stock_fulfillment_view_spec.md` |
| Batching | `spec/batching_lens_spec.md` |
| Project view (BOM-organized management) | `spec/project_view_spec.md` |
| Operations view | `spec/operations_lens_spec.md` |
| Machining lens | `spec/machining_lens_spec.md` |
| Assembly lens | `spec/assembly_lens_spec.md` |
| Distribution lens | `spec/distribution_lens_spec.md` |
| Purchasing lens | `spec/purchasing_lens_spec.md` |
| Receiving lens | `spec/receiving_lens_spec.md` |
| Blocker workflows | `spec/blocker_spec.md` |
| Foundational rules | `spec/system_intent_and_rules.md` |
| Domain vocabulary | `spec/terminology_lock.md` |
| State transitions | `spec/state_model.md` |
| Database schema | `spec/schema.md` |
| Open questions tracker | `spec/open-questions.md` |

---

## Build Phase Awareness

This codebase is being built in phases per `BUILD_ROADMAP.md`. Don't build
features ahead of their phase unless explicitly directed. Earlier phases
establish patterns that later phases follow.

If you're in Phase N, you should generally only be touching files relevant
to Phase N or earlier. If you find yourself needing to modify Phase N+1
code, ask first.
