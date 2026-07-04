import AsyncStorage from '@react-native-async-storage/async-storage';
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

async function loadState(): Promise<ReviewPromptState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_PROMPT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ReviewPromptState>) : {};
    return { attemptedAt: Array.isArray(parsed.attemptedAt) ? parsed.attemptedAt : [] };
  } catch {
    return { attemptedAt: [] };
  }
}

async function saveState(state: ReviewPromptState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(state));
}

export async function requestReviewAfterValue(
  moment: ReviewValueMoment,
  now: Date = new Date(),
): Promise<void> {
  const state = await loadState();
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
