# ADR-003: REST API Style over tRPC or GraphQL

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

Tirion's backend needs an API layer to sit between the React frontend and the
database. Three credible options exist in the Next.js ecosystem: REST via API
Routes, tRPC, and GraphQL. The choice affects how the frontend calls the
backend, how the API is versioned, and — importantly for this project — what
learning and portfolio value the build produces.

The spec corpus describes a "headless-shaped architecture" where Rev 2 may
expose the API to external clients (mobile apps, B2B integrations, AI agents)
without rebuilding the backend. The Rev 1 API surface should be usable by
non-JavaScript clients from day one, even if no such clients exist yet.

## Decision

REST via Next.js API Routes, versioned under `/api/v1/`. Endpoints follow
action-oriented naming for operations (e.g., `POST /api/v1/work-orders/{id}/cancel`)
and standard resource CRUD for simple reads and creates. All endpoints validate
input with Zod schemas. Response shapes follow a consistent convention: bare
object for single resources, `{ data: [...] }` for collections, and a standard
error envelope for failures.

## Consequences

**Positive:**

- REST is the most widely understood API style. External clients, integration
  partners, and AI agents can consume the API with no special tooling.
- Building REST endpoints by hand is a deliberate learning goal for this build.
  The API conventions documented in CLAUDE.md (versioning, action-oriented
  naming, response shapes, status codes) are the artifact of that learning.
- Endpoints are independently testable with standard HTTP tools (curl, Postman,
  integration test HTTP clients). No client library required.
- URL-based versioning (`/api/v1/`) makes the contract explicit and allows
  future `/api/v2/` to coexist without breaking Rev 1 consumers.

**Negative:**

- More boilerplate than tRPC: each endpoint requires a route file, a Zod
  schema, explicit input validation, and explicit response shaping. tRPC would
  handle all of this with a shared type definition.
- Type safety between frontend and backend is not automatic. Types must be
  manually exported from API definitions or inferred from Zod schemas and shared
  via `/lib/types`. This is a discipline cost, not a technical blocker.
- No automatic query optimization or field selection (as GraphQL provides).
  Over-fetching is possible for complex resource shapes.

## Alternatives considered

- **tRPC:** Type-safe end-to-end with almost no boilerplate. The right choice if
  the API is purely internal to a single frontend. Rejected because it makes the
  API surface invisible — there are no explicit URLs, versioning is not
  idiomatic, and non-JavaScript clients cannot easily consume it.
- **GraphQL:** Maximum flexibility for complex querying needs and multiple
  clients. Significant schema definition and resolver overhead that isn't
  justified by Rev 1's data access patterns. The query language is also a
  learning investment that competes with REST as the explicit learning goal.
- **Next.js server actions:** Co-locate data mutations with components, minimal
  boilerplate. No explicit API surface at all — the opposite of the headless
  goal. Not viable for the Rev 2 external client scenario.
