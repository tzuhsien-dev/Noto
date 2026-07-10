import { toast } from 'sonner'
import { restoreTask, restoreTasks, softDeleteTask, softDeleteTasks } from '@/db/repo/tasks'

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
