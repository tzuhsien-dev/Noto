import { describe, expect, it } from 'vitest'
import {
  completedTasks,
  importantTasks,
  inboxTasks,
  openCountByProject,
  sortTasks,
  todayTasks,
} from './filters'
import type { Task } from './types'

const NOW = new Date(2026, 6, 10, 12, 0, 0)

let counter = 0
function task(overrides: Partial<Task>): Task {
  counter += 1
  return {
    id: crypto.randomUUID(),
    userId: '00000000-0000-4000-8000-0000000000aa',
    title: `Task ${counter}`,
    description: null,
    completed: false,
    priority: 'none',
    dueAt: null,
    startAt: null,
    projectId: null,
    createdAt: new Date(2026, 0, 1, 0, 0, counter).toISOString(),
    updatedAt: NOW.toISOString(),
    completedAt: null,
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

describe('inboxTasks', () => {
  it('keeps only open tasks without a project', () => {
    const inInbox = task({})
    const withProject = task({ projectId: crypto.randomUUID() })
    const completed = task({ completed: true })
    const deleted = task({ deletedAt: NOW.toISOString() })
    expect(inboxTasks([inInbox, withProject, completed, deleted])).toEqual([inInbox])
  })
})

describe('todayTasks', () => {
  it('includes due-today and overdue, excludes completed and future', () => {
    const dueToday = task({ dueAt: new Date(2026, 6, 10, 17).toISOString() })
    const overdue = task({ dueAt: new Date(2026, 6, 1).toISOString() })
    const overdueDone = task({ dueAt: new Date(2026, 6, 1).toISOString(), completed: true })
    const future = task({ dueAt: new Date(2026, 6, 20).toISOString() })
    const noDue = task({})
    const result = todayTasks([dueToday, overdue, overdueDone, future, noDue], NOW)
    expect(result).toEqual([dueToday, overdue])
  })
})

describe('importantTasks', () => {
  it('keeps only open high-priority tasks', () => {
    const high = task({ priority: 'high' })
    const medium = task({ priority: 'medium' })
    const highDone = task({ priority: 'high', completed: true })
    const highDeleted = task({ priority: 'high', deletedAt: NOW.toISOString() })
    expect(importantTasks([high, medium, highDone, highDeleted])).toEqual([high])
  })
})

describe('completedTasks', () => {
  it('returns completed non-deleted tasks, most recently completed first', () => {
    const a = task({ completed: true, completedAt: new Date(2026, 6, 1).toISOString() })
    const b = task({ completed: true, completedAt: new Date(2026, 6, 5).toISOString() })
    const deleted = task({ completed: true, deletedAt: NOW.toISOString() })
    expect(completedTasks([a, b, deleted])).toEqual([b, a])
  })
})

describe('openCountByProject', () => {
  it('counts open tasks per project', () => {
    const p1 = crypto.randomUUID()
    const p2 = crypto.randomUUID()
    const tasks = [
      task({ projectId: p1 }),
      task({ projectId: p1 }),
      task({ projectId: p1, completed: true }),
      task({ projectId: p2 }),
      task({}),
    ]
    const counts = openCountByProject(tasks)
    expect(counts.get(p1)).toBe(2)
    expect(counts.get(p2)).toBe(1)
  })
})

describe('sortTasks', () => {
  it('sorts by due date, then priority, then creation', () => {
    const dueSoon = task({ dueAt: new Date(2026, 6, 11).toISOString() })
    const dueLater = task({ dueAt: new Date(2026, 6, 15).toISOString() })
    const highNoDue = task({ priority: 'high' })
    const lowNoDue = task({ priority: 'low' })
    expect(sortTasks([lowNoDue, dueLater, highNoDue, dueSoon])).toEqual([
      dueSoon,
      dueLater,
      highNoDue,
      lowNoDue,
    ])
  })
})
