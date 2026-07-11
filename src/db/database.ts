import Dexie, { type EntityTable } from 'dexie'
import type {
  Area,
  ChecklistItem,
  Note,
  NoteTag,
  PendingMutation,
  Project,
  Tag,
  Task,
  TaskTag,
} from '@/domain/types'

export type SyncMetaRow = {
  key: string
  value: string
}

export class NotoDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  notes!: EntityTable<Note, 'id'>
  checklist_items!: EntityTable<ChecklistItem, 'id'>
  projects!: EntityTable<Project, 'id'>
  areas!: EntityTable<Area, 'id'>
  tags!: EntityTable<Tag, 'id'>
  task_tags!: Dexie.Table<TaskTag, [string, string]>
  note_tags!: Dexie.Table<NoteTag, [string, string]>
  pending_mutations!: EntityTable<PendingMutation, 'id'>
  sync_meta!: EntityTable<SyncMetaRow, 'key'>

  constructor(name = 'noto') {
    super(name)
    // Booleans are not valid IndexedDB keys — flags are filtered in memory
    // (the dataset is personal-scale); only sortable/joinable fields are indexed.
    this.version(1).stores({
      tasks: 'id, projectId, dueAt, updatedAt',
      notes: 'id, updatedAt',
      checklist_items: 'id, noteId, position',
      projects: 'id, position',
      tags: 'id, name',
      task_tags: '[taskId+tagId], taskId, tagId',
      note_tags: '[noteId+tagId], noteId, tagId',
      pending_mutations: 'id, createdAt, [entityType+entityId]',
      sync_meta: 'key',
    })
    // v2: areas (grouping level above projects) + projects.areaId.
    this.version(2)
      .stores({
        areas: 'id, position',
        projects: 'id, position, areaId',
      })
      .upgrade(async (tx) => {
        await tx
          .table('projects')
          .toCollection()
          .modify((project: Project) => {
            project.areaId ??= null
          })
      })
  }
}

export const db = new NotoDatabase()

/** Wipe every local table — used on sign-out and “clear local cache”. */
export async function clearLocalData(database: NotoDatabase = db): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    await Promise.all(database.tables.map((table) => table.clear()))
  })
}

export async function getMeta(key: string, database: NotoDatabase = db): Promise<string | null> {
  const row = await database.sync_meta.get(key)
  return row?.value ?? null
}

export async function setMeta(
  key: string,
  value: string,
  database: NotoDatabase = db,
): Promise<void> {
  await database.sync_meta.put({ key, value })
}
