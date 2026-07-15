import { toast } from 'sonner'
import {
  restoreTask,
  restoreTasks,
  setTaskCompleted,
  setTasksCompleted,
  softDeleteTask,
  softDeleteTasks,
} from '@/db/repo/tasks'

/** Soft-delete with an Undo toast — the required affordance for deletes. */
export async function deleteTaskWithUndo(id: string, title: string): Promise<void> {
  await softDeleteTask(id)
  toast('Task deleted', {
    description: title,
    action: { label: 'Undo', onClick: () => void restoreTask(id) },
  })
}

export async function deleteTasksWithUndo(ids: string[]): Promise<void> {
  await softDeleteTasks(ids)
  toast(`${ids.length} tasks deleted`, {
    action: { label: 'Undo', onClick: () => void restoreTasks(ids) },
  })
}

/** Complete with an Undo toast — the task disappears from filtered views. */
export async function completeTaskWithUndo(id: string, title: string): Promise<void> {
  await setTaskCompleted(id, true)
  toast('Task completed', {
    description: title,
    action: { label: 'Undo', onClick: () => void setTaskCompleted(id, false) },
  })
}

export async function completeTasksWithUndo(ids: string[]): Promise<void> {
  await setTasksCompleted(ids, true)
  toast(`${ids.length} tasks completed`, {
    action: { label: 'Undo', onClick: () => void setTasksCompleted(ids, false) },
  })
}
