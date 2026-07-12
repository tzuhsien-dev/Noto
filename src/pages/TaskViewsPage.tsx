import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { formatDayHeading } from '@/domain/dates'
import {
  completedTasks,
  groupByPriority,
  inboxTasks,
  sortTasks,
  todayTasks,
} from '@/domain/filters'
import { groupUpcoming } from '@/domain/dates'
import { groupTasksByAreaProject } from '@/domain/grouping'
import { useAreas, useProjects, useTasks } from '@/features/data/hooks'
import { QuickAdd } from '@/features/tasks/QuickAdd'
import { TaskList } from '@/features/tasks/TaskList'
import { GroupedTaskList } from '@/features/tasks/GroupedTaskList'

export function TodayPage() {
  const tasks = useTasks()
  return (
    <PageContainer>
      <PageHeader title="Today" />
      <QuickAdd defaultDueAt={new Date().toISOString()} placeholder="Add a task due today…" />
      <TaskList
        tasks={tasks && sortTasks(todayTasks(tasks))}
        emptyTitle="Nothing due today"
        emptyDescription="Tasks due today and overdue tasks show up here."
      />
    </PageContainer>
  )
}

export function InboxPage() {
  const tasks = useTasks()
  return (
    <PageContainer>
      <PageHeader title="Inbox" />
      <QuickAdd />
      <TaskList
        tasks={tasks && sortTasks(inboxTasks(tasks))}
        emptyTitle="Inbox zero"
        emptyDescription="Tasks without a project land here."
      />
    </PageContainer>
  )
}

export function AllTasksPage() {
  const tasks = useTasks()
  const projects = useProjects()
  const areas = useAreas()
  const groups =
    tasks && projects && areas ? groupTasksByAreaProject(tasks, projects, areas) : undefined
  return (
    <PageContainer>
      <PageHeader title="All Tasks" />
      <QuickAdd />
      <GroupedTaskList
        groups={groups}
        emptyTitle="No open tasks"
        emptyDescription="Add your first task above."
      />
    </PageContainer>
  )
}

export function PriorityPage() {
  const tasks = useTasks()
  const groups = tasks ? groupByPriority(tasks) : undefined
  return (
    <PageContainer>
      <PageHeader title="Priority" />
      {groups && groups.length > 0 ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.priority} aria-label={group.priority}>
              <h2 className="mb-1 text-sm font-medium text-muted-foreground capitalize">
                {group.priority}
              </h2>
              <TaskList tasks={group.tasks} emptyTitle="" />
            </section>
          ))}
        </div>
      ) : (
        <TaskList
          tasks={groups && []}
          emptyTitle="No prioritized tasks"
          emptyDescription="Set a task's priority to High, Medium, or Low to see it here."
        />
      )}
    </PageContainer>
  )
}

export function CompletedPage() {
  const tasks = useTasks()
  return (
    <PageContainer>
      <PageHeader title="Completed" />
      <TaskList
        tasks={tasks && completedTasks(tasks)}
        emptyTitle="Nothing completed yet"
        emptyDescription="Completed tasks appear here."
      />
    </PageContainer>
  )
}

export function UpcomingPage() {
  const tasks = useTasks()
  const [days, setDays] = useState<7 | 30>(7)
  const groups = tasks ? groupUpcoming(tasks, days) : []

  return (
    <PageContainer>
      <PageHeader
        title="Upcoming"
        actions={
          <div className="flex gap-1" role="group" aria-label="Range">
            <Button
              size="sm"
              variant={days === 7 ? 'secondary' : 'ghost'}
              onClick={() => setDays(7)}
              aria-pressed={days === 7}
            >
              7 days
            </Button>
            <Button
              size="sm"
              variant={days === 30 ? 'secondary' : 'ghost'}
              onClick={() => setDays(30)}
              aria-pressed={days === 30}
            >
              30 days
            </Button>
          </div>
        }
      />
      <QuickAdd />
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.key} aria-label={formatDayHeading(group.date)}>
            <h2 className="mb-1 text-sm font-medium text-muted-foreground">
              {formatDayHeading(group.date)}
            </h2>
            {group.tasks.length ? (
              <TaskList tasks={sortTasks(group.tasks)} emptyTitle="" />
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                No tasks
              </p>
            )}
          </section>
        ))}
      </div>
    </PageContainer>
  )
}
