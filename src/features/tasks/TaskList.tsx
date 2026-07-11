import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import type { Task } from '@/domain/types'
import { useProjects, useTags, useTaskTagIds } from '@/features/data/hooks'
import { SelectionToolbar, useTaskSelection } from './selection'
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
  const selection = useTaskSelection()
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

  return (
    <div>
      <SelectionToolbar selection={selection} />
      <ul className="space-y-0.5">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            project={projects.find((p) => p.id === task.projectId)}
            tags={tags.filter((t) => taskTagIds.get(task.id)?.has(t.id))}
            selectionMode={selection.selectionMode}
            selected={selection.selectedIds.has(task.id)}
            onToggleSelected={selection.toggleSelected}
            onOpen={setOpenTask}
          />
        ))}
      </ul>
      <TaskDetailsDialog task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}
