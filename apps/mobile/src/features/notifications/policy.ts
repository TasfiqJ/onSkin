import type { NotificationKind, NotificationTier } from '@onskin/types';

/**
 * Pure notification policy (docs/07 §3.1/§3.4, D-031): which tier a kind belongs
 * to, the per-tier weekly frequency caps that stop behavioural triggers stacking
 * into fatigue, and the quiet-hours window check. The utility tier is bounded by
 * the user's own schedule (no cap); immediate sends are suppressed inside quiet
 * hours, while recurring reminders are shifted to quiet-hours end. Deterministic
 * + unit-tested; consumed by the delivery layer's frequency-cap engine (§9).
 */

export const TIER_OF: Record<NotificationKind, NotificationTier> = {
  am_reminder: 'utility',
  pm_step: 'utility',
  capture: 'behavioural',
  replenishment: 'behavioural',
  rampup: 'behavioural',
  deescalation: 'behavioural',
  winback: 'promotional',
};

/** Per-tier weekly caps. Utility is bounded by the user's chosen times, not a cap. */
export const WEEKLY_CAP: Record<NotificationTier, number> = {
  utility: Infinity,
  behavioural: 3,
  promotional: 1,
};

export function tierOf(kind: NotificationKind): NotificationTier {
  return TIER_OF[kind];
}

/** The user toggles that govern delivery (a structural subset of NotifPrefs). */
export type TierToggles = {
  amEnabled: boolean;
  pmEnabled: boolean;
  streakNudges: boolean;
  replenishmentAlerts: boolean;
  captureReminders: boolean;
  promotionalOptIn: boolean;
};

/** Which user toggle governs each kind (docs/07 §3.1 "each independently
 *  controllable"). rampup/de-escalation have no dedicated surfaced toggle, so they
 *  fall under the legacy-schema `streakNudges` field surfaced as "Routine pacing
 *  suggestions"; no streak/adherence notification producer exists. winback is
 *  gated by the opt-in-only promotional toggle (§3.6/§8). */
export const TOGGLE_FOR: Record<NotificationKind, keyof TierToggles> = {
  am_reminder: 'amEnabled',
  pm_step: 'pmEnabled',
  capture: 'captureReminders',
  replenishment: 'replenishmentAlerts',
  rampup: 'streakNudges',
  deescalation: 'streakNudges',
  winback: 'promotionalOptIn',
};

/** Whether the user has the kind's governing tier enabled. The consent/opt-out
 *  gate the delivery layer must honour before any send (docs/07 §3.1, D-031). */
export function tierEnabled(kind: NotificationKind, toggles: TierToggles): boolean {
  return toggles[TOGGLE_FOR[kind]];
}

/** Minutes since midnight for an "HH:MM" or "HH:MM:SS" string; null for empty. */
export function toMinutes(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(':').map(Number);
  if (h == null || m == null || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Whether `now` falls inside the quiet-hours window. Handles overnight windows
 * (e.g. 22:00 → 07:00). No window set → never quiet.
 */
export function withinQuietHours(now: string, start: string | null, end: string | null): boolean {
  const n = toMinutes(now);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (n == null || s == null || e == null) return false;
  if (s === e) return false; // zero-length window
  return s < e ? n >= s && n < e : n >= s || n < e; // same-day vs overnight
}

/**
 * Scheduled reminders should not disappear when their chosen time is inside
 * quiet hours. Move them to quiet-hours end so the settings promise ("wait until
 * morning") matches the actual Expo trigger.
 */
export function reminderTimeOutsideQuietHours(
  hm: string,
  quietStart: string | null,
  quietEnd: string | null,
): string {
  return quietEnd !== null &&
    withinQuietHours(hm, quietStart, quietEnd) &&
    toMinutes(quietEnd) != null
    ? quietEnd
    : hm;
}

export type SendDecision = { allowed: boolean; reason?: 'quiet_hours' | 'frequency_cap' };

/**
 * Whether a notification of `kind` may be sent now, given how many of its TIER were
 * already sent this week and the quiet-hours window. Quiet hours suppress every
 * tier; the per-tier weekly cap suppresses the non-utility tiers.
 */
export function canSend(input: {
  kind: NotificationKind;
  sentThisWeekForTier: number;
  now: string;
  quietStart: string | null;
  quietEnd: string | null;
}): SendDecision {
  if (withinQuietHours(input.now, input.quietStart, input.quietEnd)) {
    return { allowed: false, reason: 'quiet_hours' };
  }
  if (input.sentThisWeekForTier >= WEEKLY_CAP[tierOf(input.kind)]) {
    return { allowed: false, reason: 'frequency_cap' };
  }
  return { allowed: true };
}
