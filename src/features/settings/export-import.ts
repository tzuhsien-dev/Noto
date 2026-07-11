import { z } from 'zod'
import { format } from 'date-fns'
import { db, setMeta, type NotoDatabase } from '@/db/database'
import { enqueueMutation } from '@/db/queue'
import {
  areaSchema,
  checklistItemSchema,
  noteSchema,
  noteTagSchema,
  projectSchema,
  tagSchema,
  taskSchema,
  taskTagSchema,
} from '@/domain/schemas'
import type { EntityType } from '@/domain/types'
import { nowIso } from '@/domain/types'

export const EXPORT_SCHEMA_VERSION = 1

export const exportFileSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.iso.datetime({ offset: true }),
  app: z.string(),
  data: z.object({
    tasks: z.array(taskSchema),
    notes: z.array(noteSchema),
    checklistItems: z.array(checklistItemSchema),
    projects: z.array(projectSchema),
    // Default keeps pre-area exports importable without a version bump.
    areas: z.array(areaSchema).default([]),
    tags: z.array(tagSchema),
    taskTags: z.array(taskTagSchema),
    noteTags: z.array(noteTagSchema),
  }),
})

export type ExportFile = z.infer<typeof exportFileSchema>

export async function buildExport(database: NotoDatabase = db): Promise<ExportFile> {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    app: 'noto',
    data: {
      tasks: await database.tasks.toArray(),
      notes: await database.notes.toArray(),
      checklistItems: await database.checklist_items.toArray(),
      projects: await database.projects.toArray(),
      areas: await database.areas.toArray(),
      tags: await database.tags.toArray(),
      taskTags: await database.task_tags.toArray(),
      noteTags: await database.note_tags.toArray(),
    },
  }
}

export async function buildMarkdownExport(database: NotoDatabase = db): Promise<string> {
  const data = await buildExport(database)
  const lines: string[] = [`# Noto export — ${format(new Date(), 'yyyy-MM-dd')}`, '']
  const projectName = new Map(data.data.projects.map((p) => [p.id, p.name]))

  lines.push('## Tasks', '')
  for (const task of data.data.tasks) {
    if (task.deletedAt) continue
    const parts = [`- [${task.completed ? 'x' : ' '}] ${task.title}`]
    if (task.dueAt) parts.push(`(due ${format(new Date(task.dueAt), 'yyyy-MM-dd')})`)
    if (task.priority !== 'none') parts.push(`[${task.priority}]`)
    if (task.projectId && projectName.get(task.projectId))
      parts.push(`@${projectName.get(task.projectId)}`)
    lines.push(parts.join(' '))
    if (task.description) lines.push(`  ${task.description.replaceAll('\n', '\n  ')}`)
  }

  lines.push('', '## Notes', '')
  for (const note of data.data.notes) {
    if (note.deletedAt) continue
    lines.push(`### ${note.title || 'Untitled note'}`, '', note.content, '')
    const items = data.data.checklistItems
      .filter((item) => item.noteId === note.id)
      .sort((a, b) => a.position - b.position)
    for (const item of items) lines.push(`- [${item.completed ? 'x' : ' '}] ${item.content}`)
    if (items.length) lines.push('')
  }
  return lines.join('\n')
}

export type ImportPreview = {
  file: ExportFile
  counts: Record<string, { total: number; new: number }>
}

/** Validate an uploaded JSON string; throws a user-safe Error when invalid. */
export async function validateImport(
  jsonText: string,
  database: NotoDatabase = db,
): Promise<ImportPreview> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const result = exportFileSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('That file is not a Noto export (or was made by a newer version).')
  }
  const file = result.data
  const existing = {
    tasks: new Set((await database.tasks.toArray()).map((r) => r.id)),
    notes: new Set((await database.notes.toArray()).map((r) => r.id)),
    checklistItems: new Set((await database.checklist_items.toArray()).map((r) => r.id)),
    projects: new Set((await database.projects.toArray()).map((r) => r.id)),
    areas: new Set((await database.areas.toArray()).map((r) => r.id)),
    tags: new Set((await database.tags.toArray()).map((r) => r.id)),
  }
  const counts: ImportPreview['counts'] = {}
  for (const key of ['tasks', 'notes', 'checklistItems', 'projects', 'areas', 'tags'] as const) {
    const rows = file.data[key]
    counts[key] = {
      total: rows.length,
      new: rows.filter((r) => !existing[key].has(r.id)).length,
    }
  }
  return { file, counts }
}

/**
 * Merge an export into the local store (and sync queue). Non-destructive:
 * rows whose IDs already exist locally are left untouched; imported rows are
 * re-owned by the current user. A JSON snapshot of the pre-import state is
 * stored first so a bad import can be recovered manually.
 */
export async function mergeImport(
  file: ExportFile,
  userId: string,
  database: NotoDatabase = db,
): Promise<number> {
  const snapshot = await buildExport(database)
  await setMeta(`importSnapshot:${nowIso()}`, JSON.stringify(snapshot), database)

  let imported = 0
  const insertEntity = async (
    entityType: EntityType,
    table: { get: (id: string) => Promise<unknown>; add: (row: never) => Promise<unknown> },
    row: { id: string; userId: string; version: number },
  ) => {
    if (await table.get(row.id)) return
    const owned = { ...row, userId, version: 1 }
    await table.add(owned as never)
    await enqueueMutation(database, {
      entityType,
      entityId: owned.id,
      operation: 'insert',
      payload: owned,
      baseVersion: 1,
    })
    imported += 1
  }

  await database.transaction('rw', database.tables, async () => {
    for (const row of file.data.areas) await insertEntity('area', database.areas, row)
    for (const row of file.data.projects) {
      // Orphaned area references would violate the server FK; ungroup instead.
      const areaPresent = row.areaId ? await database.areas.get(row.areaId) : true
      await insertEntity('project', database.projects, areaPresent ? row : { ...row, areaId: null })
    }
    for (const row of file.data.tags) {
      // Tag names are unique per user; skip imports colliding by name.
      const clash = (await database.tags.toArray()).some(
        (t) => t.id !== row.id && t.name.toLowerCase() === row.name.toLowerCase(),
      )
      if (!clash) await insertEntity('tag', database.tags, row)
    }
    for (const row of file.data.tasks) await insertEntity('task', database.tasks, row)
    for (const row of file.data.notes) await insertEntity('note', database.notes, row)
    for (const row of file.data.checklistItems) {
      if (await database.notes.get(row.noteId)) {
        await insertEntity('checklistItem', database.checklist_items, row)
      }
    }
    for (const row of file.data.taskTags) {
      const exists = await database.task_tags.get([row.taskId, row.tagId])
      const parentsPresent =
        (await database.tasks.get(row.taskId)) && (await database.tags.get(row.tagId))
      if (!exists && parentsPresent) {
        const owned = { ...row, userId }
        await database.task_tags.add(owned)
        await enqueueMutation(database, {
          entityType: 'taskTag',
          entityId: `${row.taskId}:${row.tagId}`,
          operation: 'insert',
          payload: owned,
          baseVersion: 0,
        })
      }
    }
    for (const row of file.data.noteTags) {
      const exists = await database.note_tags.get([row.noteId, row.tagId])
      const parentsPresent =
        (await database.notes.get(row.noteId)) && (await database.tags.get(row.tagId))
      if (!exists && parentsPresent) {
        const owned = { ...row, userId }
        await database.note_tags.add(owned)
        await enqueueMutation(database, {
          entityType: 'noteTag',
          entityId: `${row.noteId}:${row.tagId}`,
          operation: 'insert',
          payload: owned,
          baseVersion: 0,
        })
      }
    }
  })
  return imported
}

export function downloadFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
