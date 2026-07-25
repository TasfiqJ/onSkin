import type { NotificationKind } from '@onskin/types';

import { BRAND } from '@/lib/brand';

/**
 * Centralised, calm + claim-safe copy for the engagement layer (docs/07 §3.3/§4,
 * the Slice-11/20 guard pattern). Voice: gentle nudges, never noise. NO guilt
 * ("Don't break your streak"), NO manufactured urgency, NO drug/disease claims,
 * NO alarm words (docs/07 §2/§3.3). Health-adjacent detail is discreet by default
 * (§3.6): the lock-screen body stays generic; the scheduler's specifics surface
 * only in-app. `claimsafety.test.ts` scans
 * these on every edit. Final marketing/consent wording: B-PRIVACY / B-PRIVACY-COPY.
 */

export type ReminderCopy = {
  /** In-app / detail title. */
  title: string;
  /** In-app / detail body (may name the routine step where the scheduler provides it). */
  body: string;
  /** Generic lock-screen body. No product or condition names (§3.6). */
  discreet: string;
};

export const LOCK_SCREEN_NOTIFICATION_TITLE = BRAND.appName;

export const REMINDER_COPY: Record<NotificationKind, ReminderCopy> = {
  am_reminder: {
    title: 'Good morning',
    body: 'Your morning routine’s ready when you are.',
    discreet: 'Your morning routine’s ready.',
  },
  pm_step: {
    title: 'This evening',
    body: 'Tonight’s step is ready. Keep it simple.',
    discreet: 'Your evening routine’s ready.',
  },
  capture: {
    title: 'Time for a progress photo?',
    body: 'Same light as last week. It only takes a moment. Skip if now’s not good.',
    discreet: 'A gentle check-in is ready.',
  },
  replenishment: {
    title: 'A shelf update is ready',
    body: 'A tracked freshness date or finished product may be worth a look when you have a moment.',
    discreet: 'A shelf update is ready.',
  },
  rampup: {
    title: 'Ready for a small step-up?',
    body: 'Your skin’s been steady. We can add a night when you’re ready.',
    discreet: 'A routine suggestion is ready.',
  },
  deescalation: {
    title: 'Let’s ease off a little',
    body: 'A few recovery nights will help your skin settle. We’ll keep it gentle.',
    discreet: 'A routine suggestion is ready.',
  },
  winback: {
    title: 'Your timeline’s waiting',
    body: 'Pick up your routine whenever you’re ready. Consistency over time is what counts.',
    discreet: 'Your routine’s waiting whenever you’re ready.',
  },
};

export function notificationContentForLockScreen(kind: NotificationKind): {
  title: string;
  body: string;
} {
  const c = REMINDER_COPY[kind];
  return { title: LOCK_SCREEN_NOTIFICATION_TITLE, body: c.discreet };
}

/** Soft-ask permission priming (design screen 01, docs/07 §3.2). */
export const SOFT_ASK = {
  title: 'A gentle morning and evening nudge?',
  body: 'Turning this on uses the morning and evening times in Settings. On a new setup, those start at 7:30 AM and 9:30 PM. Both stay generic on your lock screen.',
  bullets: [
    'New setups start at 7:30 AM and 9:30 PM',
    'Discreet on your lock screen',
    'Change or turn off each reminder anytime',
  ],
  yes: 'Yes, remind me',
  no: 'Not now',
} as const;

/** Calm earn-back after a lapse (design screen 04, docs/07 §4.2). */
export const WELCOME_BACK = {
  title: 'Welcome back.',
  // when freezes absorbed the gap (streak safe)
  safeBody:
    'You missed a couple of evenings. That’s completely fine. Skin doesn’t keep score, and neither do we. Pick up tonight and you’re right back in your rhythm.',
  safeTagTitle: (n: number) => `Your ${n}-day streak is safe`,
  safeTagBody: 'Grace days absorbed the gap. No reset.',
  // when the streak lapsed (no freeze left). Still no shame
  lapsedBody:
    'It’s been a few days. That’s okay. Start again tonight; consistency over time is what counts, not a perfect chain.',
  cta: 'Tonight’s step',
} as const;

/** Calm milestone copy (docs/07 §4.5). Gentle markers, never confetti-cannon. */
export const MILESTONE_COPY: Record<string, string> = {
  d7: 'One week of showing up. That’s how habits start.',
  one_cycle: 'A full cycle in. Your progress photos may start to show it.',
  d30: 'Thirty days of consistency. Quietly, this is the work paying off.',
};

/** Settings-surface labels (design screens 02/03). */
export const SETTINGS_COPY = {
  capNote: 'we cap gentle nudges so they never stack up',
  discreetLabel: 'Lock screen privacy',
  discreetHint: 'Always generic; product, photo, and condition details stay inside the app',
  quietLabel: 'Nothing fires',
  permissionRecovery: {
    askTitle: 'Notifications need your permission',
    askBody:
      'Your reminder choices are saved. Allow notifications to deliver them on this device.',
    deniedTitle: 'Reminders paused by device settings',
    deniedBody:
      'Your reminder choices are still saved. Open this device’s settings to allow notifications.',
    unavailableTitle: 'Notification access unavailable',
    unavailableBody:
      'Your reminder choices are still saved. This device could not confirm notification access.',
    promptFailure:
      'Notification access did not change. Try again, or allow notifications from your system Settings app.',
    settingsFailure:
      'Device settings could not be opened. Try again from your system Settings app.',
  },
} as const;
