import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';
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

async function loadState(now: Date): Promise<ReviewPromptState> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(REVIEW_PROMPT_KEY);
  } catch {
    return { attemptedAt: [] };
  }
  if (!raw) return { attemptedAt: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeState(parsed, now);
    if (!normalized) {
      await removePrivateItem(REVIEW_PROMPT_KEY).catch(() => undefined);
      return { attemptedAt: [] };
    }
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      if (normalized.attemptedAt.length > 0)
        await setPrivateItem(REVIEW_PROMPT_KEY, JSON.stringify(normalized)).catch(() => undefined);
      else await removePrivateItem(REVIEW_PROMPT_KEY).catch(() => undefined);
    }
    return normalized;
  } catch {
    await removePrivateItem(REVIEW_PROMPT_KEY).catch(() => undefined);
    return { attemptedAt: [] };
  }
}

async function saveState(state: ReviewPromptState): Promise<void> {
  await setPrivateItem(REVIEW_PROMPT_KEY, JSON.stringify(state));
}

export async function requestReviewAfterValue(
  moment: ReviewValueMoment,
  now: Date = new Date(),
): Promise<void> {
  const state = await loadState(now);
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

  if (!(await StoreReview.hasAction())) {
    track('review_prompt_unavailable', { moment });
    return;
  }

  track('review_prompt_attempted', { moment });
  await StoreReview.requestReview();
  await saveState(recordReviewAttempt(state, now));
}
