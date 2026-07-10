import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import type { BackendClient, BackendUser, EntityRow, JoinKind, JoinRow, PullPage } from './types'
import { BackendError } from './types'
import { ENTITY_TABLES, JOIN_TABLES, toCamelRow, toSnakeRow } from './mapping'
import type { EntityType } from '@/domain/types'

function toUser(session: Session | null): BackendUser | null {
  if (!session?.user) return null
  return { id: session.user.id, email: session.user.email ?? null }
}

/**
 * Convert any thrown/returned error into a BackendError whose message is
 * safe to render and persist (no tokens, no raw server payloads).
 */
function sanitizeError(error: unknown, fallback: string): BackendError {
  if (error instanceof BackendError) return error
  const message = error instanceof Error ? error.message : ''
  if (/invalid login credentials/i.test(message)) {
    return new BackendError('auth', 'Invalid email or password')
  }
  if (/(fetch|network|failed to fetch|load failed)/i.test(message)) {
    return new BackendError('network', 'Could not reach the server')
  }
  if (/(jwt|token|expired|refresh)/i.test(message)) {
    return new BackendError('auth', 'Your session has expired. Please sign in again.')
  }
  return new BackendError('unknown', fallback)
}

const TABLE_TO_ENTITY: Record<string, EntityType> = Object.fromEntries(
  Object.entries(ENTITY_TABLES).map(([entity, table]) => [table, entity as EntityType]),
) as Record<string, EntityType>

export function createSupabaseBackend(url: string, publishableKey: string): BackendClient {
  // persistSession + autoRefreshToken are the library defaults; stated
  // explicitly because the spec requires them. PKCE makes the password
  // recovery redirect work on a static host.
  const client: SupabaseClient = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })

  return {
    // --- auth ---------------------------------------------------------------
    async getSessionUser() {
      const { data, error } = await client.auth.getSession()
      if (error) throw sanitizeError(error, 'Could not restore your session')
      return toUser(data.session)
    },

    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw sanitizeError(error, 'Could not sign in')
      const user = toUser(data.session)
      if (!user) throw new BackendError('auth', 'Could not sign in')
      return user
    },

    async signUpWithPassword(email, password) {
      const { data, error } = await client.auth.signUp({ email, password })
      if (error) throw sanitizeError(error, 'Could not sign up')
      return data.session ? toUser(data.session) : null
    },

    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) throw sanitizeError(error, 'Could not sign out')
    },

    async requestPasswordReset(email) {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/reset-password`
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw sanitizeError(error, 'Could not send the reset email')
    },

    async updatePassword(newPassword) {
      const { error } = await client.auth.updateUser({ password: newPassword })
      if (error) throw sanitizeError(error, 'Could not update the password')
    },

    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        callback(toUser(session))
      })
      return () => data.subscription.unsubscribe()
    },

    // --- data ---------------------------------------------------------------
    async pullSince(entityType, sinceIso, limit, offset) {
      let query = client
        .from(ENTITY_TABLES[entityType])
        .select('*')
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1)
      if (sinceIso) query = query.gt('updated_at', sinceIso)
      const { data, error } = await query
      if (error) throw sanitizeError(error, 'Could not fetch updates')
      const rows = (data ?? []).map((row) => toCamelRow(row) as EntityRow)
      const result: PullPage = { rows, hasMore: rows.length === limit }
      return result
    },

    async pullJoins(kind) {
      const { data, error } = await client.from(JOIN_TABLES[kind]).select('*')
      if (error) throw sanitizeError(error, 'Could not fetch updates')
      return (data ?? []).map((row) => toCamelRow(row) as unknown as JoinRow)
    },

    async upsertEntity(entityType, row) {
      const { error } = await client.from(ENTITY_TABLES[entityType]).upsert(toSnakeRow(row))
      if (error) throw sanitizeError(error, 'Could not save changes')
    },

    async updateEntityGuarded(entityType, row, baseVersion) {
      // The DB trigger owns version/updated_at; strip them from the payload.
      const { id, version: _version, updatedAt: _updatedAt, ...fields } = row
      const { data, error } = await client
        .from(ENTITY_TABLES[entityType])
        .update(toSnakeRow(fields))
        .eq('id', id)
        .eq('version', baseVersion)
        .select('id')
      if (error) throw sanitizeError(error, 'Could not save changes')
      return data && data.length > 0 ? 'ok' : 'conflict'
    },

    async fetchEntity(entityType, id) {
      const { data, error } = await client
        .from(ENTITY_TABLES[entityType])
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw sanitizeError(error, 'Could not fetch updates')
      return data ? (toCamelRow(data) as EntityRow) : null
    },

    async deleteEntity(entityType, id) {
      const { error } = await client.from(ENTITY_TABLES[entityType]).delete().eq('id', id)
      if (error) throw sanitizeError(error, 'Could not delete')
    },

    async insertJoin(kind, row) {
      const { error } = await client.from(JOIN_TABLES[kind]).upsert(toSnakeRow(row))
      if (error) throw sanitizeError(error, 'Could not save changes')
    },

    async deleteJoin(kind, row) {
      const snake = toSnakeRow(row)
      let query = client.from(JOIN_TABLES[kind]).delete()
      for (const key of ['task_id', 'note_id', 'tag_id']) {
        if (snake[key] !== undefined) query = query.eq(key, snake[key] as string)
      }
      const { error } = await query
      if (error) throw sanitizeError(error, 'Could not delete')
    },

    // --- realtime -------------------------------------------------------------
    subscribeToChanges(userId, onChange) {
      const channel = client.channel(`noto-changes-${crypto.randomUUID()}`)
      for (const [entityType, table] of Object.entries(ENTITY_TABLES)) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const old = payload.old as Record<string, unknown>
              if (typeof old.id === 'string') {
                onChange({
                  kind: 'entity',
                  entityType: TABLE_TO_ENTITY[table] as EntityType,
                  row: { id: old.id, version: 0 },
                  deleted: true,
                })
              }
              return
            }
            onChange({
              kind: 'entity',
              entityType: entityType as EntityType,
              row: toCamelRow(payload.new as Record<string, unknown>) as EntityRow,
              deleted: false,
            })
          },
        )
      }
      for (const [joinKind, table] of Object.entries(JOIN_TABLES)) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              // DELETE payloads only carry the PK columns; enough to identify the join.
              onChange({
                kind: 'join',
                joinKind: joinKind as JoinKind,
                row: toCamelRow(payload.old as Record<string, unknown>) as unknown as JoinRow,
                deleted: true,
              })
              return
            }
            onChange({
              kind: 'join',
              joinKind: joinKind as JoinKind,
              row: toCamelRow(payload.new as Record<string, unknown>) as unknown as JoinRow,
              deleted: false,
            })
          },
        )
      }
      channel.subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}
