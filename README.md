# Tirion

Tirion is a manufacturing production management tool for small-to-mid
manufacturers transitioning from spreadsheet-driven workflows to more
structured systems. It emphasizes high-context visibility, priority-driven
scheduling, and human decision-making over rigid automation.

This repository implements Tirion Rev 1: the first deployable cut of the
system, scoped to support a real machine shop's production workflow from
project intake through machining, assembly, and distribution.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Framework:** Next.js 16 with App Router and React 19
- **Database:** PostgreSQL hosted on Neon
- **ORM:** Prisma 7 with the `pg` driver adapter
- **API:** REST via Next.js API Routes, with Zod for request validation
- **Styling:** Tailwind CSS with shadcn/ui components
- **Testing:** Vitest, against an isolated Neon test branch
- **Logging:** Pino (structured JSON in production, pretty-printed in dev)
- **Error tracking:** Sentry
- **Hosting:** Vercel

## Project Structure

- `/app` — Next.js routes and API endpoints
- `/lib` — Business logic, database client, schemas, state machines
- `/components` — React components
- `/prisma` — Schema definition and migrations
- `/spec` — Locked specification corpus (the source of truth for what's
  being built)
- `/tests` — Vitest test suites

## Quick Start

Requires Node.js 20+ and access to a PostgreSQL database (Neon recommended).

```bash
# Install dependencies (also generates the Prisma client)
npm install

# Configure environment
cp .env.example .env
# Then fill in DATABASE_URL and Sentry values in .env

# Apply the schema to your database
npx prisma migrate dev

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`. The health
endpoint at `/api/v1/health` confirms the server is running and connected
to the database.

## Documentation

The `/spec` directory contains the locked specification corpus that
defines what Tirion is and how it behaves. Major reference documents:

- `spec/terminology_lock.md` — locked vocabulary and concepts
- `spec/state_model.md` — entity state machines
- `spec/schema.md` — database schema with rationale
- `CLAUDE.md` — repository conventions and Claude Code instructions
- `BUILD_ROADMAP.md` — phased build plan
- `DEVIATIONS.md` — recorded divergences from the spec/roadmap discovered
  during the build

## Project Status

Rev 1 is in active build. See `BUILD_ROADMAP.md` for current phase and
remaining work.

## License

MIT. See [LICENSE](LICENSE).

Built by [Tony Carter](https://github.com/Str0ngbad).