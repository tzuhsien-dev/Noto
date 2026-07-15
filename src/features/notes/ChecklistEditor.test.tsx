import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/database'
import { addChecklistItem, createNote } from '@/db/repo/notes'
import { renderWithProviders, resetDb } from '@/test/utils'
import { FAKE_USER } from '@/lib/backend/fake'
import { ChecklistEditor } from './ChecklistEditor'

afterEach(resetDb)

async function seedItem(content: string) {
  const note = await createNote({ userId: FAKE_USER.id })
  const item = await addChecklistItem({ noteId: note.id, userId: FAKE_USER.id, content })
  return { note, item }
}

describe('ChecklistEditor', () => {
  it('commits an item edit on Enter', async () => {
    const user = userEvent.setup()
    const { note, item } = await seedItem('Milk')
    renderWithProviders(<ChecklistEditor noteId={note.id} />)
    const input = await screen.findByLabelText('Checklist item')
    await user.clear(input)
    await user.type(input, 'Oat milk{Enter}')
    await waitFor(async () => {
      expect((await db.checklist_items.get(item.id))?.content).toBe('Oat milk')
    })
  })

  it('keeps the stored content when the field is emptied', async () => {
    const user = userEvent.setup()
    const { note, item } = await seedItem('Milk')
    renderWithProviders(<ChecklistEditor noteId={note.id} />)
    const input = await screen.findByLabelText('Checklist item')
    await user.clear(input)
    await user.keyboard('{Enter}')
    // Give any (wrongly triggered) write a chance to land.
    await new Promise((r) => setTimeout(r, 50))
    expect((await db.checklist_items.get(item.id))?.content).toBe('Milk')
  })

  it('deletes an item via its delete button', async () => {
    const user = userEvent.setup()
    const { note, item } = await seedItem('Milk')
    renderWithProviders(<ChecklistEditor noteId={note.id} />)
    await user.click(await screen.findByRole('button', { name: 'Delete Milk' }))
    await waitFor(async () => {
      expect(await db.checklist_items.get(item.id)).toBeUndefined()
    })
  })
})
