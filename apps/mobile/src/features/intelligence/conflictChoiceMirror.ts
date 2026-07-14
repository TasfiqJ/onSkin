import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { devWarn } from '@/lib/observability/safeLog';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { supabase } from '@/lib/supabase/client';

import type { ConflictUserChoice } from './conflictChoices';
import type { DetectedConflict } from './engine';

type CanonicalConflictIdentity = Readonly<{
  key: string;
  productAId: string;
  productBId: string;
  ruleId: string;
}>;

type ConflictChoiceMirrorSnapshot = CanonicalConflictIdentity &
  Readonly<{
    computedSeverity: DetectedConflict['computedSeverity'];
    ruleVersion: number;
    status: 'accepted' | 'overridden';
    updatedAt: string;
    userChoice: ConflictUserChoice;
  }>;

const conflictChoiceMirrorTails = new Map<string, Promise<void>>();

function canonicalConflictIdentity(conflict: DetectedConflict): CanonicalConflictIdentity | null {
  const ruleId = conflict.rule.id.trim();
  const productIds = [conflict.productAId?.trim(), conflict.productBId?.trim()]
    .filter((id): id is string => Boolean(id))
    .sort();
  if (!ruleId || productIds.length !== 2 || productIds[0] === productIds[1]) return null;

  const [productAId, productBId] = productIds as [string, string];
  return Object.freeze({
    key: JSON.stringify([ruleId, productAId, productBId]),
    productAId,
    productBId,
    ruleId,
  });
}

function snapshotConflictChoiceMirror(
  conflict: DetectedConflict,
  userChoice: ConflictUserChoice,
): ConflictChoiceMirrorSnapshot | null {
  const identity = canonicalConflictIdentity(conflict);
  if (!identity) return null;

  // The authenticated user remains lease-captured at execution time. Every
  // caller-owned value is frozen now so a queued mirror cannot observe later
  // mutation of a conflict object reused by a render or recomputation.
  return Object.freeze({
    ...identity,
    computedSeverity: conflict.computedSeverity,
    ruleVersion: conflict.rule.ruleVersion,
    status: userChoice === 'use_together' ? 'overridden' : 'accepted',
    updatedAt: new Date().toISOString(),
    userChoice,
  });
}

function enqueueConflictChoiceMirror(
  ownerScope: OwnerQueryScope,
  identity: CanonicalConflictIdentity,
  operation: () => Promise<void>,
): Promise<void> {
  const key = `${ownerScope.generation}:${identity.key}`;
  const previous = conflictChoiceMirrorTails.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const tail = current
    .catch(() => undefined)
    .finally(() => {
      if (conflictChoiceMirrorTails.get(key) === tail) conflictChoiceMirrorTails.delete(key);
    });
  conflictChoiceMirrorTails.set(key, tail);
  return current;
}

async function performConflictChoiceMirror(
  ownerScope: OwnerQueryScope,
  snapshot: ConflictChoiceMirrorSnapshot,
): Promise<void> {
  try {
    await runOwnerQueryOperation(ownerScope, async (lease) => {
      const owner = await captureAuthenticatedAccountOwner(lease);
      if (!owner) return;
      lease.assertCurrent();
      const { error } = await supabase
        .from('routine_conflicts')
        .upsert(
          {
            user_id: owner.userId,
            rule_id: snapshot.ruleId,
            product_a_id: snapshot.productAId,
            product_b_id: snapshot.productBId,
            computed_severity: snapshot.computedSeverity,
            status: snapshot.status,
            user_choice: snapshot.userChoice,
            rule_version: snapshot.ruleVersion,
            updated_at: snapshot.updatedAt,
          },
          { onConflict: 'user_id,rule_id,product_a_id,product_b_id' },
        )
        .abortSignal(lease.signal);
      lease.assertCurrent();
      if (error) throw new Error('SUPABASE_ROUTINE_CONFLICT_UPSERT_FAILED');
    });
  } catch (error) {
    devWarn('routine_conflict_mirror_upsert_failed', error);
    // Encrypted local state remains authoritative while this mirror is best effort.
  }
}

/** Best-effort owner-RLS mirror for an already-committed local conflict choice.
 * Calls for one rule and unordered product pair execute in invocation order. */
export function mirrorConflictChoiceForOwner(
  ownerScope: OwnerQueryScope,
  conflict: DetectedConflict,
  userChoice: ConflictUserChoice,
): Promise<void> {
  const snapshot = snapshotConflictChoiceMirror(conflict, userChoice);
  if (!snapshot) return Promise.resolve();
  return enqueueConflictChoiceMirror(ownerScope, snapshot, () =>
    performConflictChoiceMirror(ownerScope, snapshot),
  );
}

export function resetConflictChoiceMirrorStateForTests(): void {
  conflictChoiceMirrorTails.clear();
}
