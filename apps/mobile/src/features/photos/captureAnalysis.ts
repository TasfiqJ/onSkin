export type ImageDimensions = {
  width: number;
  height: number;
};

export type FaceObservation = {
  frame: {
    origin: { x: number; y: number };
    size: { x: number; y: number };
  };
  headEulerAngleX?: number | null;
  headEulerAngleY?: number | null;
  headEulerAngleZ?: number | null;
};

export type FaceDetectionResult = {
  success: boolean;
  faces: unknown[];
};

export type FramingState =
  | 'checking'
  | 'matched'
  | 'adjust'
  | 'no_face'
  | 'multiple_faces'
  | 'unavailable';

export type FramingAssessment = {
  state: FramingState;
  score: number | null;
  headRoll: number | null;
  headYaw: number | null;
  headPitch: number | null;
  centerOffsetX: number | null;
  centerOffsetY: number | null;
  faceHeightRatio: number | null;
};

export type LightingAssessmentState =
  | 'checking'
  | 'good'
  | 'too_dark'
  | 'too_bright'
  | 'uneven'
  | 'unavailable';

export type LightingAssessment = {
  state: LightingAssessmentState;
  score: number | null;
  meanLuminance: number | null;
  sideDifference: number | null;
  clippedFraction: number | null;
};

export type CaptureAnalysisStatus = 'checking' | 'complete' | 'unavailable';

export type CaptureAnalysis = {
  status: CaptureAnalysisStatus;
  framing: FramingAssessment;
  lighting: LightingAssessment;
};

export type RgbaImage = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

export const CAPTURE_ANALYSIS_TOLERANCE = {
  targetCenterX: 0.5,
  targetCenterY: 0.47,
  targetFaceHeightRatio: 0.56,
  maxCenterOffsetX: 0.16,
  maxCenterOffsetY: 0.18,
  minFaceHeightRatio: 0.34,
  maxFaceHeightRatio: 0.78,
  maxRollDegrees: 8,
  maxYawDegrees: 10,
  maxPitchDegrees: 10,
  matchedScore: 0.72,
  minGoodLuminance: 0.28,
  maxGoodLuminance: 0.82,
  maxSideDifference: 0.22,
  maxClippedFraction: 0.38,
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function validatedFaceObservations(
  result: FaceDetectionResult | null | undefined,
): FaceObservation[] | null {
  if (result?.success !== true || !Array.isArray(result.faces)) return null;
  const observations: FaceObservation[] = [];
  for (const candidate of result.faces) {
    if (typeof candidate !== 'object' || candidate === null || !('frame' in candidate)) return null;
    const frame = candidate.frame;
    if (
      typeof frame !== 'object' ||
      frame === null ||
      !('origin' in frame) ||
      !('size' in frame) ||
      typeof frame.origin !== 'object' ||
      frame.origin === null ||
      typeof frame.size !== 'object' ||
      frame.size === null
    ) {
      return null;
    }
    const origin = frame.origin as Record<string, unknown>;
    const size = frame.size as Record<string, unknown>;
    if (
      ![origin.x, origin.y, size.x, size.y].every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )
    ) {
      return null;
    }
    const native = candidate as Record<string, unknown>;
    const observation: FaceObservation = {
      frame: {
        origin: { x: origin.x as number, y: origin.y as number },
        size: { x: size.x as number, y: size.y as number },
      },
    };
    if (typeof native.headEulerAngleX === 'number' && Number.isFinite(native.headEulerAngleX)) {
      observation.headEulerAngleX = native.headEulerAngleX;
    }
    if (typeof native.headEulerAngleY === 'number' && Number.isFinite(native.headEulerAngleY)) {
      observation.headEulerAngleY = native.headEulerAngleY;
    }
    if (typeof native.headEulerAngleZ === 'number' && Number.isFinite(native.headEulerAngleZ)) {
      observation.headEulerAngleZ = native.headEulerAngleZ;
    }
    observations.push(observation);
  }
  return observations;
}

function emptyFraming(state: FramingState): FramingAssessment {
  return {
    state,
    score: null,
    headRoll: null,
    headYaw: null,
    headPitch: null,
    centerOffsetX: null,
    centerOffsetY: null,
    faceHeightRatio: null,
  };
}

export function checkingFraming(): FramingAssessment {
  return emptyFraming('checking');
}

export function unavailableFraming(): FramingAssessment {
  return emptyFraming('unavailable');
}

export function checkingLighting(): LightingAssessment {
  return {
    state: 'checking',
    score: null,
    meanLuminance: null,
    sideDifference: null,
    clippedFraction: null,
  };
}

export function unavailableLighting(): LightingAssessment {
  return {
    state: 'unavailable',
    score: null,
    meanLuminance: null,
    sideDifference: null,
    clippedFraction: null,
  };
}

/**
 * Scores only capture geometry. It does not identify the person and does not
 * retain landmarks, contours, or a face template.
 */
export function assessFraming(
  faces: FaceObservation[],
  dimensions: ImageDimensions,
): FramingAssessment {
  if (
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return unavailableFraming();
  }
  if (faces.length === 0) return emptyFraming('no_face');
  if (faces.length > 1) return emptyFraming('multiple_faces');

  const face = faces[0]!;
  const { origin, size } = face.frame;
  if (![origin.x, origin.y, size.x, size.y].every(Number.isFinite) || size.x <= 0 || size.y <= 0) {
    return unavailableFraming();
  }

  const t = CAPTURE_ANALYSIS_TOLERANCE;
  const centerX = (origin.x + size.x / 2) / dimensions.width;
  const centerY = (origin.y + size.y / 2) / dimensions.height;
  const centerOffsetX = Math.abs(centerX - t.targetCenterX);
  const centerOffsetY = Math.abs(centerY - t.targetCenterY);
  const faceHeightRatio = size.y / dimensions.height;
  const headRoll = finiteOrNull(face.headEulerAngleZ);
  const headYaw = finiteOrNull(face.headEulerAngleY);
  const headPitch = finiteOrNull(face.headEulerAngleX);
  const poseSignalsPresent = headRoll !== null && headYaw !== null && headPitch !== null;

  const centerPenalty = clamp01(
    (centerOffsetX / t.maxCenterOffsetX + centerOffsetY / t.maxCenterOffsetY) / 2,
  );
  const scalePenalty = clamp01(
    Math.abs(faceHeightRatio - t.targetFaceHeightRatio) /
      (t.maxFaceHeightRatio - t.targetFaceHeightRatio),
  );
  const posePenalty = Math.max(
    headRoll == null ? 0 : clamp01(Math.abs(headRoll) / t.maxRollDegrees),
    headYaw == null ? 0 : clamp01(Math.abs(headYaw) / t.maxYawDegrees),
    headPitch == null ? 0 : clamp01(Math.abs(headPitch) / t.maxPitchDegrees),
  );
  const rawScore = clamp01(1 - centerPenalty * 0.45 - scalePenalty * 0.2 - posePenalty * 0.35);
  const poseWithinTolerance =
    poseSignalsPresent &&
    Math.abs(headRoll) <= t.maxRollDegrees &&
    Math.abs(headYaw) <= t.maxYawDegrees &&
    Math.abs(headPitch) <= t.maxPitchDegrees;
  const withinTolerance =
    centerOffsetX <= t.maxCenterOffsetX &&
    centerOffsetY <= t.maxCenterOffsetY &&
    faceHeightRatio >= t.minFaceHeightRatio &&
    faceHeightRatio <= t.maxFaceHeightRatio &&
    poseWithinTolerance;
  const matched = withinTolerance && rawScore >= t.matchedScore;
  const score = matched ? rawScore : Math.min(rawScore, t.matchedScore - 0.01);

  return {
    state: matched ? 'matched' : 'adjust',
    score,
    headRoll,
    headYaw,
    headPitch,
    centerOffsetX,
    centerOffsetY,
    faceHeightRatio,
  };
}

/**
 * Measures exposure and left/right balance from a small central RGBA sample.
 * The result is a capture-comparability hint, not a judgment about skin.
 */
export function assessLighting(image: RgbaImage): LightingAssessment {
  const { width, height, data } = image;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 1 ||
    height <= 1 ||
    data.length < width * height * 4
  ) {
    return unavailableLighting();
  }

  const xStart = Math.floor(width * 0.18);
  const xEnd = Math.max(xStart + 1, Math.ceil(width * 0.82));
  const yStart = Math.floor(height * 0.1);
  const yEnd = Math.max(yStart + 1, Math.ceil(height * 0.9));
  const midX = (xStart + xEnd) / 2;
  let total = 0;
  let count = 0;
  let leftTotal = 0;
  let leftCount = 0;
  let rightTotal = 0;
  let rightCount = 0;
  let clippedCount = 0;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = Number(data[offset + 3] ?? 0);
      if (alpha < 16) continue;
      const red = Number(data[offset] ?? 0);
      const green = Number(data[offset + 1] ?? 0);
      const blue = Number(data[offset + 2] ?? 0);
      if (![red, green, blue].every(Number.isFinite)) continue;
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      total += luminance;
      count += 1;
      if (x < midX) {
        leftTotal += luminance;
        leftCount += 1;
      } else {
        rightTotal += luminance;
        rightCount += 1;
      }
      if (luminance < 0.1 || luminance > 0.92) clippedCount += 1;
    }
  }

  if (count === 0 || leftCount === 0 || rightCount === 0) return unavailableLighting();

  const meanLuminance = total / count;
  const sideDifference = Math.abs(leftTotal / leftCount - rightTotal / rightCount);
  const clippedFraction = clippedCount / count;
  const t = CAPTURE_ANALYSIS_TOLERANCE;
  let state: LightingAssessmentState = 'good';
  if (meanLuminance < t.minGoodLuminance) state = 'too_dark';
  else if (meanLuminance > t.maxGoodLuminance) state = 'too_bright';
  else if (sideDifference > t.maxSideDifference || clippedFraction > t.maxClippedFraction) {
    state = 'uneven';
  }

  const exposureScore =
    meanLuminance <= 0.5
      ? clamp01((meanLuminance - 0.08) / 0.42)
      : clamp01((0.95 - meanLuminance) / 0.45);
  const balanceScore = 1 - clamp01(sideDifference / 0.35);
  const clippingScore = 1 - clamp01(clippedFraction / 0.5);
  const score = clamp01(exposureScore * 0.6 + balanceScore * 0.25 + clippingScore * 0.15);

  return { state, score, meanLuminance, sideDifference, clippedFraction };
}

export function captureAnalysisStatus(
  framing: FramingAssessment,
  lighting: LightingAssessment,
): CaptureAnalysisStatus {
  if (framing.state === 'checking' || lighting.state === 'checking') return 'checking';
  if (framing.state === 'unavailable' && lighting.state === 'unavailable') return 'unavailable';
  return 'complete';
}
