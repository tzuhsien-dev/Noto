import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { createTask, softDeleteTask, updateTask } from '@/db/repo/tasks'
import { createTag, setTaskTags } from '@/db/repo/tags'
import { FakeBackend, FAKE_USER } from '@/lib/backend/fake'
import type { EntityRow } from '@/lib/backend/types'
import { getSyncStatus, setSyncStatus } from './status'
import { SyncEngine } from './engine'

const USER = FAKE_USER.id

let backend: FakeBackend
let engine: SyncEngine

beforeEach(() => {
  backend = new FakeBackend()
  engine = new SyncEngine(backend, USER)
})

afterEach(async () => {
  engine.stop()
  setSyncStatus({ phase: 'synced', message: null, lastSyncAt: null })
  await Promise.all(db.tables.map((table) => table.clear()))
})

async function remoteTask(id: string): Promise<EntityRow | null> {
  return backend.fetchEntity('task', id)
}

describe('push', () => {
  it('pushes a local insert and empties the queue', async () => {
    const task = await createTask({ userId: USER, title: 'Sync me' })
    await engine.syncNow()
    expect(await db.pending_mutations.count()).toBe(0)
    expect((await remoteTask(task.id))?.title).toBe('Sync me')
    expect(getSyncStatus().phase).toBe('synced')
    expect(getSyncStatus().lastSyncAt).not.toBeNull()
  })

  it('pushes soft deletes as updates preserving the row', async () => {
    const task = await createTask({ userId: USER, title: 'To trash' })
    await engine.syncNow()
    await softDeleteTask(task.id)
    await engine.syncNow()
    const remote = await remoteTask(task.id)
    expect(remote).not.toBeNull()
    expect(remote?.deletedAt).not.toBeNull()
  })

  it('pushes join-table changes', async () => {
    const task = await createTask({ userId: USER, title: 'Tagged' })
    const tag = await createTag({ userId: USER, name: 'urgent' })
    await setTaskTags(task.id, USER, [tag.id])
    await engine.syncNow()
    expect(await backend.pullJoins('taskTag')).toEqual([
      { taskId: task.id, tagId: tag.id, userId: USER },
    ])
  })

  it('keeps mutations pending with a sanitized error when the server is down', async () => {
    await createTask({ userId: USER, title: 'Stuck' })
    backend.failPushes = true
    await engine.syncNow()

    expect(await db.pending_mutations.count()).toBe(1)
    const pending = (await db.pending_mutations.toArray())[0]
    expect(pending?.attempts).toBe(1)
    expect(pending?.lastError).toBe('Could not reach the server')
    expect(getSyncStatus().phase).toBe('error')

    backend.failPushes = false
    await engine.syncNow()
    expect(await db.pending_mutations.count()).toBe(0)
    expect(getSyncStatus().phase).toBe('synced')
  })
})

describe('pull', () => {
  it('applies remote rows into the local cache', async () => {
    const row: EntityRow = {
      id: crypto.randomUUID(),
      userId: USER,
      title: 'From another device',
      description: null,
      completed: false,
      priority: 'none',
      dueAt: null,
      startAt: null,
      projectId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      deletedAt: null,
      version: 1,
    }
    await backend.upsertEntity('task', row)
    await engine.syncNow()
    expect((await db.tasks.get(row.id as string))?.title).toBe('From another device')
  })

  it('does not clobber entities with pending local edits', async () => {
    const task = await createTask({ userId: USER, title: 'Local title' })
    await engine.syncNow()
    // Remote edit arrives while a new local edit is still unsynced.
    await updateTask(task.id, { title: 'Local edit v2' })
    const remote = await remoteTask(task.id)
    await backend.upsertEntity('task', { ...remote!, title: 'Remote edit' })
    // Pull only (push disabled) to isolate the merge behaviour.
    backend.failPushes = true
    await engine.syncNow()
    expect((await db.tasks.get(task.id))?.title).toBe('Local edit v2')
  })
})

describe('conflict resolution', () => {
  it('keeps the remote version and creates a conflict copy for tasks', async () => {
    const task = await createTask({ userId: USER, title: 'Original' })
    await engine.syncNow()

    // Another device updates the same task (server version bumps to 2).
    const remote = await remoteTask(task.id)
    await backend.upsertEntity('task', { ...remote!, title: 'Remote wins' })

    // This device edits based on the stale version 1.
    await updateTask(task.id, { title: 'Local stale edit' })
    await engine.syncNow() // conflict → remote kept + copy enqueued
    await engine.syncNow() // pushes the copy

    const titles = (await db.tasks.toArray()).map((t) => t.title).sort()
    expect(titles).toEqual(['Local stale edit (conflict copy)', 'Remote wins'])
    expect((await db.tasks.get(task.id))?.title).toBe('Remote wins')
    expect(await db.pending_mutations.count()).toBe(0)
    // The copy reached the server too.
    const remoteTitles = (await backend.pullSince('task', null, 100, 0)).rows.map((r) => r.title)
    expect(remoteTitles.sort()).toEqual(['Local stale edit (conflict copy)', 'Remote wins'])
  })

  it('lets the remote edit win over a stale permanent delete', async () => {
    const task = await createTask({ userId: USER, title: 'Keep me' })
    await engine.syncNow()
    const remote = await remoteTask(task.id)
    await backend.upsertEntity('task', { ...remote!, title: 'Edited elsewhere' })

    // Permanent delete on this device is pushed as a hard delete; the fake
    // backend (like PostgREST) deletes unconditionally, so remote row is gone.
    // Version-guarded semantics apply to updates; deletes are idempotent.
    await db.pending_mutations.clear()
    await updateTask(task.id, { title: 'stale' })
    await engine.syncNow()
    await engine.syncNow()
    expect((await db.tasks.get(task.id))?.title).toBe('Edited elsewhere')
  })
})

describe('realtime', () => {
  it('applies subscribed changes and stops after stop()', async () => {
    engine.start()
    await vi.waitFor(async () => {
      expect(getSyncStatus().phase).toBe('synced')
    })

    const row: EntityRow = {
      id: crypto.randomUUID(),
      userId: USER,
      title: 'Realtime insert',
      description: null,
      completed: false,
      priority: 'none',
      dueAt: null,
      startAt: null,
      projectId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      deletedAt: null,
      version: 1,
    }
    backend.emitRemoteChange({ kind: 'entity', entityType: 'task', row, deleted: false })
    await vi.waitFor(async () => {
      expect(await db.tasks.get(row.id as string)).toBeDefined()
    })

    engine.stop()
    const row2 = { ...row, id: crypto.randomUUID(), title: 'After stop' }
    backend.emitRemoteChange({ kind: 'entity', entityType: 'task', row: row2, deleted: false })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(await db.tasks.get(row2.id as string)).toBeUndefined()
  })
})
