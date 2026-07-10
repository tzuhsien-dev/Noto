import { isDueToday, isOverdue } from './dates'
import type { Task, Priority } from './types'

export function isActive(task: Task): boolean {
  return !task.deletedAt
}

export function isOpen(task: Task): boolean {
  return isActive(task) && !task.completed
}

/** Inbox: open tasks not assigned to any project. */
export function inboxTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => isOpen(t) && !t.projectId)
}

/** Today view: open tasks due today plus overdue open tasks. */
export function todayTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return tasks.filter((t) => isOpen(t) && (isDueToday(t, now) || isOverdue(t, now)))
}

export function completedTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => isActive(t) && t.completed)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
}

export function projectTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => isOpen(t) && t.projectId === projectId)
}

export function openCountByProject(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (!isOpen(t) || !t.projectId) continue
    counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1)
  }
  return counts
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 }

/** Default list order: due date (nulls last), then priority, then created. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt.localeCompare(b.dueAt)
    if (a.dueAt !== b.dueAt) return a.dueAt ? -1 : 1
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (p !== 0) return p
    return a.createdAt.localeCompare(b.createdAt)
  })
}
