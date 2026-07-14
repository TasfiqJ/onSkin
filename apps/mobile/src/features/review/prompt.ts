import * as StoreReview from 'expo-store-review';

import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';
import {
  readPrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';

import {
  canRequestReviewPrompt,
  recordReviewAttempt,
  type ReviewPromptState,
  type ReviewValueMoment,
} from './policy';

const REVIEW_PROMPT_KEY = 'onskin.reviewPrompt.v1';
const SCHEMA_VERSION = 1 as const;

export const MAX_REVIEW_PROMPT_ATTEMPTS = 64;
export const MAX_REVIEW_PROMPT_STATE_CHARS = 8_192;
export const REVIEW_PROMPT_STATE_INVALID = 'REVIEW_PROMPT_STATE_INVALID';
export const REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION = 'REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION';

type ReviewPromptEnvelope = {
  version: typeof SCHEMA_VERSION;
  state: ReviewPromptState;
};

type ReviewPromptStateFormat = 'current' | 'legacy';
type ReviewPromptUnavailableReason = PrivateKVReadFailureReason | 'invalid_clock';
type ReviewPromptCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'invalid_payload';

export type ReviewPromptStateRead =
  | { status: 'absent'; state: ReviewPromptState }
  | {
      status: 'available';
      state: ReviewPromptState;
      format: ReviewPromptStateFormat;
    }
  | {
      status: 'unavailable';
      state: null;
      reason: ReviewPromptUnavailableReason;
    }
  | { status: 'corrupt'; state: null; reason: ReviewPromptCorruptReason }
  | { status: 'unsupported_version'; state: null };

type DecodedReviewPromptState = {
  state: ReviewPromptState;
  format: ReviewPromptStateFormat;
};

type ReviewAttemptReservationResult =
  | { status: 'reserved' }
  | { status: 'not_reserved' }
  | { status: 'unavailable'; reason: 'storage_unavailable' | 'write_unconfirmed' };

function reviewPromptStateError(code: string): Error {
  return new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function isCanonicalPastOrPresentISO(value: unknown, nowMs: number): value is string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= nowMs && new Date(parsed).toISOString() === value;
}

function decodeStateValue(value: unknown, nowMs: number): ReviewPromptState {
  if (!isRecord(value) || !hasExactKeys(value, ['attemptedAt'])) {
    throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
  }
  if (!Array.isArray(value.attemptedAt) || value.attemptedAt.length > MAX_REVIEW_PROMPT_ATTEMPTS) {
    throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
  }

  const attemptedAt: string[] = [];
  let previous = -1;
  for (const item of value.attemptedAt) {
    if (!isCanonicalPastOrPresentISO(item, nowMs)) {
      throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
    }
    const timestamp = Date.parse(item);
    if (timestamp <= previous) throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
    previous = timestamp;
    attemptedAt.push(item);
  }
  return { attemptedAt };
}

function decodeState(raw: string, now: Date): DecodedReviewPromptState {
  if (raw.length > MAX_REVIEW_PROMPT_STATE_CHARS) {
    throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
  }
  if (!isRecord(parsed)) throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);

  if (hasOwn(parsed, 'version')) {
    if (parsed.version !== SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > SCHEMA_VERSION
      ) {
        throw reviewPromptStateError(REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION);
      }
      throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
    }
    if (!hasExactKeys(parsed, ['version', 'state'])) {
      throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
    }
    return {
      state: decodeStateValue(parsed.state, now.getTime()),
      format: 'current',
    };
  }

  return {
    state: decodeStateValue(parsed, now.getTime()),
    format: 'legacy',
  };
}

function encodeState(state: ReviewPromptState): string {
  const encoded = JSON.stringify({ version: SCHEMA_VERSION, state } satisfies ReviewPromptEnvelope);
  if (
    state.attemptedAt.length > MAX_REVIEW_PROMPT_ATTEMPTS ||
    encoded.length > MAX_REVIEW_PROMPT_STATE_CHARS
  ) {
    throw reviewPromptStateError(REVIEW_PROMPT_STATE_INVALID);
  }
  return encoded;
}

async function readReviewPromptStateWithLease(
  lease: AccountGenerationLease,
  now: Date,
): Promise<ReviewPromptStateRead> {
  if (!Number.isFinite(now.getTime())) {
    return { status: 'unavailable', state: null, reason: 'invalid_clock' };
  }

  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await awaitAccountGenerationLease(lease, () => readPrivateItem(REVIEW_PROMPT_KEY));
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
    return {
      status: 'unavailable',
      state: null,
      reason: 'storage_unavailable',
    };
  }

  if (stored.status === 'absent') return { status: 'absent', state: { attemptedAt: [] } };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', state: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', state: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', state: null };
  }

  try {
    const decoded = decodeState(stored.value, now);
    return {
      status: 'available',
      state: decoded.state,
      format: decoded.format,
    };
  } catch (error) {
    return error instanceof Error && error.message === REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', state: null }
      : { status: 'corrupt', state: null, reason: 'invalid_payload' };
  }
}

/** Read and classify prompt history without repairing, deleting, migrating, or
 * publishing a stale account generation. */
export async function readReviewPromptState(
  now: Date = new Date(),
): Promise<ReviewPromptStateRead> {
  if (!Number.isFinite(now.getTime())) {
    return { status: 'unavailable', state: null, reason: 'invalid_clock' };
  }
  try {
    return await runAccountGenerationOperation((lease) =>
      readReviewPromptStateWithLease(lease, now),
    );
  } catch (error) {
    return {
      status: 'unavailable',
      state: null,
      reason:
        error instanceof AccountGenerationLeaseError ? 'account_boundary' : 'storage_unavailable',
    };
  }
}

async function exactReviewAttemptReadback(
  lease: AccountGenerationLease,
  expectedRaw: string,
): Promise<boolean> {
  try {
    const stored = await awaitAccountGenerationLease(lease, () =>
      readPrivateItem(REVIEW_PROMPT_KEY),
    );
    lease.assertCurrent();
    return stored.status === 'available' && stored.value === expectedRaw;
  } catch {
    lease.assertCurrent();
    return false;
  }
}

async function reserveReviewAttempt(
  lease: AccountGenerationLease,
  moment: ReviewValueMoment,
  now: Date,
): Promise<ReviewAttemptReservationResult> {
  let expectedRaw: string | null = null;
  let rejectedByPolicy = false;
  try {
    await awaitAccountGenerationLease(lease, () =>
      updatePrivateItem(REVIEW_PROMPT_KEY, (current) => {
        const state = current === null ? { attemptedAt: [] } : decodeState(current, now).state;
        const decision = canRequestReviewPrompt({
          enabled: env.phase8ReviewPromptEnabled,
          moment,
          state,
          now,
        });
        if (!decision.ok) {
          rejectedByPolicy = true;
          return current;
        }
        expectedRaw = encodeState(recordReviewAttempt(state, now));
        return expectedRaw;
      }),
    );
  } catch {
    // Re-throw owner replacement. A no-op contention loser remains a non-event;
    // a commit-then-reject is recovered only after exact same-lease readback.
    lease.assertCurrent();
    if (rejectedByPolicy) return { status: 'not_reserved' };
    if (expectedRaw === null) {
      return { status: 'unavailable', reason: 'storage_unavailable' };
    }
    return (await exactReviewAttemptReadback(lease, expectedRaw))
      ? { status: 'reserved' }
      : { status: 'unavailable', reason: 'write_unconfirmed' };
  }
  lease.assertCurrent();
  if (expectedRaw !== null) return { status: 'reserved' };
  if (rejectedByPolicy) return { status: 'not_reserved' };
  return { status: 'unavailable', reason: 'storage_unavailable' };
}

export async function requestReviewAfterValue(
  moment: ReviewValueMoment,
  now: Date = new Date(),
): Promise<void> {
  try {
    await runAccountGenerationOperation(async (lease) => {
      const stored = await readReviewPromptStateWithLease(lease, now);
      lease.assertCurrent();
      if (stored.status !== 'available' && stored.status !== 'absent') {
        track('review_prompt_unavailable', { moment });
        return;
      }

      const decision = canRequestReviewPrompt({
        enabled: env.phase8ReviewPromptEnabled,
        moment,
        state: stored.state,
        now,
      });

      if (!decision.ok) {
        lease.assertCurrent();
        track('review_prompt_skipped', { moment, reason: decision.reason });
        return;
      }

      let platformAvailable = false;
      try {
        platformAvailable = await awaitAccountGenerationLease(lease, StoreReview.hasAction);
      } catch {
        lease.assertCurrent();
      }
      if (!platformAvailable) {
        lease.assertCurrent();
        track('review_prompt_unavailable', { moment });
        return;
      }

      // Reserve the attempt durably before invoking the native prompt. This keeps
      // simultaneous callers and a crash after native handoff from double-prompting.
      const reservation = await reserveReviewAttempt(lease, moment, now);
      if (reservation.status === 'not_reserved') return;
      if (reservation.status === 'unavailable') {
        lease.assertCurrent();
        track('review_prompt_unavailable', { moment });
        return;
      }

      lease.assertCurrent();
      track('review_prompt_attempted', { moment });
      try {
        await awaitAccountGenerationLease(lease, StoreReview.requestReview);
      } catch {
        lease.assertCurrent();
        track('review_prompt_unavailable', { moment });
      }
    });
  } catch (error) {
    // Owner replacement cancels the stale value moment without attributing a
    // storage write, analytics event, or native handoff to the new account.
    if (error instanceof AccountGenerationLeaseError) return;
    track('review_prompt_unavailable', { moment });
  }
}
