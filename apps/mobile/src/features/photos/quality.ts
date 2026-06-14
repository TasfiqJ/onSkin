import type { LightingState, PhotoQualityFlag } from '@onskin/types';

import { COACHING, LIGHTING_LABEL } from './copy';

/**
 * Pure guided-capture quality logic (docs/06 §3). The on-device face detector +
 * frame-buffer luminance feed these signals; this module turns them into the
 * coaching line, the lighting indicator, the "ready" gate (auto-capture when all
 * tolerances are met), and the calm review verdict. NO faceprint is involved , 
 * these are per-frame guidance signals, discarded after the shot (docs/06 §7).
 *
 * Quality is FLAGGED, never BLOCKED (docs/06 §3, the doc's D-029): `isCaptureReady`
 * only drives the auto-shutter affordance; the user can always capture manually.
 *
 * The tolerances are capture-UX starting positions and need on-device tuning
 * (docs/06 §10 caveat. B-CAMERA), NOT clinical sign-off.
 */

export type CaptureSignals = {
  /** Face present + matched to the guide (0..1). */
  alignment: number;
  /** Head pose in degrees (0 = neutral). +yaw = turned right, +pitch = chin up. */
  roll: number;
  yaw: number;
  pitch: number;
  /** Distance error: <0 too far (face too small), >0 too close. Normalised −1..1. */
  distance: number;
  /** Frame-buffer lighting, 0..1 (luminance), warmth −1..1, evenness 0..1. */
  luminance: number;
  warmth: number;
  evenness: number;
  /** Whether the detector currently sees exactly one face. */
  faceVisible: boolean;
};

export const CAPTURE_TOLERANCE = {
  alignmentReady: 0.85,
  maxRollDeg: 6,
  maxYawDeg: 8,
  maxPitchDeg: 8,
  maxDistance: 0.18,
  lightingReady: 0.7,
} as const;

/** On-device lighting check → state + calm label + bar fill (0..1) for the UI. */
export function lightingState(s: Pick<CaptureSignals, 'luminance' | 'warmth' | 'evenness'>): {
  state: LightingState;
  label: string;
  fill: number;
} {
  let state: LightingState = 'good';
  if (s.luminance < 0.45) state = 'too_dark';
  else if (s.evenness < 0.6) state = 'uneven';
  else if (s.warmth > 0.35) state = 'too_warm';
  // Fill blends brightness + evenness so the bar reflects overall quality, clamped.
  const raw = s.luminance * 0.7 + s.evenness * 0.3 - Math.max(0, s.warmth - 0.35) * 0.5;
  const fill = Math.max(0, Math.min(1, raw));
  return { state, label: LIGHTING_LABEL[state], fill };
}

/** Lighting is "ready" when it's good enough. Calm guidance otherwise. */
export function lightingReady(s: Pick<CaptureSignals, 'luminance' | 'warmth' | 'evenness'>): boolean {
  return lightingState(s).fill >= CAPTURE_TOLERANCE.lightingReady && lightingState(s).state === 'good';
}

/** Alignment + pose + distance all within tolerance (lighting checked separately). */
export function poseAligned(s: CaptureSignals): boolean {
  const t = CAPTURE_TOLERANCE;
  return (
    s.faceVisible &&
    s.alignment >= t.alignmentReady &&
    Math.abs(s.roll) <= t.maxRollDeg &&
    Math.abs(s.yaw) <= t.maxYawDeg &&
    Math.abs(s.pitch) <= t.maxPitchDeg &&
    Math.abs(s.distance) <= t.maxDistance
  );
}

/** All-clear → the auto-shutter arms (docs/06 §3). The user can still tap manually. */
export function isCaptureReady(s: CaptureSignals): boolean {
  return poseAligned(s) && lightingReady(s);
}

/**
 * The single most-relevant calm coaching line (docs/06 §3, the spec's "Turn
 * slightly left. Almost there"). One instruction at a time; pose first, then
 * lighting, so the user isn't asked to fix five things at once.
 */
export function coachingLine(s: CaptureSignals): string {
  const t = CAPTURE_TOLERANCE;
  if (!s.faceVisible) return COACHING.no_face!;
  // Biggest pose offender first.
  const offenders: { key: keyof typeof COACHING; over: number }[] = [];
  if (s.yaw > t.maxYawDeg) offenders.push({ key: 'turn_left', over: s.yaw - t.maxYawDeg });
  if (s.yaw < -t.maxYawDeg) offenders.push({ key: 'turn_right', over: -s.yaw - t.maxYawDeg });
  if (s.pitch > t.maxPitchDeg) offenders.push({ key: 'chin_down', over: s.pitch - t.maxPitchDeg });
  if (s.pitch < -t.maxPitchDeg) offenders.push({ key: 'chin_up', over: -s.pitch - t.maxPitchDeg });
  if (Math.abs(s.roll) > t.maxRollDeg) offenders.push({ key: 'level', over: Math.abs(s.roll) - t.maxRollDeg });
  if (s.distance < -t.maxDistance) offenders.push({ key: 'closer', over: -s.distance - t.maxDistance });
  if (s.distance > t.maxDistance) offenders.push({ key: 'farther', over: s.distance - t.maxDistance });
  if (offenders.length) {
    offenders.sort((a, b) => b.over - a.over);
    return COACHING[offenders[0]!.key]!;
  }
  if (s.alignment < t.alignmentReady) return COACHING.no_face!;
  // Pose is fine; nudge lighting if needed, else "ready".
  if (!lightingReady(s)) {
    const ls = lightingState(s);
    if (ls.state === 'too_dark') return 'A little more light. Face a window';
    if (ls.state === 'too_warm') return 'Cooler, even light reads truer';
    if (ls.state === 'uneven') return 'Even out the light on your face';
  }
  return COACHING.ready!;
}

/**
 * Calm review verdict (docs/06 §3). Compares the captured shot to its reference so
 * the note is honest ("Nicely matched to last time" / "A little darker than
 * usual. Retake?"). Returns the flag, the aligned/well-lit chip booleans, and
 * the note key. Quality is surfaced, NEVER used to block the save.
 */
export function reviewQuality(input: {
  alignment: number;
  lighting: number;
  refLighting?: number | null;
}): { flag: PhotoQualityFlag; aligned: boolean; wellLit: boolean } {
  const aligned = input.alignment >= CAPTURE_TOLERANCE.alignmentReady;
  const wellLit = input.lighting >= CAPTURE_TOLERANCE.lightingReady;
  // "darker than usual" only relative to the reference, when we have one.
  const muchDarker = input.refLighting != null && input.lighting < input.refLighting - 0.2;
  let flag: PhotoQualityFlag = 'matched';
  if (!aligned && !wellLit) flag = 'low';
  else if (!aligned) flag = 'misaligned';
  else if (!wellLit || muchDarker) flag = 'darker';
  return { flag, aligned, wellLit };
}
