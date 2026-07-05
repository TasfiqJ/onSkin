import type { GoalId } from '@onskin/types';

import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import type { SkinProfileResult } from './quiz';

// Local-first onboarding-completion record (D-029, the pattern shared with the
// shelf / completions / cycle stores). The server `skin_profiles` row is the
// eventual sync target (B-SUPABASE), but in v1 this AsyncStorage record is the
// SOURCE OF TRUTH for "has this user finished onboarding?" so a failed or slow
// server write never strands a returning user back at the start of onboarding
// (the entry gate in app/index.tsx previously read only the never-populated
// server table). It also preserves the computed reveal data across a cold start.
const KEY = 'onskin.skinprofile.v1';

export type StoredSkinProfile = {
  result: SkinProfileResult;
  goals: GoalId[];
  completedAt: string; // ISO
};

export async function getStoredSkinProfile(): Promise<StoredSkinProfile | null> {
  try {
    const raw = await getPrivateItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSkinProfile) : null;
  } catch {
    return null;
  }
}

export async function setStoredSkinProfile(rec: StoredSkinProfile): Promise<void> {
  await setPrivateItem(KEY, JSON.stringify(rec));
}

/** Has the user completed onboarding on this device? (the entry-gate signal). */
export async function isOnboardedLocal(): Promise<boolean> {
  return (await getStoredSkinProfile()) !== null;
}

/** Cleared on account deletion / full reset (not on an in-session retry). */
export async function clearStoredSkinProfile(): Promise<void> {
  await removePrivateItem(KEY);
}
