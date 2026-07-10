import { beforeEach, describe, expect, it } from 'vitest'
import { NotoDatabase } from '@/db/database'
import { createNote, addChecklistItem } from '@/db/repo/notes'
import { createTask } from '@/db/repo/tasks'
import { createTag, setTaskTags } from '@/db/repo/tags'
import {
  buildExport,
  buildMarkdownExport,
  EXPORT_SCHEMA_VERSION,
  mergeImport,
  validateImport,
} from './export-import'

const USER_A = '00000000-0000-4000-8000-0000000000aa'
const USER_B = '00000000-0000-4000-8000-0000000000bb'

let db: NotoDatabase
let counter = 100

beforeEach(() => {
  counter += 1
  db = new NotoDatabase(`noto-export-test-${counter}`)
})

describe('export', () => {
  it('includes the schema version and all entity collections', async () => {
    await createTask({ userId: USER_A, title: 'Task one' }, db)
    const note = await createNote({ userId: USER_A, title: 'Note one' }, db)
    await addChecklistItem({ noteId: note.id, userId: USER_A, content: 'Item' }, db)

    const file = await buildExport(db)
    expect(file.schemaVersion).toBe(EXPORT_SCHEMA_VERSION)
    expect(file.app).toBe('noto')
    expect(file.data.tasks).toHaveLength(1)
    expect(file.data.notes).toHaveLength(1)
    expect(file.data.checklistItems).toHaveLength(1)
    expect(file.data.projects).toEqual([])
  })

  it('renders a Markdown export with tasks and notes', async () => {
    await createTask({ userId: USER_A, title: 'Write report', priority: 'high' }, db)
    await createNote({ userId: USER_A, title: 'Meeting notes', content: 'Discussed things.' }, db)
    const markdown = await buildMarkdownExport(db)
    expect(markdown).toContain('- [ ] Write report [high]')
    expect(markdown).toContain('### Meeting notes')
    expect(markdown).toContain('Discussed things.')
  })
})

describe('import validation', () => {
  it('rejects non-JSON input', async () => {
    await expect(validateImport('not json', db)).rejects.toThrow('not valid JSON')
  })

  it('rejects JSON that is not a Noto export', async () => {
    await expect(validateImport('{"foo": 1}', db)).rejects.toThrow('not a Noto export')
  })

  it('rejects exports from a newer schema version', async () => {
    const file = await buildExport(db)
    const tampered = { ...file, schemaVersion: 999 }
    await expect(validateImport(JSON.stringify(tampered), db)).rejects.toThrow()
  })

  it('previews how many rows are new', async () => {
    const existing = await createTask({ userId: USER_A, title: 'Existing' }, db)
    const other = new NotoDatabase(`noto-export-src-${counter}`)
    await createTask({ userId: USER_A, title: 'Existing', ...{} }, other)
    const file = await buildExport(other)
    // Make one row share the ID with the local task.
    file.data.tasks[0]!.id = existing.id
    file.data.tasks.push({ ...file.data.tasks[0]!, id: crypto.randomUUID(), title: 'Fresh' })

    const preview = await validateImport(JSON.stringify(file), db)
    expect(preview.counts.tasks).toEqual({ total: 2, new: 1 })
  })
})

describe('merge import', () => {
  it('adds new rows, keeps existing rows untouched, and re-owns data', async () => {
    const local = await createTask({ userId: USER_A, title: 'Local truth' }, db)

    const source = new NotoDatabase(`noto-export-merge-${counter}`)
    const importedTask = await createTask({ userId: USER_B, title: 'Imported task' }, source)
    const tag = await createTag({ userId: USER_B, name: 'imported' }, source)
    await setTaskTags(importedTask.id, USER_B, [tag.id], source)
    const file = await buildExport(source)
    // Simulate an ID collision: the export also contains "our" task with other content.
    file.data.tasks.push({ ...importedTask, id: local.id, title: 'Should not overwrite' })

    const imported = await mergeImport(file, USER_A, db)

    expect((await db.tasks.get(local.id))?.title).toBe('Local truth')
    const titles = (await db.tasks.toArray()).map((t) => t.title).sort()
    expect(titles).toEqual(['Imported task', 'Local truth'])
    expect((await db.tasks.get(importedTask.id))?.userId).toBe(USER_A)
    expect(await db.task_tags.count()).toBe(1)
    expect(imported).toBeGreaterThan(0)
    // Imported rows are queued for sync.
    const pendingIds = (await db.pending_mutations.toArray()).map((m) => m.entityId)
    expect(pendingIds).toContain(importedTask.id)
  })

  it('stores a pre-import snapshot for recovery', async () => {
    await createTask({ userId: USER_A, title: 'Before import' }, db)
    const source = new NotoDatabase(`noto-export-snap-${counter}`)
    await createTask({ userId: USER_B, title: 'New via import' }, source)
    await mergeImport(await buildExport(source), USER_A, db)

    const metas = await db.sync_meta.toArray()
    const snapshot = metas.find((m) => m.key.startsWith('importSnapshot:'))
    expect(snapshot).toBeDefined()
    const parsed = JSON.parse(snapshot!.value) as { data: { tasks: { title: string }[] } }
    expect(parsed.data.tasks.map((t) => t.title)).toEqual(['Before import'])
  })

  it('skips orphan checklist items and join rows', async () => {
    const source = new NotoDatabase(`noto-export-orphan-${counter}`)
    const note = await createNote({ userId: USER_B, title: 'Parent' }, source)
    await addChecklistItem({ noteId: note.id, userId: USER_B, content: 'ok' }, source)
    const file = await buildExport(source)
    // Corrupt: point the checklist item at a missing note.
    file.data.checklistItems[0]!.noteId = crypto.randomUUID()

    await mergeImport(file, USER_A, db)
    expect(await db.checklist_items.count()).toBe(0)
    expect(await db.notes.count()).toBe(1)
  })
})
