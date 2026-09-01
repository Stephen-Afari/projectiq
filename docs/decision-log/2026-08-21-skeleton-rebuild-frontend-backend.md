# 2026-08-21 — Skeleton Rebuilt as frontend/ + backend/

## Decision
Replaced the previously scaffolded `apps/web` + `apps/api` +
`packages/shared-types` + `packages/config` monorepo layout with a simpler
`frontend/` + `backend/` structure (no shared-types workspace package).
Root `package.json` now defines `workspaces: ["frontend", "backend"]`.
Shared ESLint/Prettier/tsconfig live at the repo root instead of in a
`packages/config` workspace. `CLAUDE.md` and `docs/architecture.md` were
updated to reference the new folder names.

## Why
An explicit instruction described the skeleton using `frontend/` and
`backend/` names with no shared-types layer, and asked for the folder to be
treated as freshly scaffolded. Since nothing had been committed yet, this
was a safe, low-cost rename/simplify rather than a migration — it removes a
workspace package (`packages/shared-types`) that had no real consumers yet,
in line with the "no speculative abstraction" coding convention: add a
shared-types package when real type duplication between frontend and backend
actually causes pain, not ahead of need.

## Alternatives Considered / Rejected
- **Keep `apps/web`/`apps/api` as-is** — rejected; doesn't match the explicit
  `frontend/`/`backend/` naming requested.
- **Rename in place but keep `packages/shared-types`** — rejected for the
  skeleton stage; no code exists yet to share, so the package would be empty
  scaffolding with no current purpose.

## What It Affects
- `CLAUDE.md`: Architecture, Tech Stack, and Coding Conventions sections
  updated to reference `frontend/`/`backend/` and drop the shared-types
  package reference.
- `docs/architecture.md`: updated in place.
- No product code, database schema, or AI agent logic existed yet, so this
  change has zero functional impact — it only affects folder names and
  where shared tooling config lives.
