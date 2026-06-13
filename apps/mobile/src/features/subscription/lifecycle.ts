import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadEntitlement } from './store';

/**
 * The reverse-trial / paid expiry → re-offer / graceful-downgrade trigger
 * (docs/08 §6/§13: "a next-launch check deactivates it at expiry and triggers the
 * re-offer"). Pure local logic on the local-first cache — offline-safe, no backend.
 * Fires AT MOST ONCE per distinct expiry (keyed on the lapsed record's expiresAt),
 * so it presents the honest re-offer once and never nags; after that, gated taps
 * surface the contextual upsell instead (docs/08 §3.2).
 */
const PROMPT_KEY = 'onskin.subscription.promptedExpiry';

export type LifecycleRoute = '/paywall/reoffer' | '/paywall/downgrade';

/** Returns the route to present on launch (and marks it prompted), or null. */
export async function pendingLifecycleRoute(nowISO: string): Promise<LifecycleRoute | null> {
  const e = await loadEntitlement();
  if (!e || !e.tier || !e.expiresAt) return null;
  const lapsed = !e.isActive || new Date(e.expiresAt).getTime() <= new Date(nowISO).getTime();
  if (!lapsed) return null;
  try {
    const prompted = await AsyncStorage.getItem(PROMPT_KEY);
    if (prompted === e.expiresAt) return null; // already re-offered for this expiry
    await AsyncStorage.setItem(PROMPT_KEY, e.expiresAt);
  } catch {
    /* if storage fails, fall through and present once */
  }
  return e.periodType === 'reverse_trial' ? '/paywall/reoffer' : '/paywall/downgrade';
}
