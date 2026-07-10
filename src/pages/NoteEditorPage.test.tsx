import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { db } from '@/db/database'
import { createNote } from '@/db/repo/notes'
import { renderWithProviders, resetDb } from '@/test/utils'
import { FAKE_USER } from '@/lib/backend/fake'
import { NoteEditorPage, NOTE_AUTOSAVE_MS } from './NoteEditorPage'

afterEach(async () => {
  vi.useRealTimers()
  await resetDb()
})

function renderEditor(noteId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/notes/:noteId" element={<NoteEditorPage />} />
    </Routes>,
    { route: `/notes/${noteId}` },
  )
}

describe('note auto-save', () => {
  it('debounces writes: nothing is saved until the delay elapses', async () => {
    const note = await createNote({ userId: FAKE_USER.id, title: 'Draft' })
    await db.pending_mutations.clear()

    const user = userEvent.setup()
    renderEditor(note.id)
    const content = await screen.findByLabelText('Note content')

    await user.type(content, 'hello')
    // Before the debounce window closes the store still has the old content.
    expect((await db.notes.get(note.id))?.content).toBe('')

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, NOTE_AUTOSAVE_MS + 200))
    })
    expect((await db.notes.get(note.id))?.content).toBe('hello')
    // A single coalesced pending mutation, not one per keystroke.
    expect(await db.pending_mutations.count()).toBe(1)
  })

  it('shows a not-available message for deleted notes', async () => {
    const note = await createNote({ userId: FAKE_USER.id, title: 'Gone' })
    await db.notes.update(note.id, { deletedAt: new Date().toISOString() })
    renderEditor(note.id)
    expect(await screen.findByText('This note is not available.')).toBeInTheDocument()
  })
})
