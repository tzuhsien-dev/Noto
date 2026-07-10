import { useSyncExternalStore } from 'react'
import type { SyncPhase } from '@/domain/types'

export type SyncStatus = {
  phase: SyncPhase
  lastSyncAt: string | null
  /** Sanitized, user-displayable message for the 'error' phase. */
  message: string | null
}

let current: SyncStatus = {
  phase: navigator.onLine ? 'synced' : 'offline',
  lastSyncAt: null,
  message: null,
}

const listeners = new Set<() => void>()

export function setSyncStatus(next: Partial<SyncStatus>): void {
  current = { ...current, ...next }
  listeners.forEach((cb) => cb())
}

export function getSyncStatus(): SyncStatus {
  return current
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus)
}
