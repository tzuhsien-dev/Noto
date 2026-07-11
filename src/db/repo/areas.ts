import { db, type NotoDatabase } from '../database'
import { enqueueMutation } from '../queue'
import type { Area } from '@/domain/types'
import { newId, nowIso } from '@/domain/types'

export async function createArea(
  input: { userId: string; name: string },
  database: NotoDatabase = db,
): Promise<Area> {
  const now = nowIso()
  return database.transaction('rw', [database.areas, database.pending_mutations], async () => {
    const existing = await database.areas.toArray()
    const position = existing.length ? Math.max(...existing.map((a) => a.position)) + 1 : 0
    const area: Area = {
      id: newId(),
      userId: input.userId,
      name: input.name,
      position,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    await database.areas.add(area)
    await enqueueMutation(database, {
      entityType: 'area',
      entityId: area.id,
      operation: 'insert',
      payload: area,
      baseVersion: area.version,
    })
    return area
  })
}

export async function updateArea(
  id: string,
  patch: Partial<Pick<Area, 'name' | 'position'>>,
  database: NotoDatabase = db,
): Promise<Area | undefined> {
  return database.transaction('rw', [database.areas, database.pending_mutations], async () => {
    const current = await database.areas.get(id)
    if (!current) return undefined
    const updated = { ...current, ...patch, updatedAt: nowIso() }
    await database.areas.put(updated)
    await enqueueMutation(database, {
      entityType: 'area',
      entityId: id,
      operation: 'update',
      payload: updated,
      baseVersion: current.version,
    })
    return updated
  })
}

/** Deletes the area only — its projects become ungrouped (areaId → null). */
export async function deleteArea(id: string, database: NotoDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.areas, database.projects, database.pending_mutations],
    async () => {
      const current = await database.areas.get(id)
      if (!current) return
      // Mirror the server's `on delete set null` locally and push each move
      // (queued before the delete, so the FK is already clear server-side).
      const projects = await database.projects.where('areaId').equals(id).toArray()
      for (const project of projects) {
        const updated = { ...project, areaId: null, updatedAt: nowIso() }
        await database.projects.put(updated)
        await enqueueMutation(database, {
          entityType: 'project',
          entityId: project.id,
          operation: 'update',
          payload: updated,
          baseVersion: project.version,
        })
      }
      await database.areas.delete(id)
      await enqueueMutation(database, {
        entityType: 'area',
        entityId: id,
        operation: 'delete',
        payload: { id },
        baseVersion: current.version,
      })
    },
  )
}
