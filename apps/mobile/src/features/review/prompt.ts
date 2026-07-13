import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import * as StoreReview from 'expo-store-review';

import { track } from '@/lib/analytics/track';
import { env } from '@/lib/env';

import {
  canRequestReviewPrompt,
  recordReviewAttempt,
  type ReviewPromptState,
  type ReviewValueMoment,
} from './policy';

const REVIEW_PROMPT_KEY = 'onskin.reviewPrompt.v1';
const SCHEMA_VERSION = 1 as const;

export const REVIEW_PROMPT_STATE_INVALID = 'REVIEW_PROMPT_STATE_INVALID';
export const REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION = 'REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION';

type ReviewPromptEnvelope = {
  version: typeof SCHEMA_VERSION;
  state: ReviewPromptState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeState(value: unknown, now: Date): ReviewPromptState | null {
  if (!isRecord(value)) return null;
  const attemptedAt = Array.isArray(value.attemptedAt) ? value.attemptedAt : [];
  const nowMs = now.getTime();
  return {
    attemptedAt: [
      ...new Set(
        attemptedAt
          .filter((item): item is string => typeof item === 'string')
          .map((item) => new Date(item))
          .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() <= nowMs)
          .sort((a, b) => a.getTime() - b.getTime())
          .map((date) => date.toISOString()),
      ),
    ],
  };
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function decodeState(raw: string, now: Date): ReviewPromptState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(REVIEW_PROMPT_STATE_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(REVIEW_PROMPT_STATE_INVALID);

  if (hasOwn(parsed, 'version')) {
    if (parsed.version !== SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > SCHEMA_VERSION
      ) {
        throw new Error(REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION);
      }
      throw new Error(REVIEW_PROMPT_STATE_INVALID);
    }
    if (!hasExactKeys(parsed, ['version', 'state']) || !isRecord(parsed.state)) {
      throw new Error(REVIEW_PROMPT_STATE_INVALID);
    }
    const normalized = normalizeState(parsed.state, now);
    if (
      !normalized ||
      !hasExactKeys(parsed.state, ['attemptedAt']) ||
      JSON.stringify(normalized) !== JSON.stringify(parsed.state)
    ) {
      throw new Error(REVIEW_PROMPT_STATE_INVALID);
    }
    return normalized;
  }

  const normalized = normalizeState(parsed, now);
  if (!normalized) throw new Error(REVIEW_PROMPT_STATE_INVALID);
  return normalized;
}

function encodeState(state: ReviewPromptState): string {
  return JSON.stringify({ version: SCHEMA_VERSION, state } satisfies ReviewPromptEnvelope);
}

async function loadState(now: Date): Promise<ReviewPromptState | null> {
  try {
    const raw = await getPrivateItem(REVIEW_PROMPT_KEY);
    return raw === null ? { attemptedAt: [] } : decodeState(raw, now);
  } catch {
    return null;
  }
}

async function reserveReviewAttempt(moment: ReviewValueMoment, now: Date): Promise<boolean> {
  let reserved = false;
  try {
    await updatePrivateItem(REVIEW_PROMPT_KEY, (current) => {
      const state = current === null ? { attemptedAt: [] } : decodeState(current, now);
      const decision = canRequestReviewPrompt({
        enabled: env.phase8ReviewPromptEnabled,
        moment,
        state,
        now,
      });
      if (!decision.ok) return current;
      reserved = true;
      return encodeState(recordReviewAttempt(state, now));
    });
  } catch {
    return false;
  }
  return reserved;
}

export async function requestReviewAfterValue(
  moment: ReviewValueMoment,
  now: Date = new Date(),
): Promise<void> {
  const state = await loadState(now);
  if (!state) {
    track('review_prompt_unavailable', { moment });
    return;
  }
  const decision = canRequestReviewPrompt({
    enabled: env.phase8ReviewPromptEnabled,
    moment,
    state,
    now,
  });

  if (!decision.ok) {
    track('review_prompt_skipped', { moment, reason: decision.reason });
    return;
  }

  let platformAvailable = false;
  try {
    platformAvailable = await StoreReview.hasAction();
  } catch {
    platformAvailable = false;
  }
  if (!platformAvailable) {
    track('review_prompt_unavailable', { moment });
    return;
  }

  // Reserve the attempt durably before invoking the native prompt. This keeps
  // simultaneous callers and a crash after native handoff from double-prompting.
  if (!(await reserveReviewAttempt(moment, now))) return;

  track('review_prompt_attempted', { moment });
  try {
    await StoreReview.requestReview();
  } catch {
    track('review_prompt_unavailable', { moment });
  }
}
