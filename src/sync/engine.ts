import type Dexie from 'dexie'
import { db, getMeta, setMeta } from '@/db/database'
import { setOnMutationEnqueued } from '@/db/queue'
import { createNote } from '@/db/repo/notes'
import { createTask } from '@/db/repo/tasks'
import type { BackendClient, EntityRow, JoinKind, JoinRow, RemoteChange } from '@/lib/backend/types'
import { BackendError } from '@/lib/backend/types'
import type { EntityType, Note, PendingMutation, Task } from '@/domain/types'
import { nowIso } from '@/domain/types'
import { setSyncStatus } from './status'

const PULL_PAGE_SIZE = 500
const MAX_BACKOFF_MS = 5 * 60_000
const ENTITY_TYPES: EntityType[] = ['area', 'project', 'tag', 'task', 'note', 'checklistItem']
const JOIN_KINDS: JoinKind[] = ['taskTag', 'noteTag']

/**
 * Rows crossing the backend seam are structurally identical to the domain
 * entities (camelCase); the tables are viewed through a widened row type so
 * the engine can treat every entity table uniformly.
 */
function tableFor(entityType: EntityType): Dexie.Table<EntityRow, string> {
  switch (entityType) {
    case 'task':
      return db.tasks as unknown as Dexie.Table<EntityRow, string>
    case 'note':
      return db.notes as unknown as Dexie.Table<EntityRow, string>
    case 'checklistItem':
      return db.checklist_items as unknown as Dexie.Table<EntityRow, string>
    case 'project':
      return db.projects as unknown as Dexie.Table<EntityRow, string>
    case 'tag':
      return db.tags as unknown as Dexie.Table<EntityRow, string>
    case 'area':
      return db.areas as unknown as Dexie.Table<EntityRow, string>
  }
}

function joinTableFor(kind: JoinKind): Dexie.Table<JoinRow, [string, string]> {
  const table = kind === 'taskTag' ? db.task_tags : db.note_tags
  return table as Dexie.Table<JoinRow, [string, string]>
}

function sanitizeMessage(error: unknown): string {
  if (error instanceof BackendError) return error.message
  return 'Sync failed'
}

async function hasPending(entityType: PendingMutation['entityType'], entityId: string) {
  const row = await db.pending_mutations
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .first()
  return row !== undefined
}

function joinEntityId(kind: JoinKind, row: JoinRow): string {
  const record = row as Record<string, string>
  const left = kind === 'taskTag' ? record.taskId : record.noteId
  return `${left}:${record.tagId}`
}

/**
 * Owns all cloud synchronization: initial + incremental pulls, pushing the
 * pending queue with version-guarded conflict detection, the Realtime
 * subscription, and foreground/online refresh. Exactly one instance runs per
 * signed-in session (module singleton, torn down on sign-out).
 */
export class SyncEngine {
  private readonly backend: BackendClient
  private readonly userId: string
  private unsubscribeRealtime: (() => void) | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private syncing = false
  private queued = false
  private stopped = false

  constructor(backend: BackendClient, userId: string) {
    this.backend = backend
    this.userId = userId
  }

  private readonly onForeground = () => {
    if (document.visibilityState === 'hidden') return
    void this.syncNow()
  }

  private readonly onOnline = () => {
    setSyncStatus({ phase: 'syncing', message: null })
    void this.syncNow()
  }

  private readonly onOffline = () => {
    setSyncStatus({ phase: 'offline' })
  }

  private pushDebounce: ReturnType<typeof setTimeout> | null = null

  /** Local writes poke the engine; a short debounce batches edit bursts. */
  private readonly onLocalMutation = () => {
    if (this.pushDebounce) clearTimeout(this.pushDebounce)
    this.pushDebounce = setTimeout(() => {
      this.pushDebounce = null
      void this.syncNow()
    }, 400)
  }

  start(): void {
    window.addEventListener('online', this.onOnline)
    window.addEventListener('offline', this.onOffline)
    window.addEventListener('focus', this.onForeground)
    document.addEventListener('visibilitychange', this.onForeground)
    setOnMutationEnqueued(this.onLocalMutation)
    this.unsubscribeRealtime = this.backend.subscribeToChanges(this.userId, (change) => {
      void this.applyRemoteChange(change)
    })
    void this.syncNow()
  }

  stop(): void {
    this.stopped = true
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
    window.removeEventListener('focus', this.onForeground)
    document.removeEventListener('visibilitychange', this.onForeground)
    setOnMutationEnqueued(null)
    this.unsubscribeRealtime?.()
    this.unsubscribeRealtime = null
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.pushDebounce) clearTimeout(this.pushDebounce)
  }

  /** Pull remote changes, then push the pending queue. Reentrancy-safe. */
  async syncNow(): Promise<void> {
    if (this.stopped) return
    if (this.syncing) {
      // Collapse concurrent requests into one follow-up run.
      this.queued = true
      return
    }
    if (!navigator.onLine) {
      setSyncStatus({ phase: 'offline' })
      return
    }
    this.syncing = true
    setSyncStatus({ phase: 'syncing', message: null })
    try {
      await this.pull()
      await this.push()
      const remaining = await db.pending_mutations.count()
      const lastSyncAt = nowIso()
      await setMeta('lastSyncAt', lastSyncAt)
      setSyncStatus({ phase: remaining > 0 ? 'pending' : 'synced', lastSyncAt, message: null })
    } catch (error) {
      setSyncStatus({
        phase: navigator.onLine ? 'error' : 'offline',
        message: sanitizeMessage(error),
      })
      this.scheduleRetry()
    } finally {
      this.syncing = false
      if (this.queued) {
        this.queued = false
        void this.syncNow()
      }
    }
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return
    void db.pending_mutations
      .orderBy('createdAt')
      .first()
      .then((first) => {
        const attempts = first?.attempts ?? 1
        const delay = Math.min(2 ** Math.min(attempts, 10) * 1000, MAX_BACKOFF_MS)
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null
          void this.syncNow()
        }, delay)
      })
  }

  // --- pull -------------------------------------------------------------------

  private async pull(): Promise<void> {
    for (const entityType of ENTITY_TYPES) {
      const cursorKey = `lastPull:${entityType}`
      const cursor = await getMeta(cursorKey)
      let offset = 0
      let newest: string | null = null
      for (;;) {
        const page = await this.backend.pullSince(entityType, cursor, PULL_PAGE_SIZE, offset)
        for (const row of page.rows) {
          await this.applyRemoteRow(entityType, row)
        }
        const last = page.rows.at(-1)
        if (last) newest = String(last.updatedAt)
        if (!page.hasMore) break
        offset += page.rows.length
      }
      // Only advance the cursor once the whole range has been applied.
      if (newest) await setMeta(cursorKey, newest)
    }
    await this.reconcileJoins()
  }

  private async applyRemoteRow(entityType: EntityType, row: EntityRow): Promise<void> {
    if (await hasPending(entityType, row.id)) return // local edit wins until pushed
    await tableFor(entityType).put(row)
  }

  private async reconcileJoins(): Promise<void> {
    for (const kind of JOIN_KINDS) {
      const remote = await this.backend.pullJoins(kind)
      const table = joinTableFor(kind)
      const local = await table.toArray()
      const remoteIds = new Set(remote.map((row) => joinEntityId(kind, row as JoinRow)))
      for (const row of local) {
        const id = joinEntityId(kind, row as JoinRow)
        if (remoteIds.has(id)) continue
        if (await hasPending(kind, id)) continue // locally-added, not yet pushed
        const record = row as Record<string, string>
        const left = kind === 'taskTag' ? record.taskId : record.noteId
        await table.delete([left, record.tagId] as [string, string])
      }
      for (const row of remote) {
        const id = joinEntityId(kind, row as JoinRow)
        if (await hasPending(kind, id)) continue // locally-removed, not yet pushed
        await table.put(row)
      }
    }
  }

  // --- push -------------------------------------------------------------------

  private async push(): Promise<void> {
    const mutations = await db.pending_mutations.orderBy('createdAt').toArray()
    for (const mutation of mutations) {
      if (this.stopped) return
      try {
        await this.pushOne(mutation)
        await db.pending_mutations.delete(mutation.id)
      } catch (error) {
        await db.pending_mutations.update(mutation.id, {
          attempts: mutation.attempts + 1,
          lastError: sanitizeMessage(error),
        })
        throw error
      }
    }
  }

  private async pushOne(mutation: PendingMutation): Promise<void> {
    if (mutation.entityType === 'taskTag' || mutation.entityType === 'noteTag') {
      const row = mutation.payload as JoinRow
      if (mutation.operation === 'delete') await this.backend.deleteJoin(mutation.entityType, row)
      else await this.backend.insertJoin(mutation.entityType, { ...row, userId: this.userId })
      return
    }

    const entityType = mutation.entityType
    if (mutation.operation === 'insert') {
      const row = { ...(mutation.payload as EntityRow), userId: this.userId }
      await this.backend.upsertEntity(entityType, row)
      return
    }
    if (mutation.operation === 'delete') {
      await this.backend.deleteEntity(entityType, mutation.entityId)
      return
    }

    const row = mutation.payload as EntityRow
    const result = await this.backend.updateEntityGuarded(entityType, row, mutation.baseVersion)
    if (result === 'ok') {
      const fresh = await this.backend.fetchEntity(entityType, mutation.entityId)
      // Adopt the server-bumped version/updated_at without re-queueing.
      if (fresh) await tableFor(entityType).put(fresh)
      return
    }
    await this.resolveConflict(entityType, mutation)
  }

  /**
   * Version-guard failed: the row changed remotely (or was deleted) since
   * this edit's baseVersion. Remote wins locally; content-bearing local
   * edits are preserved as a new "(conflict copy)" entity. See ADR-003.
   */
  private async resolveConflict(entityType: EntityType, mutation: PendingMutation): Promise<void> {
    const remote = await this.backend.fetchEntity(entityType, mutation.entityId)
    if (remote) await tableFor(entityType).put(remote)
    else await tableFor(entityType).delete(mutation.entityId)

    if (entityType === 'task') {
      const local = mutation.payload as Task
      await createTask({
        userId: this.userId,
        title: `${local.title} (conflict copy)`.slice(0, 500),
        description: local.description,
        priority: local.priority,
        dueAt: local.dueAt,
        startAt: local.startAt,
        projectId: local.projectId,
      })
    } else if (entityType === 'note') {
      const local = mutation.payload as Note
      await createNote({
        userId: this.userId,
        title: `${local.title || 'Untitled'} (conflict copy)`.slice(0, 500),
        content: local.content,
      })
    }
    // Other entity types resolve as plain last-write-wins (no copy).
  }

  // --- realtime ------------------------------------------------------------------

  private async applyRemoteChange(change: RemoteChange): Promise<void> {
    if (this.stopped) return
    if (change.kind === 'entity') {
      if (change.deleted) {
        if (!(await hasPending(change.entityType, change.row.id))) {
          await tableFor(change.entityType).delete(change.row.id)
        }
        return
      }
      await this.applyRemoteRow(change.entityType, change.row)
      return
    }
    const id = joinEntityId(change.joinKind, change.row)
    if (await hasPending(change.joinKind, id)) return
    const table = joinTableFor(change.joinKind)
    if (change.deleted) {
      const record = change.row as Record<string, string>
      const left = change.joinKind === 'taskTag' ? record.taskId : record.noteId
      if (left && record.tagId) await table.delete([left, record.tagId] as [string, string])
    } else {
      await table.put(change.row)
    }
  }
}

// --- module singleton -------------------------------------------------------------

let engine: SyncEngine | null = null

export function startSyncEngine(backend: BackendClient, userId: string): void {
  if (engine) engine.stop()
  engine = new SyncEngine(backend, userId)
  engine.start()
}

export function stopSyncEngine(): void {
  engine?.stop()
  engine = null
}

/** Manual retry / “sync now” affordance (Settings, mutation layer). */
export function requestSync(): void {
  void engine?.syncNow()
}
