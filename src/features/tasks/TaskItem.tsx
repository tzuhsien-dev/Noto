import { CalendarDays, Flag, Folder } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDueDate, isOverdue } from '@/domain/dates'
import type { Priority, Project, Tag, Task } from '@/domain/types'
import { setTaskCompleted } from '@/db/repo/tasks'
import { cn } from '@/lib/utils'

const priorityColor: Record<Priority, string> = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-blue-500',
  none: '',
}

type TaskItemProps = {
  task: Task
  project?: Project | undefined
  tags?: Tag[]
  /** Hide the project badge (e.g. when already grouped under its project). */
  hideProject?: boolean
  selectionMode?: boolean
  selected?: boolean
  onToggleSelected?: (id: string) => void
  onOpen: (task: Task) => void
}

export function TaskItem({
  task,
  project,
  tags = [],
  hideProject = false,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  onOpen,
}: TaskItemProps) {
  const overdue = isOverdue(task)

  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-md border border-transparent px-2 py-2',
        'hover:bg-accent/50',
        selected && 'border-primary/40 bg-accent/60',
      )}
    >
      {selectionMode ? (
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={selected}
          onChange={() => onToggleSelected?.(task.id)}
          aria-label={`Select ${task.title}`}
        />
      ) : (
        <Checkbox
          className="mt-0.5"
          checked={task.completed}
          onCheckedChange={(checked) => void setTaskCompleted(task.id, checked === true)}
          aria-label={
            task.completed ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`
          }
        />
      )}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => (selectionMode ? onToggleSelected?.(task.id) : onOpen(task))}
      >
        <span
          className={cn(
            'block truncate text-sm',
            task.completed && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </span>
        {task.description ? (
          <span className="block truncate text-xs text-muted-foreground">{task.description}</span>
        ) : null}
        {(task.dueAt || task.priority !== 'none' || (!hideProject && project) || tags.length > 0) && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.dueAt ? (
              <Badge variant={overdue ? 'destructive' : 'outline'}>
                <CalendarDays className="h-3 w-3" aria-hidden />
                {formatDueDate(task.dueAt)}
              </Badge>
            ) : null}
            {task.priority !== 'none' ? (
              <Badge>
                <Flag className={cn('h-3 w-3', priorityColor[task.priority])} aria-hidden />
                {task.priority}
              </Badge>
            ) : null}
            {!hideProject && project ? (
              <Badge>
                <Folder className="h-3 w-3" aria-hidden />
                {project.name}
              </Badge>
            ) : null}
            {tags.map((tag) => (
              <Badge key={tag.id} variant="default">
                {tag.name}
              </Badge>
            ))}
          </span>
        )}
      </button>
    </li>
  )
}
