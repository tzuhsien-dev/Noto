import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/database'
import { createTask } from '@/db/repo/tasks'
import { renderWithProviders, resetDb } from '@/test/utils'
import { FAKE_USER } from '@/lib/backend/fake'
import { QuickAdd } from './QuickAdd'
import { TaskList } from './TaskList'
import { deleteTaskWithUndo } from './task-actions'
import { useTasks } from '@/features/data/hooks'
import { sortTasks, isOpen } from '@/domain/filters'

afterEach(resetDb)

function OpenTaskList() {
  const tasks = useTasks()
  return <TaskList tasks={tasks && sortTasks(tasks.filter(isOpen))} emptyTitle="No open tasks" />
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
    // Completed tasks leave the open list.
    await waitFor(() => {
      expect(screen.queryByText('Water plants')).not.toBeInTheDocument()
    })
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
