import type { PhotoQualityFlag } from '@layerwell/types';

import type { FramingAssessment, LightingAssessment } from './captureAnalysis';

/**
 * Converts measured post-capture framing and lighting into calm review copy.
 * Missing analysis stays explicitly unmeasured. Quality never blocks Save.
 */
export function reviewQuality(input: {
  framing: FramingAssessment;
  lighting: LightingAssessment;
}): { flag: PhotoQualityFlag; aligned: boolean | null; wellLit: boolean | null } {
  const aligned =
    input.framing.state === 'matched' ? true : input.framing.state === 'adjust' ? false : null;
  const wellLit =
    input.lighting.state === 'good'
      ? true
      : input.lighting.state === 'too_dark' ||
          input.lighting.state === 'too_bright' ||
          input.lighting.state === 'uneven'
        ? false
        : null;
  let flag: PhotoQualityFlag = 'unmeasured';
  // A composite score mixes exposure, clipping, and side balance, so it cannot
  // truthfully establish that this capture is darker than the reference.
  if (aligned === true && wellLit === true) flag = 'matched';
  else if (aligned === false && wellLit === false) flag = 'low';
  else if (aligned === false) flag = 'misaligned';
  else if (wellLit === false) flag = 'lighting_varies';
  return { flag, aligned, wellLit };
}
