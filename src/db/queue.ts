import type { NotoDatabase } from './database'
import type { PendingMutation, PendingOperation } from '@/domain/types'
import { newId, nowIso } from '@/domain/types'

type EnqueueArgs = {
  entityType: PendingMutation['entityType']
  entityId: string
  operation: PendingOperation
  payload: unknown
  baseVersion: number
}

/**
 * Add a mutation to the pending queue, coalescing with any existing pending
 * mutation for the same entity so the queue stays one-entry-per-entity:
 *
 * - insert + update  → insert with the newer payload
 * - insert + delete  → nothing (the server never saw the entity)
 * - update + update  → update with the newer payload, keeping the ORIGINAL
 *                      baseVersion (conflict detection must compare against
 *                      the server state the first local edit was based on)
 * - update + delete  → delete, keeping the original baseVersion
 *
 * Must be called inside a transaction covering `pending_mutations`.
 */
export async function enqueueMutation(db: NotoDatabase, args: EnqueueArgs): Promise<void> {
  const existing = await db.pending_mutations
    .where('[entityType+entityId]')
    .equals([args.entityType, args.entityId])
    .first()

  if (!existing) {
    await db.pending_mutations.add({
      id: newId(),
      entityType: args.entityType,
      entityId: args.entityId,
      operation: args.operation,
      payload: args.payload,
      baseVersion: args.baseVersion,
      createdAt: nowIso(),
      attempts: 0,
      lastError: null,
    })
    return
  }

  if (existing.operation === 'insert' && args.operation === 'delete') {
    await db.pending_mutations.delete(existing.id)
    return
  }

  const operation: PendingOperation =
    existing.operation === 'insert' ? 'insert' : args.operation === 'delete' ? 'delete' : 'update'

  await db.pending_mutations.update(existing.id, {
    operation,
    payload: args.payload,
    // keep existing.baseVersion — see doc comment
    attempts: 0,
    lastError: null,
  })
}

export async function pendingCount(db: NotoDatabase): Promise<number> {
  return db.pending_mutations.count()
}

export async function pendingFor(
  db: NotoDatabase,
  entityType: PendingMutation['entityType'],
  entityId: string,
): Promise<PendingMutation | undefined> {
  return db.pending_mutations.where('[entityType+entityId]').equals([entityType, entityId]).first()
}
