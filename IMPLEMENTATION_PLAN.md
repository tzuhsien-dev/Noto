# Noto — Implementation Plan

Work proceeds in phases; each phase ends with its verification commands
green (`npm run typecheck && npm run lint && npm run test`, plus
phase-specific checks). Details of every decision live in SPEC.md and
`docs/decisions/`.

## Phase 0 — Repository inspection ✅

Empty repository; no prior conventions to preserve. Node 26 / npm /
Docker / Supabase CLI available locally.

## Phase 1 — Scaffold, tooling, planning ✅ (this phase)

Vite + React + TS (strict, `noUncheckedIndexedAccess`), Tailwind v4,
oxlint + Prettier, Vitest + Testing Library + fake-indexeddb, Playwright,
`@/*` alias, scripts (`dev/build/typecheck/lint/format/test/test:e2e/preview`),
`.env.example`, SPEC.md, SECURITY.md, ADRs 001–004.

## Phase 2 — Local-first UI (no network)

1. Domain layer: entity types + Zod schemas, date helpers (`isToday`,
   `isOverdue`, upcoming grouping), filters, search scoring. Unit tests.
2. Dexie schema v1: `tasks, notes, checklist_items, projects, tags,
task_tags, note_tags, pending_mutations, sync_meta` + repository
   functions (CRUD, soft delete, tag association, undo). Unit tests on
   fake-indexeddb.
3. UI primitives (`components/ui`): button, input, textarea, checkbox,
   dialog, alert-dialog, dropdown-menu, select, popover, badge, skeleton,
   toaster (sonner).
4. App shell: HashRouter, responsive layout (sidebar ≥ md, bottom nav +
   drawer < md, iOS safe-area), theme provider (System/Light/Dark), error
   boundary, keyboard shortcuts, command palette deferred unless cheap.
5. Views: Inbox, Today, Upcoming (7/30-day), All, Completed, Notes, Pinned,
   Archive, Projects, Tags, Trash, Settings (local parts), Search overlay.
6. Features: task quick-add/edit/complete/delete/undo/batch, note editor
   with Markdown preview + debounced autosave, checklists, projects, tags.
7. Component tests for the required list (login form arrives in Phase 3).

Exit criteria: fully usable local-only app; clear configuration-error
screen when Supabase env vars are missing.

## Phase 3 — Supabase backend

1. Migrations `0001_init.sql` (enum, tables, triggers, indexes, realtime
   publication) and `0002_rls.sql` (enable RLS + 4 policies per table);
   `seed.sql` with fictional demo data.
2. pgTAP RLS tests (`supabase/tests/rls.test.sql`) run via
   `supabase start && supabase test db`.
3. `BackendClient` interface + Supabase implementation (publishable key
   only) + in-memory fake for tests/E2E.
4. Auth: login page (RHF + Zod, show/hide password, offline + invalid
   credential errors), forgot/reset password, session restore, sign-out
   cleanup (Dexie wipe + subscription teardown), expired-session redirect.
5. Row ↔ domain mapping (snake_case ↔ camelCase) with unit tests.

## Phase 4 — Sync engine

1. Pending mutation queue (model from SPEC §4) with backoff + sanitized
   errors.
2. Pull: per-table `updated_at` cursor, pagination, pending-aware merge.
3. Push: upsert inserts, version-guarded updates, conflict-copy flow.
4. Realtime channel per user; foreground refresh listeners
   (`visibilitychange`/`online`/`focus`); single-instance engine.
5. Sync status store + UI (Offline / Changes pending / Syncing / Synced /
   Sync error) and Settings integration (last sync, pending count, retry).
6. Unit tests: queue, retry, conflict detection, merge rules, first-login
   no-clobber.

## Phase 5 — PWA

vite-plugin-pwa (`registerType: 'prompt'`), manifest (name, short_name,
theme/background color, standalone, 192/512/maskable icons), iOS meta +
apple-touch-icon, Workbox precache + `navigateFallback`, **NetworkOnly for
`*.supabase.co`**, update toast with reload button, SW only in production
builds.

## Phase 6 — Settings, export/import, notices

Export JSON (`schemaVersion`) + Markdown; import with Zod validation,
preview summary, merge semantics, pre-import Dexie snapshot; clear local
cache with confirmation + re-pull; app version/about; privacy + company
data notice. Unit tests for export format and import validation.

## Phase 7 — E2E, CI/CD, docs, verification

1. Playwright specs (fake backend via `VITE_E2E=1`): login, create task,
   complete task, create note, search, delete+undo, logout, session
   restore, mobile viewport, offline UI, pending retry, reload persistence.
2. `.github/workflows/ci.yml` (PRs: typecheck, lint, unit, e2e, build,
   secret-scan) and `deploy.yml` (main: verify → build with
   `VITE_BASE_PATH=/Noto/` + repo variables → deploy to Pages).
3. README.md + DEPLOYMENT.md (zero-to-deployed runbook, sign-up lockdown,
   RLS verification).
4. Final: all verification commands green; manual offline walkthrough.
