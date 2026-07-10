import { db, type NotoDatabase } from '../database'
import { enqueueMutation } from '../queue'
import type { Priority, Task } from '@/domain/types'
import { newId, nowIso } from '@/domain/types'

export type NewTask = {
  userId: string
  title: string
  description?: string | null
  priority?: Priority
  dueAt?: string | null
  startAt?: string | null
  projectId?: string | null
}

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'priority' | 'dueAt' | 'startAt' | 'projectId' | 'completed'>
>

export async function createTask(input: NewTask, database: NotoDatabase = db): Promise<Task> {
  const now = nowIso()
  const task: Task = {
    id: newId(),
    userId: input.userId,
    title: input.title,
    description: input.description ?? null,
    completed: false,
    priority: input.priority ?? 'none',
    dueAt: input.dueAt ?? null,
    startAt: input.startAt ?? null,
    projectId: input.projectId ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deletedAt: null,
    version: 1,
  }
  await database.transaction('rw', [database.tasks, database.pending_mutations], async () => {
    await database.tasks.add(task)
    await enqueueMutation(database, {
      entityType: 'task',
      entityId: task.id,
      operation: 'insert',
      payload: task,
      baseVersion: task.version,
    })
  })
  return task
}

async function applyTaskUpdate(
  id: string,
  mutate: (task: Task) => Task,
  database: NotoDatabase = db,
): Promise<Task | undefined> {
  return database.transaction('rw', [database.tasks, database.pending_mutations], async () => {
    const current = await database.tasks.get(id)
    if (!current) return undefined
    const updated = { ...mutate(current), updatedAt: nowIso() }
    await database.tasks.put(updated)
    await enqueueMutation(database, {
      entityType: 'task',
      entityId: id,
      operation: 'update',
      payload: updated,
      baseVersion: current.version,
    })
    return updated
  })
}

export async function updateTask(
  id: string,
  patch: TaskPatch,
  database: NotoDatabase = db,
): Promise<Task | undefined> {
  return applyTaskUpdate(id, (task) => ({ ...task, ...patch }), database)
}

export async function setTaskCompleted(
  id: string,
  completed: boolean,
  database: NotoDatabase = db,
): Promise<Task | undefined> {
  return applyTaskUpdate(
    id,
    (task) => ({ ...task, completed, completedAt: completed ? nowIso() : null }),
    database,
  )
}

export async function softDeleteTask(
  id: string,
  database: NotoDatabase = db,
): Promise<Task | undefined> {
  return applyTaskUpdate(id, (task) => ({ ...task, deletedAt: nowIso() }), database)
}

export async function restoreTask(
  id: string,
  database: NotoDatabase = db,
): Promise<Task | undefined> {
  return applyTaskUpdate(id, (task) => ({ ...task, deletedAt: null }), database)
}

export async function permanentlyDeleteTask(
  id: string,
  database: NotoDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.tasks, database.task_tags, database.pending_mutations],
    async () => {
      const current = await database.tasks.get(id)
      if (!current) return
      await database.tasks.delete(id)
      await database.task_tags.where('taskId').equals(id).delete()
      await enqueueMutation(database, {
        entityType: 'task',
        entityId: id,
        operation: 'delete',
        payload: { id },
        baseVersion: current.version,
      })
    },
  )
}

export async function setTasksCompleted(
  ids: string[],
  completed: boolean,
  database: NotoDatabase = db,
): Promise<void> {
  for (const id of ids) await setTaskCompleted(id, completed, database)
}

export async function softDeleteTasks(ids: string[], database: NotoDatabase = db): Promise<void> {
  for (const id of ids) await softDeleteTask(id, database)
}

export async function restoreTasks(ids: string[], database: NotoDatabase = db): Promise<void> {
  for (const id of ids) await restoreTask(id, database)
}
