import type { EntityType } from '@/domain/types'

export const ENTITY_TABLES: Record<EntityType, string> = {
  task: 'tasks',
  note: 'notes',
  checklistItem: 'checklist_items',
  project: 'projects',
  tag: 'tags',
  area: 'areas',
}

export const JOIN_TABLES = {
  taskTag: 'task_tags',
  noteTag: 'note_tags',
} as const

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** Domain (camelCase) row → PostgreSQL (snake_case) row. */
export function toSnakeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) out[camelToSnake(key)] = value
  return out
}

/** PostgreSQL (snake_case) row → domain (camelCase) row. */
export function toCamelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) out[snakeToCamel(key)] = value
  return out
}
