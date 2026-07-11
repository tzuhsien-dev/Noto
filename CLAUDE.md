# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server (real Supabase from .env)
VITE_E2E=1 npm run dev   # dev server on the in-memory fake backend (no Supabase needed)
npm run typecheck        # tsc -b (TypeScript strict)
npm run lint             # oxlint + prettier --check
npm run format           # prettier --write
npm test                 # Vitest unit + component tests
npx vitest run src/sync/engine.test.ts        # single unit test file
npm run test:e2e         # Playwright (boots its own dev server on port 5177)
npx playwright test e2e/tasks.spec.ts --project=desktop   # single E2E spec
npm run build            # tsc -b && vite build
```

Local Supabase stack (Docker required):

```bash
npx supabase start       # applies migrations + seed (demo login below)
npx supabase status      # local API URL + anon key for .env
npx supabase test db     # pgTAP RLS suite (supabase/tests/rls.test.sql)
```

Demo login (fake backend and local Supabase seed): `demo@noto.local` / `noto-demo-password`.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit, E2E, build, and greps `dist/` for privileged credential material (`service_role`, `sb_secret_`) — the build fails if any is found.

## Architecture

Local-first Note+Todo PWA. **Dexie (IndexedDB) is the UI's source of truth**; Supabase is authoritative and reached only through the sync engine:

```
React UI ──reads (dexie-react-hooks)──▶ Dexie
   │                                      ▲    │ pending_mutations queue
   └─writes──▶ src/db/repo/* ─────────────┘    ▼
                                    SyncEngine ◀──Realtime/pull── Supabase
```

- `src/domain/` — pure types and logic (dates, filters, search, zod schemas). No I/O.
- `src/db/` — Dexie schema (`database.ts`), the pending-mutation queue (`queue.ts`), and repositories (`repo/`). Repositories write Dexie and enqueue a mutation in the same transaction. **The db layer must not import the sync layer** — the engine registers a callback via `setOnMutationEnqueued` to keep the dependency one-directional.
- `src/sync/engine.ts` — `SyncEngine`, a module singleton (one per signed-in session, torn down on sign-out). Owns initial/incremental pulls, pushing the queue, the Realtime subscription, and foreground/online refresh.
- `src/lib/backend/` — the `BackendClient` seam. `resolveBackendConfig()` picks: `FakeBackend` when `VITE_E2E=1`, Supabase (lazy-imported) when env vars are set, otherwise a config-error screen. In fake mode the backend is exposed as `window.__notoFakeBackend` so Playwright can drive server-side state.
- `src/features/<area>/` — UI per feature (tasks, notes, tags, search, auth, settings, data). `src/pages/` are the routed views, `src/components/ui/` shared primitives (Radix-based).
- `@/` aliases `src/`.

### Sync invariants (ADR-002/003 — read before touching sync)

- The queue keeps **one entry per entity**, coalesced: insert+delete cancels; update+update keeps the **original** `baseVersion` (conflict detection compares against the server state the first local edit was based on).
- Every row has a server-trigger-incremented `version`; clients never set it. Push guards with `.eq('version', baseVersion)`; zero rows affected ⇒ conflict.
- On conflict: remote wins in Dexie; tasks/notes get their unsynced local content re-created as a "(conflict copy)" entity; projects/tags/checklist items/joins are plain LWW.
- Deletes are soft and idempotent.

### Other structural decisions

- Architecture decisions live in `docs/decisions/ADR-001..004` — **deviations should update the ADRs**. Product behavior spec: `SPEC.md`; threat model: `SECURITY.md`.
- `HashRouter`, not BrowserRouter — refresh-safe on GitHub Pages (ADR-004). CI sets `VITE_BASE_PATH=/Noto/`.
- The service worker must **never cache Supabase traffic** (`NetworkOnly` in `vite.config.ts`) — private data lives only in IndexedDB. PWA updates use `registerType: 'prompt'`, never forced reloads.
- Dexie indexes only sortable/joinable fields; booleans are not valid IndexedDB keys — flag filtering happens in memory.
- Security boundary is Supabase Auth + RLS. The publishable key is public by design; service_role/database credentials must never enter the repo or bundle. New Supabase projects grant no DML to `anon`/`authenticated` by default — migrations must grant explicitly (see `supabase/migrations/`).

## Testing setup

- Vitest runs in jsdom with `fake-indexeddb` and `VITE_E2E=1` baked in via `vite.config.ts`, so unit/component tests always use the fake backend. jsdom 29 lacks localStorage, matchMedia, and pointer-capture — polyfilled in `src/test/setup.ts`.
- Playwright runs single-worker against the fake backend; `mobile.spec.ts` runs only in the `mobile` project (Pixel 7), everything else in `desktop`.
- RLS policies are tested with pgTAP against the local Supabase stack (not run in CI).
