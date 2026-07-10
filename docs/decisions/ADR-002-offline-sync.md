# ADR-002: Offline & sync — Dexie as local source of truth with a pending queue

## Status

Accepted (2026-07-10)

## Context

The app must start instantly, work offline, and sync across devices, with
Supabase as the authoritative store. Options considered:

1. TanStack Query cache persisted to IndexedDB (persistQueryClient).
2. Dexie as the UI's local database + explicit sync engine.
3. Third-party sync frameworks (PowerSync, ElectricSQL, RxDB).

## Decision

Option 2. All reads render from Dexie via `dexie-react-hooks`'
`useLiveQuery`; all writes go through a single mutation layer that writes
Dexie, enqueues a `PendingMutation`, and pokes the sync engine. TanStack
Query is used for genuinely async server state (session bootstrap, sync
triggers), not for entity data. A module-level `SyncEngine` owns pull, push,
Realtime, and foreground refresh.

## Rationale

- Query-cache persistence (1) makes IndexedDB a cache of _server responses_;
  offline writes and per-entity merging fight the abstraction.
- Sync frameworks (3) add services or heavyweight dependencies the spec's
  “no long-running backend, keep it simple” constraints rule out.
- Dexie's liveQuery gives reactive reads with zero invalidation bookkeeping:
  optimistic UI is just “write to Dexie”.

## Consequences

- One explicit, testable seam: repository functions → pending queue → push.
- We own the sync engine's correctness (covered by unit tests for queue,
  retry, merge, and conflicts) instead of debugging a framework.
- Entity reads don't participate in TanStack Query devtools/caching — an
  accepted trade-off for a local-first design.
