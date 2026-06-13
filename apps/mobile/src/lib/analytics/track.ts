import type { OnboardingEvent } from '@onskin/types';

// BLOCKED: B-POSTHOG — real PostHog wiring (with bootstrapped flags + identify at
// the value moment) lands in the analytics slice. This no-op shim lets screens
// instrument the docs/01 §7 funnel taxonomy now without a hard dependency.
export function track(event: OnboardingEvent | string, props?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log('[analytics]', event, props ?? {});
  }
}

// Call at the anonymous->permanent conversion (account creation) per docs/01 §7.
export function identify(userId: string, props?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log('[analytics] identify', userId, props ?? {});
  }
}
