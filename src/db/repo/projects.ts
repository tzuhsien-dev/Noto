import { db, type NotoDatabase } from '../database'
import { enqueueMutation } from '../queue'
import type { Project } from '@/domain/types'
import { newId, nowIso } from '@/domain/types'

export async function createProject(
  input: { userId: string; name: string; icon?: string | null; areaId?: string | null },
  database: NotoDatabase = db,
): Promise<Project> {
  const now = nowIso()
  return database.transaction('rw', [database.projects, database.pending_mutations], async () => {
    const existing = await database.projects.toArray()
    const position = existing.length ? Math.max(...existing.map((p) => p.position)) + 1 : 0
    const project: Project = {
      id: newId(),
      userId: input.userId,
      name: input.name,
      icon: input.icon ?? null,
      position,
      areaId: input.areaId ?? null,
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    await database.projects.add(project)
    await enqueueMutation(database, {
      entityType: 'project',
      entityId: project.id,
      operation: 'insert',
      payload: project,
      baseVersion: project.version,
    })
    return project
  })
}

/**
 * Deletes the project; its tasks are soft-deleted into Trash and ungrouped
 * (projectId → null, matching the server FK) so restoring lands in Inbox.
 * Returns the number of tasks moved to Trash.
 */
export async function deleteProject(id: string, database: NotoDatabase = db): Promise<number> {
  return database.transaction(
    'rw',
    [database.projects, database.tasks, database.pending_mutations],
    async () => {
      const current = await database.projects.get(id)
      if (!current) return 0
      const now = nowIso()
      const tasks = await database.tasks.where('projectId').equals(id).toArray()
      let trashed = 0
      // Ungroup before the project delete is pushed, so the server FK's
      // `set null` never races a task update.
      for (const task of tasks) {
        if (!task.deletedAt) trashed += 1
        const updated = {
          ...task,
          projectId: null,
          deletedAt: task.deletedAt ?? now,
          updatedAt: now,
        }
        await database.tasks.put(updated)
        await enqueueMutation(database, {
          entityType: 'task',
          entityId: task.id,
          operation: 'update',
          payload: updated,
          baseVersion: task.version,
        })
      }
      await database.projects.delete(id)
      await enqueueMutation(database, {
        entityType: 'project',
        entityId: id,
        operation: 'delete',
        payload: { id },
        baseVersion: current.version,
      })
      return trashed
    },
  )
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'icon' | 'archived' | 'position' | 'areaId'>>,
  database: NotoDatabase = db,
): Promise<Project | undefined> {
  return database.transaction('rw', [database.projects, database.pending_mutations], async () => {
    const current = await database.projects.get(id)
    if (!current) return undefined
    const updated = { ...current, ...patch, updatedAt: nowIso() }
    await database.projects.put(updated)
    await enqueueMutation(database, {
      entityType: 'project',
      entityId: id,
      operation: 'update',
      payload: updated,
      baseVersion: current.version,
    })
    return updated
  })
}
