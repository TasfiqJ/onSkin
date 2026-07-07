import type { LightingState, PhotoMilestone, PhotoQualityFlag } from '@onskin/types';

/**
 * Centralised, claim-safe copy for the photo-progress feature (docs/06 §9).
 *
 * The voice is honest, calm, no-scores, claim-safe. "honestly comparable," never
 * "your skin improved 23%," never "skin age" (docs/06 §4/§8). Because progress
 * photos are the most sensitive surface, the user-facing strings live HERE so the
 * `claimsafety.test.ts` regression guard can scan them on every edit (the Slice-11
 * pattern). Final marketing/consent wording is still owned by counsel under
 * B-PRIVACY / B-PRIVACY-COPY, but no edit may reintroduce a score, grade, drug
 * claim, or alarm word.
 *
 * `PHOTO_COPY` is the instructional/marketing/reassurance copy. It must be clean
 * of drug claims, alarm words, AND score/grade language. `NO_SCORE_COPY` is the
 * deliberate REFUSAL of scoring (docs/06 §8): it names "score / grade / skin age"
 * precisely to reject them, so the guard exempts it from the score check while
 * still holding it to the drug-claim + alarm-word bar.
 */

export const PHOTO_COPY = {
  // Progress tab header (design screen 04, docs/06 §4).
  tabTitle: 'Progress',
  tagline: 'Same light, same angle. Honestly comparable. No scores, no AI grades.',
  // Compare mode.
  compareNote: 'No “improvement %.” Just your two photos and their dates. You decide.',
  sliderHint: 'drag to wipe · tap a date to change',
  sideBySide: 'Side-by-side',
  // First run / honest expectations (design screen 03, docs/06 §2).
  firstRun: {
    title: 'Skin changes slowly. That’s normal.',
    body: 'Most actives take 8-12 weeks to show. The mirror hides that. A weekly photo doesn’t. It’s how you’ll see the change, and the reason not to quit early.',
    reassure: 'Guided, on your phone, and never scored.',
    cta: 'Take my first photo',
  },
  // Sparse (one photo) state (docs/06 §4).
  sparse: 'Take another in about a week to start comparing.',
  empty: 'Take your first photo. We’ll guide you, and it stays on your phone.',
  // Guided capture (design screen 01, docs/06 §3).
  capture: {
    onDevice: 'on device · never uploaded · no faceprint',
    ghostHint: 'align to the ghost of last week',
    autoReady: 'auto ready',
    lightingLabel: 'Lighting',
    skinPrep: 'Clean skin, no makeup, hair back. Same time of day as last week.',
    consentFailedTitle: 'Photo choice not saved',
    consentFailedBody: "We couldn't save your photo choice. Please try again before opening the camera.",
  },
  // Review & retake (design screen 02). Quality is FLAGGED, never blocked (D-029).
  review: {
    eyebrow: 'Review',
    retake: 'Retake',
    save: 'Save to my phone',
    missingEyebrow: 'Photo not captured',
    missingTitle: 'No photo to review yet.',
    missingBody: 'Take a new progress photo to open review. Nothing was saved.',
    missingCapture: 'Take photo',
    missingBack: 'Back to Progress',
  },
  // Single-photo detail (design screen 06).
  detail: {
    noteLabel: 'Your note',
    setReference: 'Set as reference',
    missingEyebrow: 'Photo unavailable',
    missingTitle: 'This photo is no longer on this phone.',
    missingBody:
      'It may have been deleted or belong to another local timeline. Your Progress tab is still safe.',
    missingCapture: 'Take a new photo',
    missingBack: 'Back to Progress',
    shareLabel: 'Share photo',
    shareTitle: 'Share this photo?',
    shareBody: 'This sends the photo image you choose. It is not blurred, and your notes are not included.',
    shareConfirm: 'Share photo',
    shareUnavailable:
      "Sharing isn't available on this device. Your photo stays on your phone unless you choose another way to export it.",
    notePlaceholder: 'Add a note. “started retinol”, “travel breakout”',
  },
  // Privacy / app-lock (design screen 08, docs/06 §7).
  lock: {
    title: 'Your timeline is locked.',
    body: "Use your phone's unlock to keep your photos for your eyes only. They live on this phone, encrypted.",
    unlock: 'Unlock',
    cloudTitle: 'Encrypted cloud backup',
    cloudOff: 'Off. A separate choice. Photos stay on-device until you turn it on.',
    cloudTradeoff:
      'The most private option also means a lost phone can mean lost photos. Backup is encrypted and you can turn it off anytime.',
  },
  // Calm capture reminder (design screen 09, docs/06 §5). Delivery is doc #7.
  reminder: {
    title: 'Time for a progress photo?',
    body: 'Same morning light as last week. It only takes a moment. Skip if now’s not good.',
    footnote: 'consistent time of day for a fair comparison · a missed week never breaks anything',
  },
} as const;

/** The deliberate no-AI-score stance (design screen 07, docs/06 §8). It NAMES
 *  score/grade/skin-age to refuse them. Exempt from the score-claim check. */
export const NO_SCORE_COPY = {
  title: 'We’ll never give your skin a score.',
  body: 'A number from a phone selfie is mostly lighting and angle. False precision dressed up as objectivity, so we don’t. You get genuinely comparable photos and your own judgment, which is both more honest and more accurate.',
  bullets: [
    'No “skin age,” no grade, no improvement %.',
    'No anxiety-inducing number to watch go up or down.',
    'Honest about phone-photo limits. White light reads tone & redness poorly, especially in deeper skin.',
  ],
  footer: 'If we ever add analysis, it’ll be separate, consented, fairness-checked, and never a hazard score.',
} as const;

/** Real-time capture coaching (docs/06 §3). Calm, plain, one instruction at a time. */
export const COACHING: Record<string, string> = {
  ready: 'Hold still. Looking good',
  turn_left: 'Turn slightly left. Almost there',
  turn_right: 'Turn slightly right. Almost there',
  closer: 'Move a little closer',
  farther: 'Move back a little',
  chin_down: 'Lower your chin',
  chin_up: 'Lift your chin a touch',
  level: 'Level your phone',
  no_face: 'Center your face in the guide',
};

/** On-device lighting states → calm label + bar fill (docs/06 §3). */
export const LIGHTING_LABEL: Record<LightingState, string> = {
  good: 'Good',
  too_dark: 'Too dark',
  too_warm: 'Too warm',
  uneven: 'Uneven',
};

/** Calm review notes. Flagged, never blocked (docs/06 §3, D-029). */
export const QUALITY_NOTE: Record<PhotoQualityFlag, string> = {
  matched: 'Nicely matched to last time. A clean comparison.',
  darker: 'A little darker than usual. Retake, or keep it?',
  misaligned: 'A bit off from last time. Retake, or keep it?',
  low: 'This one’s a little different from usual. Keep it if you like.',
};

/** Calm, non-gamified milestone markers (docs/06 §4). */
export const MILESTONE_COPY: Record<PhotoMilestone, string> = {
  first: 'Your first photo. The start of your timeline.',
  four_weeks: 'Four weeks in. Change starts to show around now.',
  one_cycle: 'One cycle complete. 12 weeks of photos. Look how far you’ve come.',
};
