import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import type { AllTasksGroups } from '@/domain/grouping'
import type { Tag, Task } from '@/domain/types'
import { useTags, useTaskTagIds } from '@/features/data/hooks'
import { SelectionToolbar, useTaskSelection } from './selection'
import { TaskDetailsDialog } from './TaskDetailsDialog'
import { TaskItem } from './TaskItem'

type GroupedTaskListProps = {
  groups: AllTasksGroups | undefined
  emptyTitle: string
  emptyDescription?: string
}

const areaHeadingClass =
  'mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'
const projectHeadingClass = 'mb-1 px-2 text-sm font-medium text-foreground'

/**
 * All Tasks view: open tasks grouped area → project → task. One selection
 * toolbar and dialog span every group; the project badge is hidden inside
 * project groups since it is implied by the heading.
 */
export function GroupedTaskList({ groups, emptyTitle, emptyDescription }: GroupedTaskListProps) {
  const tags = useTags() ?? []
  const taskTagIds = useTaskTagIds() ?? new Map<string, Set<string>>()
  const selection = useTaskSelection()
  const [openTask, setOpenTask] = useState<Task | null>(null)

  if (!groups) return <ListSkeleton />

  if (groups.areas.length === 0 && groups.noProject.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={emptyTitle}
        {...(emptyDescription ? { description: emptyDescription } : {})}
      />
    )
  }

  const tagsFor = (task: Task): Tag[] => tags.filter((t) => taskTagIds.get(task.id)?.has(t.id))

  const renderRow = (task: Task, hideProject: boolean) => (
    <TaskItem
      key={task.id}
      task={task}
      hideProject={hideProject}
      tags={tagsFor(task)}
      selectionMode={selection.selectionMode}
      selected={selection.selectedIds.has(task.id)}
      onToggleSelected={selection.toggleSelected}
      onOpen={setOpenTask}
    />
  )

  return (
    <div>
      <SelectionToolbar selection={selection} />
      <div className="space-y-6">
        {groups.areas.map((section) => (
          <section key={section.key} aria-label={section.label}>
            <h2 className={areaHeadingClass}>{section.label}</h2>
            <div className="space-y-3">
              {section.projects.map(({ project, tasks: projectTasks }) => (
                <div key={project.id}>
                  <h3 className={projectHeadingClass}>{project.name}</h3>
                  <ul className="space-y-0.5">{projectTasks.map((t) => renderRow(t, true))}</ul>
                </div>
              ))}
            </div>
          </section>
        ))}
        {groups.noProject.length > 0 ? (
          <section aria-label="No project">
            <h2 className={areaHeadingClass}>No project</h2>
            <ul className="space-y-0.5">{groups.noProject.map((t) => renderRow(t, false))}</ul>
          </section>
        ) : null}
      </div>
      <TaskDetailsDialog task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}
