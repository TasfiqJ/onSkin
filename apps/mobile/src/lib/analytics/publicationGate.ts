import {
  isAccountActivityBlockedForDeletion,
  subscribeToAccountDeletionActivityBlock,
} from '@/features/settings/accountDeletionBarrier';
import type { AnalyticsAllowedEventName } from '@/lib/analytics/eventRegistry';

export type AnalyticsPublicationProps =
  | Record<string, string | number | boolean | null>
  | undefined;

export type AnalyticsPublicationTransport = Readonly<{
  publish: (event: AnalyticsAllowedEventName, props: AnalyticsPublicationProps) => void;
}>;

export type VerifiedAnalyticsPublicationReceipt = Readonly<{
  ownerId: string;
  token: string;
  generation: number;
  verified: true;
}>;

type OpenAnalyticsPublicationInput = Readonly<{
  ownerId: string;
  receipt: VerifiedAnalyticsPublicationReceipt;
  transport: AnalyticsPublicationTransport;
}>;

type OpenPublicationState = Readonly<{
  generation: number;
  ownerId: string;
  receiptToken: string;
  transport: AnalyticsPublicationTransport;
}>;

let generation = 0;
let openState: OpenPublicationState | null = null;

function isExactNonemptyToken(value: string): boolean {
  return value.length > 0 && value === value.trim();
}

/** Generation to bind to an externally verified receipt before opening. */
export function getAnalyticsPublicationGeneration(): number {
  return generation;
}

/**
 * Opens publication only for an exact owner-bound receipt verified outside
 * this module at the current closed generation. This module deliberately
 * creates no consent or receipt authority of its own.
 */
export function openAnalyticsPublication(input: OpenAnalyticsPublicationInput): boolean {
  if (openState !== null || isAccountActivityBlockedForDeletion()) return false;
  if (!isExactNonemptyToken(input.ownerId) || !isExactNonemptyToken(input.receipt.token))
    return false;
  if (
    input.receipt.verified !== true ||
    input.receipt.ownerId !== input.ownerId ||
    input.receipt.generation !== generation
  ) {
    return false;
  }
  if (typeof input.transport.publish !== 'function') return false;

  openState = {
    generation,
    ownerId: input.ownerId,
    receiptToken: input.receipt.token,
    transport: input.transport,
  };
  return true;
}

/**
 * Revokes publication synchronously. Advancing the generation invalidates
 * every receipt verified before this close, including account-switch races.
 */
export function closeAnalyticsPublication(): void {
  openState = null;
  generation += 1;
}

/**
 * Publishes at most the event supplied by this call. There is no buffer,
 * persistence, retry, or replay path in this gate.
 */
export function publishAnalyticsEvent(
  event: AnalyticsAllowedEventName,
  props: AnalyticsPublicationProps,
): boolean {
  const snapshot = openState;
  if (
    snapshot === null ||
    snapshot.generation !== generation ||
    openState !== snapshot ||
    isAccountActivityBlockedForDeletion()
  ) {
    if (isAccountActivityBlockedForDeletion() && openState !== null) {
      closeAnalyticsPublication();
    }
    return false;
  }

  // Recheck immediately before handing the already-sanitized payload to the
  // injected transport. JavaScript execution is synchronous across this fence.
  if (
    openState !== snapshot ||
    snapshot.generation !== generation ||
    snapshot.ownerId.length === 0 ||
    snapshot.receiptToken.length === 0
  ) {
    return false;
  }

  try {
    snapshot.transport.publish(event, props);
    return true;
  } catch {
    return false;
  }
}

// The deletion barrier notifies synchronously at admission close, so the
// transport reference and receipt are discarded before asynchronous deletion.
subscribeToAccountDeletionActivityBlock(closeAnalyticsPublication);
