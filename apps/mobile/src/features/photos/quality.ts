import type { PhotoQualityFlag } from '@layerwell/types';

import type { FramingAssessment, LightingAssessment } from './captureAnalysis';

/**
 * Converts measured post-capture framing and lighting into calm review copy.
 * Missing analysis stays explicitly unmeasured. Quality never blocks Save.
 */
export function reviewQuality(input: {
  framing: FramingAssessment;
  lighting: LightingAssessment;
  refLighting?: number | null;
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
  const muchDarker =
    input.refLighting != null &&
    input.lighting.score != null &&
    input.lighting.score < input.refLighting - 0.2;
  let flag: PhotoQualityFlag = 'unmeasured';
  if (aligned === true && wellLit === true && !muchDarker) flag = 'matched';
  else if (aligned === false && wellLit === false) flag = 'low';
  else if (aligned === false) flag = 'misaligned';
  else if (wellLit === false || muchDarker) flag = 'lighting_varies';
  return { flag, aligned, wellLit };
}
