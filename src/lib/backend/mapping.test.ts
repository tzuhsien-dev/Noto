import { describe, expect, it } from 'vitest'
import { toCamelRow, toSnakeRow } from './mapping'

describe('row mapping', () => {
  it('maps domain rows to snake_case for PostgreSQL', () => {
    expect(
      toSnakeRow({
        id: 'x',
        userId: 'u',
        dueAt: null,
        projectId: 'p',
        completedAt: '2026-07-10T00:00:00Z',
        version: 3,
      }),
    ).toEqual({
      id: 'x',
      user_id: 'u',
      due_at: null,
      project_id: 'p',
      completed_at: '2026-07-10T00:00:00Z',
      version: 3,
    })
  })

  it('maps PostgreSQL rows back to camelCase', () => {
    expect(
      toCamelRow({
        id: 'x',
        user_id: 'u',
        created_at: 'c',
        updated_at: 'u2',
        deleted_at: null,
        note_id: 'n',
      }),
    ).toEqual({
      id: 'x',
      userId: 'u',
      createdAt: 'c',
      updatedAt: 'u2',
      deletedAt: null,
      noteId: 'n',
    })
  })

  it('round-trips a full task row', () => {
    const task = {
      id: 'id',
      userId: 'u',
      title: 't',
      description: null,
      completed: false,
      priority: 'high',
      dueAt: null,
      startAt: null,
      projectId: null,
      createdAt: 'a',
      updatedAt: 'b',
      completedAt: null,
      deletedAt: null,
      version: 1,
    }
    expect(toCamelRow(toSnakeRow(task))).toEqual(task)
  })
})
