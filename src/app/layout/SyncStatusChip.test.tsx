import { afterEach, describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import { createTask } from '@/db/repo/tasks'
import { renderWithProviders, resetDb } from '@/test/utils'
import { FAKE_USER } from '@/lib/backend/fake'
import { setSyncStatus } from '@/sync/status'
import { SyncStatusChip } from './SyncStatusChip'

afterEach(async () => {
  act(() => setSyncStatus({ phase: 'synced', message: null, lastSyncAt: null }))
  await resetDb()
})

describe('SyncStatusChip', () => {
  it('shows Synced when idle with no pending changes', async () => {
    renderWithProviders(<SyncStatusChip />)
    expect(await screen.findByText('Synced')).toBeInTheDocument()
  })

  it('shows the offline indicator', async () => {
    renderWithProviders(<SyncStatusChip />)
    await screen.findByText('Synced')
    act(() => setSyncStatus({ phase: 'offline' }))
    expect(await screen.findByText('Offline')).toBeInTheDocument()
  })

  it('shows pending count while changes wait to sync', async () => {
    await createTask({ userId: FAKE_USER.id, title: 'queued' })
    renderWithProviders(<SyncStatusChip />)
    expect(await screen.findByText('1 pending')).toBeInTheDocument()
  })

  it('shows sync errors', async () => {
    renderWithProviders(<SyncStatusChip />)
    await screen.findByText('Synced')
    act(() => setSyncStatus({ phase: 'error', message: 'Could not reach the server' }))
    expect(await screen.findByText('Sync error')).toBeInTheDocument()
  })
})
