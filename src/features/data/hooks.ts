import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Area, ChecklistItem, Note, Project, Tag, Task } from '@/domain/types'

/** All hooks return `undefined` while the first IndexedDB read is in flight. */

export function useTasks(): Task[] | undefined {
  return useLiveQuery(() => db.tasks.toArray(), [])
}

export function useNotes(): Note[] | undefined {
  return useLiveQuery(() => db.notes.toArray(), [])
}

export function useNote(id: string | undefined): Note | undefined {
  return useLiveQuery(() => (id ? db.notes.get(id) : undefined), [id])
}

export function useChecklistItems(noteId: string | undefined): ChecklistItem[] | undefined {
  return useLiveQuery(
    () => (noteId ? db.checklist_items.where('noteId').equals(noteId).sortBy('position') : []),
    [noteId],
  )
}

export function useAreas(): Area[] | undefined {
  return useLiveQuery(
    async () => (await db.areas.toArray()).sort((a, b) => a.position - b.position),
    [],
  )
}

export function useProjects(): Project[] | undefined {
  return useLiveQuery(
    async () => (await db.projects.toArray()).sort((a, b) => a.position - b.position),
    [],
  )
}

export function useTags(): Tag[] | undefined {
  return useLiveQuery(
    async () => (await db.tags.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )
}

/** taskId → Set<tagId> */
export function useTaskTagIds(): Map<string, Set<string>> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.task_tags.toArray()
    const map = new Map<string, Set<string>>()
    for (const row of rows) {
      const set = map.get(row.taskId) ?? new Set<string>()
      set.add(row.tagId)
      map.set(row.taskId, set)
    }
    return map
  }, [])
}

/** noteId → Set<tagId> */
export function useNoteTagIds(): Map<string, Set<string>> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.note_tags.toArray()
    const map = new Map<string, Set<string>>()
    for (const row of rows) {
      const set = map.get(row.noteId) ?? new Set<string>()
      set.add(row.tagId)
      map.set(row.noteId, set)
    }
    return map
  }, [])
}

export function usePendingCount(): number | undefined {
  return useLiveQuery(() => db.pending_mutations.count(), [])
}
