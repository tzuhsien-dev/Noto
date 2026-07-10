# ADR-003: Conflict resolution — version-guarded LWW with conflict copies

## Status

Accepted (2026-07-10)

## Context

Two devices can edit the same row while one is offline. The spec requires a
comprehensible, testable strategy: last-write-wins normally, but a detected
concurrent edit must not silently destroy either side.

## Decision

- Every row has a `version bigint` incremented by a server trigger on each
  UPDATE (alongside `updated_at`). Clients never set `version`.
- A pending update/delete records the `baseVersion` the local edit was made
  against.
- Push executes `update … .eq('id', id).eq('version', baseVersion)` and
  requests the row back. Zero rows affected ⇒ conflict.
- On conflict: fetch the remote row, write it to Dexie as canonical, and —
  for tasks and notes — re-create the unsynced local content as a new
  entity titled “<title> (conflict copy)”, then drop the pending mutation.
- Checklist items, projects, tags, and join rows resolve as plain LWW (no
  copies): they are low-value and trivially re-created, and copies would
  create clutter (e.g. duplicate tag names violate the unique constraint).
- Deletes are soft and idempotent; a delete losing to a concurrent edit
  leaves the remote edit intact (delete conflict ⇒ remote wins, no copy —
  the user can delete again).

## Alternatives rejected

- Pure LWW everywhere: silent data loss on real concurrent edits.
- Field-level merge / CRDTs: complexity far beyond v1's needs; Markdown
  merging is unreliable without operational transforms.
- Interactive conflict dialog: more UI surface and still needs a fallback
  when the user isn't present; copies are inspectable any time.

## Consequences

- Worst case the user sees a “(conflict copy)” task/note and merges by
  hand; nothing disappears.
- The strategy is pure-function testable (given base/remote/local →
  expected outcome) and is covered in unit tests.
