import type { CaptureSignals } from './quality';

// Mock capture signals for the pre-camera build (B-CAMERA). The real on-device
// face detector + frame-buffer luminance produce these per frame; until then this
// lets the guided-capture chrome be driven by the REAL engine (quality.ts) rather
// than hardcoded "Good" / "Hold still" strings, and lets each saved photo carry
// slightly varied alignment/lighting scores instead of two frozen constants (so
// the review "a little darker than usual" comparison can actually fire). The live
// evolving stream (pose changing as the user moves) is B-CAMERA.

/** A steady, near-ready signal for the live chrome (engine renders it as "ready"). */
export function demoReadySignals(): CaptureSignals {
  return {
    alignment: 0.93,
    roll: 1,
    yaw: 2,
    pitch: 1,
    distance: 0.03,
    luminance: 0.82,
    warmth: 0.08,
    evenness: 0.85,
    faceVisible: true,
  };
}

/** A captured frame's signals with small per-shot variation (jitter in 0..1). */
export function capturedSignals(jitter: number): CaptureSignals {
  const j = Math.max(0, Math.min(1, jitter));
  return {
    ...demoReadySignals(),
    alignment: 0.88 + j * 0.1, // 0.88..0.98
    luminance: 0.6 + j * 0.32, // 0.60..0.92 → varied lighting fill
    evenness: 0.74 + j * 0.18,
  };
}
