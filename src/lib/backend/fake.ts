import type {
  BackendClient,
  BackendUser,
  EntityRow,
  JoinKind,
  JoinRow,
  PullPage,
  RemoteChange,
} from './types'
import { BackendError } from './types'
import type { EntityType } from '@/domain/types'

export const FAKE_USER: BackendUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'demo@noto.local',
}
export const FAKE_PASSWORD = 'noto-demo-password'

const SESSION_KEY = 'noto-fake-session'

/**
 * In-memory backend for development and E2E tests. Auth accepts exactly one
 * demo credential; data lives in maps for the duration of the page (the app
 * itself persists everything in IndexedDB, so pulls being empty after a
 * reload is fine — it mirrors a fresh cloud project).
 */
export class FakeBackend implements BackendClient {
  private entities = new Map<EntityType, Map<string, EntityRow>>()
  private joins = new Map<JoinKind, JoinRow[]>()
  private authListeners = new Set<(user: BackendUser | null) => void>()
  private changeListeners = new Set<(change: RemoteChange) => void>()
  /** Set by E2E hooks to simulate server outages for retry tests. */
  failPushes = false

  private table(entityType: EntityType): Map<string, EntityRow> {
    let table = this.entities.get(entityType)
    if (!table) {
      table = new Map()
      this.entities.set(entityType, table)
    }
    return table
  }

  private assertUp(): void {
    if (this.failPushes) throw new BackendError('network', 'Could not reach the server')
  }

  // --- auth -----------------------------------------------------------------

  async getSessionUser(): Promise<BackendUser | null> {
    return localStorage.getItem(SESSION_KEY) ? FAKE_USER : null
  }

  async signInWithPassword(email: string, password: string): Promise<BackendUser> {
    if (email !== FAKE_USER.email || password !== FAKE_PASSWORD) {
      throw new BackendError('auth', 'Invalid email or password')
    }
    localStorage.setItem(SESSION_KEY, '1')
    this.authListeners.forEach((cb) => cb(FAKE_USER))
    return FAKE_USER
  }

  async signUpWithPassword(): Promise<BackendUser | null> {
    throw new BackendError('auth', 'Sign-up is disabled')
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY)
    this.authListeners.forEach((cb) => cb(null))
  }

  async requestPasswordReset(): Promise<void> {}

  async updatePassword(): Promise<void> {}

  onAuthStateChange(callback: (user: BackendUser | null) => void): () => void {
    this.authListeners.add(callback)
    return () => this.authListeners.delete(callback)
  }

  // --- data -----------------------------------------------------------------

  async pullSince(
    entityType: EntityType,
    sinceIso: string | null,
    limit: number,
    offset: number,
  ): Promise<PullPage> {
    const rows = [...this.table(entityType).values()]
      .filter((row) => !sinceIso || String(row.updatedAt) > sinceIso)
      .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
    const page = rows.slice(offset, offset + limit)
    return { rows: page, hasMore: offset + limit < rows.length }
  }

  async pullJoins(kind: JoinKind): Promise<JoinRow[]> {
    return [...(this.joins.get(kind) ?? [])]
  }

  async upsertEntity(entityType: EntityType, row: EntityRow): Promise<void> {
    this.assertUp()
    const existing = this.table(entityType).get(row.id)
    const version = existing ? Number(existing.version) + 1 : 1
    this.table(entityType).set(row.id, { ...row, version })
  }

  async updateEntityGuarded(
    entityType: EntityType,
    row: EntityRow,
    baseVersion: number,
  ): Promise<'ok' | 'conflict'> {
    this.assertUp()
    const existing = this.table(entityType).get(row.id)
    if (!existing || Number(existing.version) !== baseVersion) return 'conflict'
    this.table(entityType).set(row.id, { ...row, version: baseVersion + 1 })
    return 'ok'
  }

  async fetchEntity(entityType: EntityType, id: string): Promise<EntityRow | null> {
    return this.table(entityType).get(id) ?? null
  }

  async deleteEntity(entityType: EntityType, id: string): Promise<void> {
    this.assertUp()
    this.table(entityType).delete(id)
  }

  async insertJoin(kind: JoinKind, row: JoinRow): Promise<void> {
    this.assertUp()
    const rows = this.joins.get(kind) ?? []
    this.joins.set(kind, [...rows.filter((r) => !sameJoin(r, row)), row])
  }

  async deleteJoin(kind: JoinKind, row: JoinRow): Promise<void> {
    this.assertUp()
    const rows = this.joins.get(kind) ?? []
    this.joins.set(
      kind,
      rows.filter((r) => !sameJoin(r, row)),
    )
  }

  // --- realtime ---------------------------------------------------------------

  subscribeToChanges(_userId: string, onChange: (change: RemoteChange) => void): () => void {
    this.changeListeners.add(onChange)
    return () => this.changeListeners.delete(onChange)
  }

  /** Test hook: simulate a change arriving from another device. */
  emitRemoteChange(change: RemoteChange): void {
    if (change.kind === 'entity') {
      if (change.deleted) this.table(change.entityType).delete(change.row.id)
      else this.table(change.entityType).set(change.row.id, change.row)
    }
    this.changeListeners.forEach((cb) => cb(change))
  }
}

function sameJoin(a: JoinRow, b: JoinRow): boolean {
  const at = a as Record<string, unknown>
  const bt = b as Record<string, unknown>
  return at.taskId === bt.taskId && at.noteId === bt.noteId && at.tagId === bt.tagId
}
