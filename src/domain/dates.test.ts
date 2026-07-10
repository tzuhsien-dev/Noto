import { describe, expect, it } from 'vitest'
import {
  dateInputToIso,
  formatDueDate,
  groupUpcoming,
  isDueToday,
  isOverdue,
  isoToDateInput,
} from './dates'
import type { Task } from './types'

const NOW = new Date(2026, 6, 10, 12, 0, 0) // local Fri Jul 10 2026, noon

function task(overrides: Partial<Task>): Task {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-0000000000aa',
    title: 'A task',
    description: null,
    completed: false,
    priority: 'none',
    dueAt: null,
    startAt: null,
    projectId: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    completedAt: null,
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

describe('isDueToday', () => {
  it('is true for a task due later today (local time)', () => {
    expect(isDueToday(task({ dueAt: new Date(2026, 6, 10, 23, 30).toISOString() }), NOW)).toBe(true)
  })
  it('is false with no due date', () => {
    expect(isDueToday(task({}), NOW)).toBe(false)
  })
  it('is false for tomorrow', () => {
    expect(isDueToday(task({ dueAt: new Date(2026, 6, 11, 0, 30).toISOString() }), NOW)).toBe(false)
  })
})

describe('isOverdue', () => {
  it('is true for an open task due yesterday', () => {
    expect(isOverdue(task({ dueAt: new Date(2026, 6, 9).toISOString() }), NOW)).toBe(true)
  })
  it('is false for a completed task due yesterday', () => {
    expect(
      isOverdue(task({ dueAt: new Date(2026, 6, 9).toISOString(), completed: true }), NOW),
    ).toBe(false)
  })
  it('is false when due earlier today (due today, not overdue)', () => {
    expect(isOverdue(task({ dueAt: new Date(2026, 6, 10, 8, 0).toISOString() }), NOW)).toBe(false)
  })
})

describe('groupUpcoming', () => {
  it('creates one group per day starting tomorrow', () => {
    const groups = groupUpcoming([], 7, NOW)
    expect(groups).toHaveLength(7)
    expect(groups[0]?.key).toBe('2026-07-11')
    expect(groups[6]?.key).toBe('2026-07-17')
  })
  it('buckets tasks into the right local day and skips completed/deleted/out-of-range', () => {
    const inRange = task({ id: crypto.randomUUID(), dueAt: new Date(2026, 6, 12, 9).toISOString() })
    const done = task({
      id: crypto.randomUUID(),
      dueAt: new Date(2026, 6, 12).toISOString(),
      completed: true,
    })
    const deleted = task({
      id: crypto.randomUUID(),
      dueAt: new Date(2026, 6, 12).toISOString(),
      deletedAt: NOW.toISOString(),
    })
    const farAway = task({ id: crypto.randomUUID(), dueAt: new Date(2026, 7, 20).toISOString() })
    const groups = groupUpcoming([inRange, done, deleted, farAway], 7, NOW)
    const day = groups.find((g) => g.key === '2026-07-12')
    expect(day?.tasks).toEqual([inRange])
    expect(groups.flatMap((g) => g.tasks)).toHaveLength(1)
  })
})

describe('formatDueDate', () => {
  it('renders Today / Tomorrow / Yesterday', () => {
    expect(formatDueDate(new Date(2026, 6, 10, 18).toISOString(), NOW)).toBe('Today')
    expect(formatDueDate(new Date(2026, 6, 11).toISOString(), NOW)).toBe('Tomorrow')
    expect(formatDueDate(new Date(2026, 6, 9).toISOString(), NOW)).toBe('Yesterday')
  })
  it('includes the year for other years', () => {
    expect(formatDueDate(new Date(2027, 0, 5).toISOString(), NOW)).toBe('Jan 5, 2027')
  })
})

describe('date input conversion', () => {
  it('round-trips a date input value via local midnight', () => {
    const iso = dateInputToIso('2026-07-15')
    expect(iso).not.toBeNull()
    expect(isoToDateInput(iso)).toBe('2026-07-15')
  })
  it('returns null/empty for empty values', () => {
    expect(dateInputToIso('')).toBeNull()
    expect(isoToDateInput(null)).toBe('')
  })
})
