import { db, type NotoDatabase } from '../database'
import { enqueueMutation } from '../queue'
import type { ChecklistItem, Note } from '@/domain/types'
import { newId, nowIso } from '@/domain/types'

export type NewNote = {
  userId: string
  title?: string
  content?: string
}

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'archived'>>

export async function createNote(input: NewNote, database: NotoDatabase = db): Promise<Note> {
  const now = nowIso()
  const note: Note = {
    id: newId(),
    userId: input.userId,
    title: input.title ?? '',
    content: input.content ?? '',
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }
  await database.transaction('rw', [database.notes, database.pending_mutations], async () => {
    await database.notes.add(note)
    await enqueueMutation(database, {
      entityType: 'note',
      entityId: note.id,
      operation: 'insert',
      payload: note,
      baseVersion: note.version,
    })
  })
  return note
}

async function applyNoteUpdate(
  id: string,
  mutate: (note: Note) => Note,
  database: NotoDatabase = db,
): Promise<Note | undefined> {
  return database.transaction('rw', [database.notes, database.pending_mutations], async () => {
    const current = await database.notes.get(id)
    if (!current) return undefined
    const updated = { ...mutate(current), updatedAt: nowIso() }
    await database.notes.put(updated)
    await enqueueMutation(database, {
      entityType: 'note',
      entityId: id,
      operation: 'update',
      payload: updated,
      baseVersion: current.version,
    })
    return updated
  })
}

export async function updateNote(
  id: string,
  patch: NotePatch,
  database: NotoDatabase = db,
): Promise<Note | undefined> {
  return applyNoteUpdate(id, (note) => ({ ...note, ...patch }), database)
}

export async function softDeleteNote(
  id: string,
  database: NotoDatabase = db,
): Promise<Note | undefined> {
  return applyNoteUpdate(id, (note) => ({ ...note, deletedAt: nowIso() }), database)
}

export async function restoreNote(
  id: string,
  database: NotoDatabase = db,
): Promise<Note | undefined> {
  return applyNoteUpdate(id, (note) => ({ ...note, deletedAt: null }), database)
}

export async function permanentlyDeleteNote(
  id: string,
  database: NotoDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.notes, database.note_tags, database.checklist_items, database.pending_mutations],
    async () => {
      const current = await database.notes.get(id)
      if (!current) return
      await database.notes.delete(id)
      await database.note_tags.where('noteId').equals(id).delete()
      // Server-side FK cascade removes checklist items with the note.
      const items = await database.checklist_items.where('noteId').equals(id).toArray()
      await database.checklist_items.where('noteId').equals(id).delete()
      for (const item of items) {
        const pending = await database.pending_mutations
          .where('[entityType+entityId]')
          .equals(['checklistItem', item.id])
          .first()
        if (pending) await database.pending_mutations.delete(pending.id)
      }
      await enqueueMutation(database, {
        entityType: 'note',
        entityId: id,
        operation: 'delete',
        payload: { id },
        baseVersion: current.version,
      })
    },
  )
}

// --- Checklist items -------------------------------------------------------

export async function addChecklistItem(
  input: { noteId: string; userId: string; content: string },
  database: NotoDatabase = db,
): Promise<ChecklistItem> {
  const now = nowIso()
  return database.transaction(
    'rw',
    [database.checklist_items, database.pending_mutations],
    async () => {
      const siblings = await database.checklist_items.where('noteId').equals(input.noteId).toArray()
      const position = siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 0
      const item: ChecklistItem = {
        id: newId(),
        noteId: input.noteId,
        userId: input.userId,
        content: input.content,
        completed: false,
        position,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }
      await database.checklist_items.add(item)
      await enqueueMutation(database, {
        entityType: 'checklistItem',
        entityId: item.id,
        operation: 'insert',
        payload: item,
        baseVersion: item.version,
      })
      return item
    },
  )
}

export async function updateChecklistItem(
  id: string,
  patch: Partial<Pick<ChecklistItem, 'content' | 'completed' | 'position'>>,
  database: NotoDatabase = db,
): Promise<ChecklistItem | undefined> {
  return database.transaction(
    'rw',
    [database.checklist_items, database.pending_mutations],
    async () => {
      const current = await database.checklist_items.get(id)
      if (!current) return undefined
      const updated = { ...current, ...patch, updatedAt: nowIso() }
      await database.checklist_items.put(updated)
      await enqueueMutation(database, {
        entityType: 'checklistItem',
        entityId: id,
        operation: 'update',
        payload: updated,
        baseVersion: current.version,
      })
      return updated
    },
  )
}

export async function deleteChecklistItem(id: string, database: NotoDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.checklist_items, database.pending_mutations],
    async () => {
      const current = await database.checklist_items.get(id)
      if (!current) return
      await database.checklist_items.delete(id)
      await enqueueMutation(database, {
        entityType: 'checklistItem',
        entityId: id,
        operation: 'delete',
        payload: { id },
        baseVersion: current.version,
      })
    },
  )
}
