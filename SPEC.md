# Noto — Specification

Noto is a personal, cross-platform Note + Todo web app. It runs as a static
SPA/PWA on GitHub Pages, uses Supabase (Auth, PostgreSQL, Realtime) as the
authoritative backend, and keeps a local IndexedDB cache for offline use and
instant startup. It is designed for a single user but enforces full
multi-user data isolation via Row Level Security.

## 1. Functional requirements

### Authentication

- Email + password sign-in (Supabase Auth). No OAuth providers in v1.
- Session persists across restarts (localStorage) and auto-refreshes.
- Sign out clears all local state (IndexedDB cache, pending queue, session).
- Expired/invalid sessions route back to the login page without data loss of
  the pending queue until sign-out is explicit.
- Forgot-password email flow with an in-app reset-password page.
- Sign-up UI is hidden by default (`VITE_ENABLE_SIGNUP` shows it during
  initial setup). Public sign-up is actually disabled in the Supabase
  Dashboard — the UI flag is convenience, not security.

### Tasks

Fields: `id, userId, title, description, completed, priority (none|low|medium|high), dueAt, startAt, projectId, createdAt, updatedAt, completedAt, deletedAt, version`.

- Quick add (title only), full edit, complete/uncomplete, soft delete with
  undo toast, restore from Trash, permanent delete.
- Due date, priority, description, project assignment, multiple tags.
- Batch complete and batch delete via multi-select.
- Drag-to-reorder is **out of scope for v1** (phase-2 candidate).

### Notes

Fields: `id, userId, title, content (Markdown), pinned, archived, createdAt, updatedAt, deletedAt, version`.

- Create/edit with edit ⇄ preview toggle (GitHub-flavored Markdown, rendered
  as React elements — no raw HTML, no `dangerouslySetInnerHTML`).
- Debounced auto-save (~800 ms after last keystroke) to the local store; the
  sync queue batches uploads. Last-updated time is displayed.
- Pin, archive, soft delete, restore, tags.

### Checklists

Separate `checklist_items` rows attached to a Note
(`id, noteId, userId, content, completed, position, createdAt, updatedAt`).
A note shows its checklist below the Markdown content. Items can be added,
edited, toggled, reordered by position, and deleted (hard delete — items are
small and belong to their note; the note itself soft-deletes).

### Projects

Fields: `id, userId, name, icon, position, archived, createdAt, updatedAt`.
Create, rename, archive. Sidebar shows the count of open (not completed, not
deleted) tasks per project. Icon is one of a small fixed set of Lucide icon
names — no arbitrary user CSS/colors. Deleting a project is not supported in
v1 (archive instead); tasks keep `projectId` via `on delete set null` if a
project is ever removed server-side.

### Tags

Normalized tables: `tags`, `task_tags`, `note_tags`. Create, rename, delete.
Deleting a tag removes only the associations, never the tasks/notes. Filter
any list by tag. Tag names are unique per user (case-insensitive).

### Views

Inbox (tasks with no project), Today (due today + overdue incomplete),
Upcoming (grouped by day, 7-day default with a 30-day toggle), All Tasks,
Completed, Notes, Pinned Notes, Archive (archived notes + archived
projects), Projects, Tags, Trash (soft-deleted tasks + notes with restore /
permanent delete / empty trash + confirmation), Settings.

### Search

Client-side over the local Dexie cache: task title/description, note
title/content, project names, tag names. Debounced-as-you-type, with filters
for type (task/note), project, tag, and completed state. PostgreSQL
full-text search is a **non-goal for v1** (the whole dataset is already
synced locally; FTS adds migrations and complexity without benefit at this
scale).

### Settings

Theme (System/Light/Dark), account email, sign out, sync status, last
successful sync time, pending change count, retry sync, export (JSON with
`schemaVersion`, and Markdown), import (validated, previewed, merge-based,
snapshot-first), clear local cache (confirmation → wipe Dexie → re-pull;
never touches cloud data), app version, about, privacy/company-data notice.

## 2. Non-functional requirements

- TypeScript strict; no unexplained `any`.
- Works on macOS/Windows desktop browsers and iOS/Android mobile browsers;
  installable PWA on all four.
- First paint from local cache without waiting for the network.
- Dark mode, keyboard shortcuts (N / Shift+N / “/” / Escape), reduced-motion
  support, ARIA labels, focus indication.
- No analytics, no ad SDKs, no third-party CDN scripts, no Google Fonts.
- No user content, passwords, tokens, or raw Supabase responses in console
  logs or in persisted error messages.

## 3. Data model (PostgreSQL)

All tables: `id uuid PK` (client-generated `crypto.randomUUID()`),
`user_id uuid not null references auth.users(id) on delete cascade`,
`created_at/updated_at timestamptz not null default now()`, and for
soft-deletable entities `deleted_at timestamptz` and
`version bigint not null default 1`.

A `set_updated_at()` trigger sets `updated_at = now()` and increments
`version` on every UPDATE, making the server authoritative for both.

Timestamps are stored UTC (`timestamptz`), transported as ISO 8601 strings,
and rendered in the device's local timezone.

Indexes: `user_id` and `updated_at` everywhere; tasks additionally
`(user_id, completed) where deleted_at is null`, `due_at`, `project_id`;
join tables have composite primary keys plus `user_id` indexes.

## 4. Sync model

Supabase is the authoritative source; Dexie (IndexedDB) is the UI's local
source of truth and offline cache. All reads render from Dexie via
`useLiveQuery`. All writes go through one mutation layer:

1. Write to Dexie (optimistic).
2. Enqueue a `PendingMutation { id, entityType, entityId, operation, payload, baseVersion, createdAt, attempts, lastError }`.
3. Trigger the sync engine to push.

The sync engine (single module-level instance, created on login, destroyed
on logout):

- **Startup**: restore session → render from Dexie immediately → pull
  changed rows from Supabase (per table, `updated_at > lastSyncAt` cursor,
  paginated) → write to Dexie, skipping any entity with a pending local
  mutation → push the pending queue → subscribe to Realtime.
- **Foreground** (`visibilitychange`, `online`, `focus`): revalidate
  session, push queue, pull, without duplicating Realtime subscriptions.
- **Push**: inserts are upserts; updates/soft-deletes are version-guarded
  (`.eq('id', …).eq('version', baseVersion)`); failures keep the mutation
  pending with sanitized `lastError` and exponential backoff.
- **Realtime**: per-user postgres_changes subscription; an incoming change
  is applied to Dexie unless that entity has pending local mutations.
  Realtime is an accelerator — foreground pull is the reliability floor.

Sync status surfaced in the UI: `Offline`, `Changes pending`, `Syncing`,
`Synced`, `Sync error`.

## 5. Offline model

- The app shell (HTML/JS/CSS/icons) is precached by the service worker.
- Private data lives **only** in IndexedDB — never in Cache Storage; requests
  to Supabase are never cached by the SW (NetworkOnly).
- Offline reads come from Dexie; offline writes accumulate in the pending
  queue and flush on reconnect.
- A sync failure never clears local data.

## 6. Conflict strategy

Version-guarded last-write-wins with conflict copies:

- Every row carries a server-incremented `version`. A pending update stores
  the `baseVersion` it was made against.
- Push uses `update … eq(version, baseVersion)`. If zero rows match, the
  remote changed since we read it → **conflict**.
- On conflict: fetch the remote row, keep it as the canonical local copy,
  and preserve the unsynced local content as a new entity titled
  “… (conflict copy)” (tasks and notes). Nothing is silently discarded.
- Non-content races (e.g. toggling `completed` on two devices) resolve as
  last-write-wins by design.
- First login on a device pulls before pushing; an empty local cache never
  overwrites remote data.

**Limitations**: field-level merging is not attempted; simultaneous edits to
the same note produce a conflict copy the user merges by hand. Checklist
items and join-table rows use last-write-wins without copies (low-value,
easily re-created).

## 7. Security boundaries

- The only trust boundary is Supabase: Auth decides _who_, RLS decides
  _what_. The static frontend, being public, is untrusted.
- Frontend ships only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (safe to expose). service_role key,
  DB password, PATs: never in the repo, env files, or build output.
- Every user table has RLS enabled with per-operation policies checking
  `auth.uid() = user_id` (INSERT/UPDATE with `with check`).
- Public sign-up is disabled at the Supabase project level after the owner
  creates their account.
- See SECURITY.md for the threat model.

## 8. Non-goals (v1)

- Attachments, images, audio recording.
- OAuth providers, multi-factor auth.
- Sharing/collaboration between users.
- PostgreSQL full-text search.
- Drag-and-drop reordering of tasks.
- Field-level conflict merging / CRDTs.
- Recurring tasks, reminders, push notifications.
- Custom colors/themes beyond System/Light/Dark.
