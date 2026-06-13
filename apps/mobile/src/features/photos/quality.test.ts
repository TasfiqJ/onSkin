import { describe, expect, it } from 'vitest';

import {
  CAPTURE_TOLERANCE,
  coachingLine,
  isCaptureReady,
  lightingReady,
  lightingState,
  poseAligned,
  reviewQuality,
  type CaptureSignals,
} from './quality';

// A perfectly-aligned, well-lit frame — the auto-shutter "ready" baseline.
const READY: CaptureSignals = {
  alignment: 0.95,
  roll: 1,
  yaw: 2,
  pitch: -1,
  distance: 0.02,
  luminance: 0.8,
  warmth: 0.05,
  evenness: 0.85,
  faceVisible: true,
};

describe('lighting check (docs/06 §3)', () => {
  it('reads good, even, neutral light as Good', () => {
    const r = lightingState(READY);
    expect(r.state).toBe('good');
    expect(r.label).toBe('Good');
    expect(r.fill).toBeGreaterThan(CAPTURE_TOLERANCE.lightingReady);
  });
  it('flags too dark / too warm / uneven calmly', () => {
    expect(lightingState({ luminance: 0.3, warmth: 0, evenness: 0.9 }).state).toBe('too_dark');
    expect(lightingState({ luminance: 0.8, warmth: 0.5, evenness: 0.9 }).state).toBe('too_warm');
    expect(lightingState({ luminance: 0.8, warmth: 0, evenness: 0.4 }).state).toBe('uneven');
  });
  it('lightingReady only when good and bright enough', () => {
    expect(lightingReady(READY)).toBe(true);
    expect(lightingReady({ luminance: 0.3, warmth: 0, evenness: 0.9 })).toBe(false);
  });
});

describe('capture readiness — the auto-shutter gate (docs/06 §3, D-029)', () => {
  it('arms when pose + lighting are all within tolerance', () => {
    expect(poseAligned(READY)).toBe(true);
    expect(isCaptureReady(READY)).toBe(true);
  });
  it('does not arm with no face', () => {
    expect(isCaptureReady({ ...READY, faceVisible: false })).toBe(false);
  });
  it('does not arm when turned too far', () => {
    expect(isCaptureReady({ ...READY, yaw: 20 })).toBe(false);
  });
  it('does not arm in poor light even when posed', () => {
    expect(poseAligned({ ...READY, luminance: 0.2 })).toBe(true);
    expect(isCaptureReady({ ...READY, luminance: 0.2 })).toBe(false);
  });
});

describe('coaching line — one calm instruction at a time (the spec line)', () => {
  it('asks to turn left when the head is turned right past tolerance', () => {
    expect(coachingLine({ ...READY, yaw: 14 })).toBe('Turn slightly left — almost there');
  });
  it('asks to turn right for the opposite', () => {
    expect(coachingLine({ ...READY, yaw: -14 })).toBe('Turn slightly right — almost there');
  });
  it('asks to lower the chin when pitched up', () => {
    expect(coachingLine({ ...READY, pitch: 16 })).toBe('Lower your chin');
  });
  it('asks to move closer when too far', () => {
    expect(coachingLine({ ...READY, distance: -0.4 })).toBe('Move a little closer');
  });
  it('centers the face when none is detected', () => {
    expect(coachingLine({ ...READY, faceVisible: false })).toBe('Center your face in the guide');
  });
  it('surfaces the biggest offender first when several are off', () => {
    // yaw is further over tolerance than pitch → turn instruction wins.
    expect(coachingLine({ ...READY, yaw: 30, pitch: 12 })).toBe('Turn slightly left — almost there');
  });
  it('says ready when everything is in tolerance', () => {
    expect(coachingLine(READY)).toBe('Hold still — looking good');
  });
});

describe('review verdict — flagged, never blocked (docs/06 §3, D-029)', () => {
  it('matched when aligned + well-lit', () => {
    expect(reviewQuality({ alignment: 0.95, lighting: 0.85 }).flag).toBe('matched');
  });
  it('darker when noticeably under the reference lighting', () => {
    expect(reviewQuality({ alignment: 0.95, lighting: 0.74, refLighting: 0.95 }).flag).toBe('darker');
  });
  it('misaligned when off but well-lit', () => {
    const r = reviewQuality({ alignment: 0.5, lighting: 0.85 });
    expect(r.flag).toBe('misaligned');
    expect(r.aligned).toBe(false);
    expect(r.wellLit).toBe(true);
  });
  it('low when both are off — still returns a verdict (save is never blocked)', () => {
    expect(reviewQuality({ alignment: 0.3, lighting: 0.3 }).flag).toBe('low');
  });
});
