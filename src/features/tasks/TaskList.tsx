import { useState } from 'react'
import { CheckSquare, ListChecks, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import type { Task } from '@/domain/types'
import { setTasksCompleted } from '@/db/repo/tasks'
import { useProjects, useTags, useTaskTagIds } from '@/features/data/hooks'
import { deleteTasksWithUndo } from './task-actions'
import { TaskDetailsDialog } from './TaskDetailsDialog'
import { TaskItem } from './TaskItem'

type TaskListProps = {
  tasks: Task[] | undefined
  emptyTitle: string
  emptyDescription?: string
}

export function TaskList({ tasks, emptyTitle, emptyDescription }: TaskListProps) {
  const projects = useProjects() ?? []
  const tags = useTags() ?? []
  const taskTagIds = useTaskTagIds() ?? new Map<string, Set<string>>()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openTask, setOpenTask] = useState<Task | null>(null)

  if (!tasks) return <ListSkeleton />

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={emptyTitle}
        {...(emptyDescription ? { description: emptyDescription } : {})}
      />
    )
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const selectedList = [...selectedIds]

  return (
    <div>
      <div className="mb-2 flex min-h-9 items-center justify-end gap-2">
        {selectionMode ? (
          <>
            <span className="mr-auto text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedIds.size}
              onClick={() => {
                void setTasksCompleted(selectedList, true)
                exitSelection()
              }}
            >
              <CheckSquare className="h-4 w-4" aria-hidden /> Complete
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!selectedIds.size}
              onClick={() => {
                void deleteTasksWithUndo(selectedList)
                exitSelection()
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelection} aria-label="Cancel selection">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setSelectionMode(true)}>
            Select
          </Button>
        )}
      </div>
      <ul className="space-y-0.5">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            project={projects.find((p) => p.id === task.projectId)}
            tags={tags.filter((t) => taskTagIds.get(task.id)?.has(t.id))}
            selectionMode={selectionMode}
            selected={selectedIds.has(task.id)}
            onToggleSelected={toggleSelected}
            onOpen={setOpenTask}
          />
        ))}
      </ul>
      <TaskDetailsDialog task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}
