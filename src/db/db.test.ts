import { beforeEach, describe, expect, it } from 'vitest'
import { NotoDatabase } from './database'
import { enqueueMutation, pendingFor } from './queue'
import {
  createTask,
  permanentlyDeleteTask,
  restoreTask,
  setTaskCompleted,
  softDeleteTask,
  updateTask,
} from './repo/tasks'
import { addChecklistItem, createNote, softDeleteNote, updateNote } from './repo/notes'
import { createTag, deleteTag, setTaskTags } from './repo/tags'
import { createArea, deleteArea } from './repo/areas'
import { createProject } from './repo/projects'

const USER = '00000000-0000-4000-8000-0000000000aa'

let db: NotoDatabase
let dbCounter = 0

beforeEach(() => {
  dbCounter += 1
  db = new NotoDatabase(`noto-test-${dbCounter}`)
})

describe('pending mutation queue coalescing', () => {
  it('keeps a single insert mutation across insert + update', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    await updateTask(task.id, { title: 'b' }, db)
    const pending = await pendingFor(db, 'task', task.id)
    expect(pending?.operation).toBe('insert')
    expect((pending!.payload as { title: string }).title).toBe('b')
    expect(await db.pending_mutations.count()).toBe(1)
  })

  it('drops the queue entry entirely for insert + permanent delete', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    await permanentlyDeleteTask(task.id, db)
    expect(await db.pending_mutations.count()).toBe(0)
    expect(await db.tasks.count()).toBe(0)
  })

  it('coalesces update + update keeping the original baseVersion', async () => {
    // Simulate a synced task (as if pulled from the server at version 3).
    const task = await createTask({ userId: USER, title: 'a' }, db)
    await db.pending_mutations.clear()
    await db.tasks.update(task.id, { version: 3 })

    await updateTask(task.id, { title: 'b' }, db)
    // Local optimistic version stays 3; second edit must still be based on 3.
    await updateTask(task.id, { title: 'c' }, db)

    const pending = await pendingFor(db, 'task', task.id)
    expect(pending?.operation).toBe('update')
    expect(pending?.baseVersion).toBe(3)
    expect((pending!.payload as { title: string }).title).toBe('c')
    expect(await db.pending_mutations.count()).toBe(1)
  })

  it('turns update + delete into a delete', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    await db.pending_mutations.clear()
    await updateTask(task.id, { title: 'b' }, db)
    await permanentlyDeleteTask(task.id, db)
    const pending = await pendingFor(db, 'task', task.id)
    expect(pending?.operation).toBe('delete')
  })

  it('resets attempts/lastError when a mutation is coalesced', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    const pending = await pendingFor(db, 'task', task.id)
    await db.pending_mutations.update(pending!.id, { attempts: 3, lastError: 'boom' })
    await updateTask(task.id, { title: 'b' }, db)
    const after = await pendingFor(db, 'task', task.id)
    expect(after?.attempts).toBe(0)
    expect(after?.lastError).toBeNull()
  })

  it('enqueueMutation stores sanitized metadata only', async () => {
    await enqueueMutation(db, {
      entityType: 'task',
      entityId: 'x',
      operation: 'insert',
      payload: { id: 'x' },
      baseVersion: 1,
    })
    const rows = await db.pending_mutations.toArray()
    expect(rows[0]?.lastError).toBeNull()
    expect(rows[0]?.attempts).toBe(0)
  })
})

describe('task soft delete', () => {
  it('soft delete sets deletedAt and restore clears it', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    await softDeleteTask(task.id, db)
    expect((await db.tasks.get(task.id))?.deletedAt).not.toBeNull()
    await restoreTask(task.id, db)
    expect((await db.tasks.get(task.id))?.deletedAt).toBeNull()
  })

  it('completing sets completedAt; uncompleting clears it', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    await setTaskCompleted(task.id, true, db)
    expect((await db.tasks.get(task.id))?.completedAt).not.toBeNull()
    await setTaskCompleted(task.id, false, db)
    expect((await db.tasks.get(task.id))?.completedAt).toBeNull()
  })
})

describe('notes and checklists', () => {
  it('updates note content and keeps a single pending insert', async () => {
    const note = await createNote({ userId: USER, title: 'n' }, db)
    await updateNote(note.id, { content: 'hello' }, db)
    expect((await db.notes.get(note.id))?.content).toBe('hello')
    expect(await db.pending_mutations.count()).toBe(1)
  })

  it('soft-deleting a note keeps checklist items locally', async () => {
    const note = await createNote({ userId: USER }, db)
    await addChecklistItem({ noteId: note.id, userId: USER, content: 'item' }, db)
    await softDeleteNote(note.id, db)
    expect(await db.checklist_items.where('noteId').equals(note.id).count()).toBe(1)
  })

  it('assigns increasing checklist positions', async () => {
    const note = await createNote({ userId: USER }, db)
    const a = await addChecklistItem({ noteId: note.id, userId: USER, content: 'a' }, db)
    const b = await addChecklistItem({ noteId: note.id, userId: USER, content: 'b' }, db)
    expect(b.position).toBeGreaterThan(a.position)
  })
})

describe('tags', () => {
  it('deleting a tag removes associations but not tasks', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    const tag = await createTag({ userId: USER, name: 'work' }, db)
    await setTaskTags(task.id, USER, [tag.id], db)
    expect(await db.task_tags.count()).toBe(1)
    await deleteTag(tag.id, db)
    expect(await db.task_tags.count()).toBe(0)
    expect(await db.tasks.get(task.id)).toBeDefined()
  })

  it('createTag is case-insensitively idempotent', async () => {
    const a = await createTag({ userId: USER, name: 'Work' }, db)
    const b = await createTag({ userId: USER, name: 'work' }, db)
    expect(b.id).toBe(a.id)
    expect(await db.tags.count()).toBe(1)
  })

  it('setTaskTags computes a minimal diff', async () => {
    const task = await createTask({ userId: USER, title: 'a' }, db)
    const t1 = await createTag({ userId: USER, name: 'one' }, db)
    const t2 = await createTag({ userId: USER, name: 'two' }, db)
    await setTaskTags(task.id, USER, [t1.id], db)
    await setTaskTags(task.id, USER, [t2.id], db)
    const rows = await db.task_tags.toArray()
    expect(rows).toEqual([{ taskId: task.id, tagId: t2.id, userId: USER }])
  })
})

describe('areas', () => {
  it('groups projects and ungroups them when the area is deleted', async () => {
    const area = await createArea({ userId: USER, name: 'Work' }, db)
    const grouped = await createProject({ userId: USER, name: 'RGD', areaId: area.id }, db)
    const loose = await createProject({ userId: USER, name: 'Chores' }, db)
    expect((await db.projects.get(grouped.id))?.areaId).toBe(area.id)
    expect((await db.projects.get(loose.id))?.areaId).toBeNull()

    await deleteArea(area.id, db)
    expect(await db.areas.count()).toBe(0)
    expect((await db.projects.get(grouped.id))?.areaId).toBeNull()
    // The ungrouping is queued for sync (insert + update coalesce to insert).
    const pending = await pendingFor(db, 'project', grouped.id)
    expect(pending?.operation).toBe('insert')
    expect((pending?.payload as { areaId: string | null }).areaId).toBeNull()
  })

  it('queues a delete mutation for a synced area', async () => {
    const area = await createArea({ userId: USER, name: 'Life' }, db)
    // Simulate the insert having been pushed already.
    await db.pending_mutations.where('[entityType+entityId]').equals(['area', area.id]).delete()
    await deleteArea(area.id, db)
    const pending = await pendingFor(db, 'area', area.id)
    expect(pending?.operation).toBe('delete')
  })

  it('assigns increasing area positions', async () => {
    const first = await createArea({ userId: USER, name: 'One' }, db)
    const second = await createArea({ userId: USER, name: 'Two' }, db)
    expect(second.position).toBeGreaterThan(first.position)
  })
})
