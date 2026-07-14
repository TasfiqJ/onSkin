import { randomUUID } from 'expo-crypto';

import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';

import {
  reserveTrialGroundedTurn,
  type GroundedTurnOperationId,
} from './store';

const OPERATION_ID = /^[a-f0-9]{32}$/;

/** Create one content-free identity per distinct trial answer. Reuse it only when
 * retrying that same reservation after an uncertain response. */
export function createGroundedTurnOperationId(): GroundedTurnOperationId {
  const operationId = randomUUID().replace(/-/g, '').toLowerCase();
  if (!OPERATION_ID.test(operationId)) throw new Error('ASK_TURN_OPERATION_ID_UNAVAILABLE');
  return operationId as GroundedTurnOperationId;
}

export type GroundedTurnAccess =
  | Readonly<{
      kind: 'trial';
      period: string;
      operationId: GroundedTurnOperationId;
    }>
  | Readonly<{ kind: 'uncapped' }>;

export type GroundedTurnOperationContext = Readonly<{
  signal: AbortSignal;
  recordedTrialCount: number | null;
  assertCurrent: () => void;
}>;

/** Keep trial reservation, provider request, cache publication, and answer delivery
 * inside one owner lease. Paid access takes the explicit uncapped branch and skips
 * the five-turn local trial guard. */
export function runGroundedTurnForOwner<T>(
  ownerScope: OwnerQueryScope,
  access: GroundedTurnAccess,
  operation: (context: GroundedTurnOperationContext) => T | Promise<T>,
): Promise<T> {
  return runOwnerQueryOperation(ownerScope, async (lease) => {
    const recordedTrialCount =
      access.kind === 'trial'
        ? await reserveTrialGroundedTurn(access.period, access.operationId)
        : null;
    lease.assertCurrent();
    return operation({
      signal: lease.signal,
      recordedTrialCount,
      assertCurrent: () => lease.assertCurrent(),
    });
  });
}
