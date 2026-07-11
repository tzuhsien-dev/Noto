export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export type Task = {
  id: string
  userId: string
  title: string
  description: string | null
  completed: boolean
  priority: Priority
  dueAt: string | null
  startAt: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  deletedAt: string | null
  version: number
}

export type Note = {
  id: string
  userId: string
  title: string
  content: string
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  version: number
}

export type ChecklistItem = {
  id: string
  noteId: string
  userId: string
  content: string
  completed: boolean
  position: number
  createdAt: string
  updatedAt: string
  version: number
}

export type Area = {
  id: string
  userId: string
  name: string
  position: number
  createdAt: string
  updatedAt: string
  version: number
}

export type Project = {
  id: string
  userId: string
  name: string
  icon: string | null
  position: number
  areaId: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
  version: number
}

export type Tag = {
  id: string
  userId: string
  name: string
  createdAt: string
  updatedAt: string
  version: number
}

export type TaskTag = {
  taskId: string
  tagId: string
  userId: string
}

export type NoteTag = {
  noteId: string
  tagId: string
  userId: string
}

export type EntityType = 'task' | 'note' | 'checklistItem' | 'project' | 'tag' | 'area'

export type PendingOperation = 'insert' | 'update' | 'delete'

export type PendingMutation = {
  id: string
  entityType: EntityType | 'taskTag' | 'noteTag'
  entityId: string
  operation: PendingOperation
  /** Full entity snapshot at the time of the last local write. */
  payload: unknown
  /** Server version the local edit was based on (conflict detection). */
  baseVersion: number
  createdAt: string
  attempts: number
  /** Sanitized message only — never tokens or raw server responses. */
  lastError: string | null
}

export type SyncPhase = 'offline' | 'pending' | 'syncing' | 'synced' | 'error'

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
