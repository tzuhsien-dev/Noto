import { db, type NotoDatabase } from '../database'
import { enqueueMutation } from '../queue'
import type { Project } from '@/domain/types'
import { newId, nowIso } from '@/domain/types'

export async function createProject(
  input: { userId: string; name: string; icon?: string | null },
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

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'icon' | 'archived' | 'position'>>,
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
