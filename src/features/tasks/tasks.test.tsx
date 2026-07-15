import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/database'
import { createTask, setTaskCompleted } from '@/db/repo/tasks'
import { renderWithProviders, resetDb } from '@/test/utils'
import { FAKE_USER } from '@/lib/backend/fake'
import { QuickAdd } from './QuickAdd'
import { TaskList } from './TaskList'
import { completeTaskWithUndo, completeTasksWithUndo, deleteTaskWithUndo } from './task-actions'
import { useTasks } from '@/features/data/hooks'
import { sortTasks, isOpen } from '@/domain/filters'

afterEach(resetDb)

function OpenTaskList() {
  const tasks = useTasks()
  return <TaskList tasks={tasks && sortTasks(tasks.filter(isOpen))} emptyTitle="No open tasks" />
}

function TaskListAll() {
  const tasks = useTasks()
  return <TaskList tasks={tasks && sortTasks(tasks)} emptyTitle="No tasks" />
}

describe('QuickAdd', () => {
  it('creates a task on Enter and clears the field', async () => {
    const user = userEvent.setup()
    renderWithProviders(<QuickAdd />)
    const input = await screen.findByLabelText('Add a task')
    await user.type(input, 'Buy milk{Enter}')
    await waitFor(async () => {
      expect(await db.tasks.count()).toBe(1)
    })
    const task = (await db.tasks.toArray())[0]
    expect(task?.title).toBe('Buy milk')
    expect(task?.userId).toBe(FAKE_USER.id)
    expect(input).toHaveValue('')
    // The write is queued for sync.
    expect(await db.pending_mutations.count()).toBe(1)
  })

  it('ignores blank input', async () => {
    const user = userEvent.setup()
    renderWithProviders(<QuickAdd />)
    const input = await screen.findByLabelText('Add a task')
    await user.type(input, '   {Enter}')
    expect(await db.tasks.count()).toBe(0)
  })
})

describe('TaskList completion', () => {
  it('marks a task completed via its checkbox', async () => {
    const user = userEvent.setup()
    const task = await createTask({ userId: FAKE_USER.id, title: 'Water plants' })
    renderWithProviders(<OpenTaskList />)
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Mark Water plants as done',
    })
    await user.click(checkbox)
    await waitFor(async () => {
      const updated = await db.tasks.get(task.id)
      expect(updated?.completed).toBe(true)
      expect(updated?.completedAt).not.toBeNull()
    })
    // Completed tasks leave the open list (the row is a button; the
    // completion toast's description also carries the title, so query by role).
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Water plants/ })).not.toBeInTheDocument()
    })
    expect(screen.getByText('Task completed')).toBeInTheDocument()
  })

  it('does not toast when un-completing', async () => {
    const user = userEvent.setup()
    const task = await createTask({ userId: FAKE_USER.id, title: 'Water plants' })
    await setTaskCompleted(task.id, true)
    renderWithProviders(<TaskListAll />)
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Mark Water plants as not done',
    })
    await user.click(checkbox)
    await waitFor(async () => {
      expect((await db.tasks.get(task.id))?.completed).toBe(false)
    })
    expect(screen.queryByText('Task completed')).not.toBeInTheDocument()
  })
})

describe('TaskList empty state', () => {
  it('shows the empty message when there are no tasks', async () => {
    renderWithProviders(<OpenTaskList />)
    expect(await screen.findByText('No open tasks')).toBeInTheDocument()
  })
})

describe('delete with undo', () => {
  it('soft-deletes and restores from the toast action', async () => {
    const user = userEvent.setup()
    const task = await createTask({ userId: FAKE_USER.id, title: 'Ephemeral' })
    renderWithProviders(<OpenTaskList />)
    await screen.findByText('Ephemeral')

    await deleteTaskWithUndo(task.id, task.title)
    await waitFor(async () => {
      expect((await db.tasks.get(task.id))?.deletedAt).not.toBeNull()
    })

    const undo = await screen.findByRole('button', { name: 'Undo' })
    await user.click(undo)
    await waitFor(async () => {
      expect((await db.tasks.get(task.id))?.deletedAt).toBeNull()
    })
    expect(await screen.findByText('Ephemeral')).toBeInTheDocument()
  })
})

describe('complete with undo', () => {
  it('completes and un-completes from the toast action', async () => {
    const user = userEvent.setup()
    const task = await createTask({ userId: FAKE_USER.id, title: 'Fleeting' })
    renderWithProviders(<OpenTaskList />)
    await screen.findByRole('button', { name: /Fleeting/ })

    await completeTaskWithUndo(task.id, task.title)
    await waitFor(async () => {
      const updated = await db.tasks.get(task.id)
      expect(updated?.completed).toBe(true)
      expect(updated?.completedAt).not.toBeNull()
    })

    const undo = await screen.findByRole('button', { name: 'Undo' })
    await user.click(undo)
    await waitFor(async () => {
      const updated = await db.tasks.get(task.id)
      expect(updated?.completed).toBe(false)
      expect(updated?.completedAt).toBeNull()
    })
    expect(await screen.findByRole('button', { name: /Fleeting/ })).toBeInTheDocument()
  })

  it('completes in bulk with a count toast', async () => {
    const a = await createTask({ userId: FAKE_USER.id, title: 'Bulk A' })
    const b = await createTask({ userId: FAKE_USER.id, title: 'Bulk B' })
    renderWithProviders(<OpenTaskList />)
    await screen.findByRole('button', { name: /Bulk A/ })

    await completeTasksWithUndo([a.id, b.id])
    await waitFor(async () => {
      expect((await db.tasks.get(a.id))?.completed).toBe(true)
      expect((await db.tasks.get(b.id))?.completed).toBe(true)
    })
    expect(await screen.findByText('2 tasks completed')).toBeInTheDocument()
  })
})
