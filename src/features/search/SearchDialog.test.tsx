import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createNote } from '@/db/repo/notes'
import { createTask } from '@/db/repo/tasks'
import { renderWithProviders, resetDb } from '@/test/utils'
import { FAKE_USER } from '@/lib/backend/fake'
import { useUiState } from '@/app/ui-state'
import { useEffect } from 'react'
import { SearchDialog } from './SearchDialog'

afterEach(resetDb)

function OpenedSearch() {
  const { setSearchOpen } = useUiState()
  useEffect(() => setSearchOpen(true), [setSearchOpen])
  return <SearchDialog />
}

describe('SearchDialog', () => {
  it('finds tasks and notes as the user types (debounced)', async () => {
    await createTask({ userId: FAKE_USER.id, title: 'Pay electricity bill' })
    await createNote({ userId: FAKE_USER.id, title: 'Electricity meter readings' })
    await createTask({ userId: FAKE_USER.id, title: 'Unrelated' })

    const user = userEvent.setup()
    renderWithProviders(<OpenedSearch />)
    const input = await screen.findByRole('searchbox')
    await user.type(input, 'electricity')

    await waitFor(() => {
      expect(screen.getByText('Pay electricity bill')).toBeInTheDocument()
      expect(screen.getByText('Electricity meter readings')).toBeInTheDocument()
    })
    expect(screen.queryByText('Unrelated')).not.toBeInTheDocument()
  })

  it('applies the type filter', async () => {
    await createTask({ userId: FAKE_USER.id, title: 'Water the garden' })
    await createNote({ userId: FAKE_USER.id, title: 'Watering schedule' })

    const user = userEvent.setup()
    renderWithProviders(<OpenedSearch />)
    await user.type(await screen.findByRole('searchbox'), 'water')
    await user.selectOptions(screen.getByLabelText('Type filter'), 'note')

    await waitFor(() => {
      expect(screen.getByText('Watering schedule')).toBeInTheDocument()
      expect(screen.queryByText('Water the garden')).not.toBeInTheDocument()
    })
  })

  it('shows an empty message when nothing matches', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenedSearch />)
    await user.type(await screen.findByRole('searchbox'), 'zzz-nothing')
    expect(await screen.findByText('No results')).toBeInTheDocument()
  })
})
