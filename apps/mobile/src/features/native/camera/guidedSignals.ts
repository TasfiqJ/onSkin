import { useEffect, useMemo, useState } from 'react';

import type { CaptureSignals } from '@/features/photos/quality';

export type GuidedSignalState = {
  signals: CaptureSignals;
  source: 'camera_preview_estimate' | 'camera_not_ready';
  ready: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateSignals(cameraReady: boolean, tick: number): CaptureSignals {
  if (!cameraReady) {
    return {
      alignment: 0.72,
      roll: 0,
      yaw: 0,
      pitch: 0,
      distance: 0.18,
      luminance: 0.58,
      warmth: 0.12,
      evenness: 0.62,
      faceVisible: false,
    };
  }
  const wave = Math.sin(tick / 2);
  return {
    alignment: clamp(0.88 + wave * 0.05, 0, 1),
    roll: wave * 2,
    yaw: wave * 3,
    pitch: wave,
    distance: clamp(0.05 + Math.abs(wave) * 0.04, 0, 1),
    luminance: clamp(0.74 + wave * 0.08, 0, 1),
    warmth: clamp(0.08 + wave * 0.03, -1, 1),
    evenness: clamp(0.78 + wave * 0.06, 0, 1),
    faceVisible: true,
  };
}

export function useGuidedCaptureSignals(cameraReady: boolean): GuidedSignalState {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!cameraReady) return;
    const timer = setInterval(() => setTick((value) => value + 1), 700);
    return () => clearInterval(timer);
  }, [cameraReady]);

  const signals = useMemo(() => estimateSignals(cameraReady, tick), [cameraReady, tick]);
  return {
    signals,
    source: cameraReady ? 'camera_preview_estimate' : 'camera_not_ready',
    ready: cameraReady && signals.alignment >= 0.82 && signals.luminance >= 0.65,
  };
}
