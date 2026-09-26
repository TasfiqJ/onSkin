import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import * as Application from 'expo-application';
import * as StoreReview from 'expo-store-review';
import { AppState } from 'react-native';

import { track } from '@/lib/analytics/track';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';
import { env } from '@/lib/env';

import {
  canRequestReviewPrompt,
  recordReviewAttempt,
  type ReviewPromptState,
  type ReviewValueMoment,
} from './policy';

const REVIEW_PROMPT_KEY = 'layerwell.reviewPrompt.v1';
const SCHEMA_VERSION = 2 as const;
const PREVIOUS_SCHEMA_VERSION = 1 as const;
export const REVIEW_PROMPT_SETTLE_DELAY_MS = 2_000;
const MAX_APP_VERSION_LENGTH = 128;
const APP_VERSION_PATTERN = /^[\x21-\x7E]+$/u;
const LEGACY_UNKNOWN_APP_VERSION = 'legacy-v1-unknown';

export const REVIEW_PROMPT_STATE_INVALID = 'REVIEW_PROMPT_STATE_INVALID';
export const REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION = 'REVIEW_PROMPT_STATE_UNSUPPORTED_VERSION';

type ReviewPromptEnvelope = {
  version: typeof SCHEMA_VERSION;
  state: ReviewPromptState;
};

type PreviousReviewPromptEnvelope = {
  version: typeof PREVIOUS_SCHEMA_VERSION;
  state: { attemptedAt: string[] };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedAttemptHistory(value: unknown, now: Date): string[] | null {
  if (!isRecord(value)) return null;
  const attemptedAt = Array.isArray(value.attemptedAt) ? value.attemptedAt : [];
  const nowMs = now.getTime();
  return [
    ...new Set(
      attemptedAt
        .filter((item): item is string => typeof item === 'string')
        .map((item) => new Date(item))
        .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() <= nowMs)
        .sort((a, b) => a.getTime() - b.getTime())
        .map((date) => date.toISOString()),
    ),
  ];
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function currentAppVersion(): string | null {
  const candidate = Application.nativeApplicationVersion?.trim() ?? '';
  return candidate.length > 0 &&
    candidate.length <= MAX_APP_VERSION_LENGTH &&
    APP_VERSION_PATTERN.test(candidate)
    ? candidate
    : null;
}

function migratedState(value: unknown, now: Date): ReviewPromptState {
  const attemptedAt = normalizedAttemptHistory(value, now);
  if (
    !attemptedAt ||
    !isRecord(value) ||
    !hasExactKeys(value, ['attemptedAt']) ||
    JSON.stringify(attemptedAt) !== JSON.stringify(value.attemptedAt)
  ) {
    throw new Error(REVIEW_PROMPT_STATE_INVALID);
  }
  // Legacy attempts have no version metadata. Keep that uncertainty explicit;
  // their timestamps still enforce cooldown/cap, while the next accepted
  // attempt starts the exact per-version contract.
  return {
    attemptedAt,
    lastVersionPrompted: attemptedAt.length > 0 ? LEGACY_UNKNOWN_APP_VERSION : null,
  };
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
    if (parsed.version === PREVIOUS_SCHEMA_VERSION) {
      if (!hasExactKeys(parsed, ['version', 'state']) || !isRecord(parsed.state)) {
        throw new Error(REVIEW_PROMPT_STATE_INVALID);
      }
      return migratedState((parsed as unknown as PreviousReviewPromptEnvelope).state, now);
    }
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
    const normalized = normalizedAttemptHistory(parsed.state, now);
    const lastVersionPrompted = parsed.state.lastVersionPrompted;
    if (
      !normalized ||
      !hasExactKeys(parsed.state, ['attemptedAt', 'lastVersionPrompted']) ||
      JSON.stringify(normalized) !== JSON.stringify(parsed.state.attemptedAt) ||
      !(
        lastVersionPrompted === null ||
        (typeof lastVersionPrompted === 'string' &&
          lastVersionPrompted.length > 0 &&
          lastVersionPrompted.length <= MAX_APP_VERSION_LENGTH &&
          APP_VERSION_PATTERN.test(lastVersionPrompted))
      )
    ) {
      throw new Error(REVIEW_PROMPT_STATE_INVALID);
    }
    return { attemptedAt: normalized, lastVersionPrompted };
  }

  return migratedState(parsed, now);
}

function encodeState(state: ReviewPromptState): string {
  return JSON.stringify({ version: SCHEMA_VERSION, state } satisfies ReviewPromptEnvelope);
}

async function loadState(now: Date): Promise<ReviewPromptState | null> {
  try {
    const raw = await getPrivateItem(REVIEW_PROMPT_KEY);
    return raw === null
      ? { attemptedAt: [], lastVersionPrompted: null }
      : decodeState(raw, now);
  } catch {
    return null;
  }
}

async function reserveReviewAttempt(
  moment: ReviewValueMoment,
  appVersion: string,
  now: Date,
): Promise<boolean> {
  let reserved = false;
  try {
    await updatePrivateItem(REVIEW_PROMPT_KEY, (current) => {
      const state =
        current === null
          ? { attemptedAt: [], lastVersionPrompted: null }
          : decodeState(current, now);
      const decision = canRequestReviewPrompt({
        enabled: env.phase8ReviewPromptEnabled,
        moment,
        appVersion,
        state,
        now,
      });
      if (!decision.ok) return current;
      reserved = true;
      return encodeState(recordReviewAttempt(state, appVersion, now));
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
  await runCurrentHealthDataOperation(async (lease) => {
    const appVersion = currentAppVersion();
    const state = await loadState(now);
    lease.assertCurrent();
    if (!state) {
      track('review_prompt_unavailable', { moment });
      return;
    }
    const decision = canRequestReviewPrompt({
      enabled: env.phase8ReviewPromptEnabled,
      moment,
      appVersion,
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
      lease.assertCurrent();
      platformAvailable = false;
    }
    lease.assertCurrent();
    if (!platformAvailable) {
      track('review_prompt_unavailable', { moment });
      return;
    }

    // Apple recommends a natural pause after a completed task rather than a
    // prompt directly in response to the user's tap. Recheck account and app
    // activity after the pause; backgrounded or withdrawn sessions stay quiet.
    await new Promise<void>((resolve) => setTimeout(resolve, REVIEW_PROMPT_SETTLE_DELAY_MS));
    lease.assertCurrent();
    if (AppState.currentState !== 'active' || !appVersion) {
      track('review_prompt_unavailable', { moment });
      return;
    }

    // Reserve the attempt durably before invoking the native prompt. This keeps
    // simultaneous callers and a crash after native handoff from double-prompting.
    if (!(await reserveReviewAttempt(moment, appVersion, now))) {
      lease.assertCurrent();
      return;
    }
    lease.assertCurrent();
    if (AppState.currentState !== 'active') {
      track('review_prompt_unavailable', { moment });
      return;
    }

    track('review_prompt_attempted', { moment });
    lease.assertCurrent();
    try {
      await StoreReview.requestReview();
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      track('review_prompt_unavailable', { moment });
    }
  });
}
