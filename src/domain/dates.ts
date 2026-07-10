import {
  addDays,
  format,
  formatDistanceToNow,
  isBefore,
  isSameDay,
  isToday as fnsIsToday,
  startOfDay,
} from 'date-fns'
import type { Task } from './types'

/** Task is due today in the device's local timezone. */
export function isDueToday(task: Task, now: Date = new Date()): boolean {
  if (!task.dueAt) return false
  return isSameDay(new Date(task.dueAt), now)
}

/** Task's due date is in the past (before today) and it is not completed. */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (!task.dueAt || task.completed) return false
  return isBefore(new Date(task.dueAt), startOfDay(now))
}

export function isToday(date: Date | string): boolean {
  return fnsIsToday(typeof date === 'string' ? new Date(date) : date)
}

/** Local-date key used for grouping (not UTC — grouping is a UI concern). */
export function dayKey(date: Date | string): string {
  return format(typeof date === 'string' ? new Date(date) : date, 'yyyy-MM-dd')
}

export type UpcomingGroup = {
  key: string
  date: Date
  tasks: Task[]
}

/**
 * Group incomplete tasks due within the next `days` days (starting tomorrow)
 * into one bucket per day. Days without tasks are included so the view can
 * render a stable timeline.
 */
export function groupUpcoming(
  tasks: Task[],
  days: number,
  now: Date = new Date(),
): UpcomingGroup[] {
  const groups: UpcomingGroup[] = []
  for (let i = 1; i <= days; i++) {
    const date = startOfDay(addDays(now, i))
    groups.push({ key: dayKey(date), date, tasks: [] })
  }
  const byKey = new Map(groups.map((g) => [g.key, g]))
  for (const task of tasks) {
    if (!task.dueAt || task.completed || task.deletedAt) continue
    const group = byKey.get(dayKey(task.dueAt))
    if (group) group.tasks.push(task)
  }
  return groups
}

export function formatDueDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (isSameDay(date, now)) return 'Today'
  if (isSameDay(date, addDays(now, 1))) return 'Tomorrow'
  if (isSameDay(date, addDays(now, -1))) return 'Yesterday'
  return format(date, date.getFullYear() === now.getFullYear() ? 'EEE, MMM d' : 'MMM d, yyyy')
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export function formatDayHeading(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, addDays(now, 1))) return `Tomorrow · ${format(date, 'EEE, MMM d')}`
  return format(date, 'EEEE · MMM d')
}

/** Convert a `<input type="date">` value (yyyy-MM-dd) to an ISO timestamp at local midnight. */
export function dateInputToIso(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toISOString()
}

/** Convert an ISO timestamp to a `<input type="date">` value in local time. */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  return format(new Date(iso), 'yyyy-MM-dd')
}
