import type { EntityType, NoteTag, TaskTag } from '@/domain/types'

export type BackendUser = {
  id: string
  email: string | null
}

/**
 * Error surfaced to the UI/queue. `message` must stay free of tokens and
 * raw server payloads — it is rendered and persisted.
 */
export class BackendError extends Error {
  readonly kind: 'auth' | 'network' | 'conflict' | 'validation' | 'unknown'

  constructor(kind: BackendError['kind'], message: string) {
    super(message)
    this.name = 'BackendError'
    this.kind = kind
  }
}

export type EntityRow = Record<string, unknown> & { id: string; version: number }

export type PullPage = {
  rows: EntityRow[]
  hasMore: boolean
}

export type JoinKind = 'taskTag' | 'noteTag'
export type JoinRow = TaskTag | NoteTag

export type RemoteChange =
  | { kind: 'entity'; entityType: EntityType; row: EntityRow; deleted: boolean }
  | { kind: 'join'; joinKind: JoinKind; row: JoinRow; deleted: boolean }

/**
 * The narrow seam between the app and the cloud. Implemented by the real
 * Supabase client and by an in-memory fake (dev/E2E). All rows crossing this
 * interface use frontend domain shapes (camelCase); the Supabase
 * implementation owns snake_case mapping.
 */
export interface BackendClient {
  // --- auth ---------------------------------------------------------------
  getSessionUser(): Promise<BackendUser | null>
  signInWithPassword(email: string, password: string): Promise<BackendUser>
  signUpWithPassword(email: string, password: string): Promise<BackendUser | null>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(newPassword: string): Promise<void>
  /** Fires on sign-in/sign-out/refresh. Returns an unsubscribe function. */
  onAuthStateChange(callback: (user: BackendUser | null) => void): () => void

  // --- data (used by the sync engine) --------------------------------------
  pullSince(
    entityType: EntityType,
    sinceIso: string | null,
    limit: number,
    offset: number,
  ): Promise<PullPage>
  pullJoins(kind: JoinKind): Promise<JoinRow[]>
  upsertEntity(entityType: EntityType, row: EntityRow): Promise<void>
  /**
   * Version-guarded update. Returns 'conflict' when the remote version no
   * longer matches baseVersion (or the row is gone).
   */
  updateEntityGuarded(
    entityType: EntityType,
    row: EntityRow,
    baseVersion: number,
  ): Promise<'ok' | 'conflict'>
  fetchEntity(entityType: EntityType, id: string): Promise<EntityRow | null>
  deleteEntity(entityType: EntityType, id: string): Promise<void>
  insertJoin(kind: JoinKind, row: JoinRow): Promise<void>
  deleteJoin(kind: JoinKind, row: JoinRow): Promise<void>

  // --- realtime -------------------------------------------------------------
  /**
   * Subscribe to remote changes for the signed-in user. Returns an
   * unsubscribe function. Implementations must tolerate repeated calls by
   * returning independent subscriptions the caller manages.
   */
  subscribeToChanges(userId: string, onChange: (change: RemoteChange) => void): () => void
}
