import { db, type NotoDatabase } from '../database'
import { enqueueMutation } from '../queue'
import type { NoteTag, Tag, TaskTag } from '@/domain/types'
import { newId, nowIso } from '@/domain/types'

export function joinId(a: string, b: string): string {
  return `${a}:${b}`
}

export async function createTag(
  input: { userId: string; name: string },
  database: NotoDatabase = db,
): Promise<Tag> {
  const now = nowIso()
  const name = input.name.trim()
  return database.transaction('rw', [database.tags, database.pending_mutations], async () => {
    const existing = (await database.tags.toArray()).find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    )
    if (existing) return existing
    const tag: Tag = {
      id: newId(),
      userId: input.userId,
      name,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    await database.tags.add(tag)
    await enqueueMutation(database, {
      entityType: 'tag',
      entityId: tag.id,
      operation: 'insert',
      payload: tag,
      baseVersion: tag.version,
    })
    return tag
  })
}

export async function renameTag(
  id: string,
  name: string,
  database: NotoDatabase = db,
): Promise<Tag | undefined> {
  return database.transaction('rw', [database.tags, database.pending_mutations], async () => {
    const current = await database.tags.get(id)
    if (!current) return undefined
    const updated = { ...current, name: name.trim(), updatedAt: nowIso() }
    await database.tags.put(updated)
    await enqueueMutation(database, {
      entityType: 'tag',
      entityId: id,
      operation: 'update',
      payload: updated,
      baseVersion: current.version,
    })
    return updated
  })
}

/** Deletes the tag and its associations only — never the tasks/notes. */
export async function deleteTag(id: string, database: NotoDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.tags, database.task_tags, database.note_tags, database.pending_mutations],
    async () => {
      const current = await database.tags.get(id)
      if (!current) return
      await database.tags.delete(id)
      // Server-side FK cascade removes join rows with the tag.
      await database.task_tags.where('tagId').equals(id).delete()
      await database.note_tags.where('tagId').equals(id).delete()
      await enqueueMutation(database, {
        entityType: 'tag',
        entityId: id,
        operation: 'delete',
        payload: { id },
        baseVersion: current.version,
      })
    },
  )
}

export async function setTaskTags(
  taskId: string,
  userId: string,
  tagIds: string[],
  database: NotoDatabase = db,
): Promise<void> {
  await database.transaction('rw', [database.task_tags, database.pending_mutations], async () => {
    const current = await database.task_tags.where('taskId').equals(taskId).toArray()
    const currentIds = new Set(current.map((r) => r.tagId))
    const nextIds = new Set(tagIds)
    for (const row of current) {
      if (!nextIds.has(row.tagId)) {
        await database.task_tags.delete([row.taskId, row.tagId])
        await enqueueMutation(database, {
          entityType: 'taskTag',
          entityId: joinId(taskId, row.tagId),
          operation: 'delete',
          payload: { taskId, tagId: row.tagId },
          baseVersion: 0,
        })
      }
    }
    for (const tagId of nextIds) {
      if (!currentIds.has(tagId)) {
        const row: TaskTag = { taskId, tagId, userId }
        await database.task_tags.put(row)
        await enqueueMutation(database, {
          entityType: 'taskTag',
          entityId: joinId(taskId, tagId),
          operation: 'insert',
          payload: row,
          baseVersion: 0,
        })
      }
    }
  })
}

export async function setNoteTags(
  noteId: string,
  userId: string,
  tagIds: string[],
  database: NotoDatabase = db,
): Promise<void> {
  await database.transaction('rw', [database.note_tags, database.pending_mutations], async () => {
    const current = await database.note_tags.where('noteId').equals(noteId).toArray()
    const currentIds = new Set(current.map((r) => r.tagId))
    const nextIds = new Set(tagIds)
    for (const row of current) {
      if (!nextIds.has(row.tagId)) {
        await database.note_tags.delete([row.noteId, row.tagId])
        await enqueueMutation(database, {
          entityType: 'noteTag',
          entityId: joinId(noteId, row.tagId),
          operation: 'delete',
          payload: { noteId, tagId: row.tagId },
          baseVersion: 0,
        })
      }
    }
    for (const tagId of nextIds) {
      if (!currentIds.has(tagId)) {
        const row: NoteTag = { noteId, tagId, userId }
        await database.note_tags.put(row)
        await enqueueMutation(database, {
          entityType: 'noteTag',
          entityId: joinId(noteId, tagId),
          operation: 'insert',
          payload: row,
          baseVersion: 0,
        })
      }
    }
  })
}
