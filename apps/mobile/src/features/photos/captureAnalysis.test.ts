import { describe, expect, it } from 'vitest';

import {
  assessFraming,
  assessLighting,
  CAPTURE_ANALYSIS_TOLERANCE,
  captureAnalysisStatus,
  checkingFraming,
  checkingLighting,
  unavailableFraming,
  unavailableLighting,
  validatedFaceObservations,
  type FaceObservation,
  type RgbaImage,
} from './captureAnalysis';

describe('face detector result validation', () => {
  it('rejects structured failures instead of treating them as no-face results', () => {
    expect(validatedFaceObservations(undefined)).toBeNull();
    expect(validatedFaceObservations({ success: false, faces: [] })).toBeNull();
    expect(validatedFaceObservations({ success: true, faces: [] })).toEqual([]);
  });

  it('copies only finite framing and Euler fields from the native result', () => {
    const result = validatedFaceObservations({
      success: true,
      faces: [
        {
          frame: { origin: { x: 1, y: 2 }, size: { x: 3, y: 4 } },
          headEulerAngleX: 5,
          headEulerAngleY: Number.NaN,
          headEulerAngleZ: -2,
          trackingID: 42,
          landmarks: [{ type: 'eye' }],
          imagePath: 'file:///private/photo.jpg',
        },
      ],
    });

    expect(result).toEqual([
      {
        frame: { origin: { x: 1, y: 2 }, size: { x: 3, y: 4 } },
        headEulerAngleX: 5,
        headEulerAngleZ: -2,
      },
    ]);
  });
});

function face(overrides: Partial<FaceObservation> = {}): FaceObservation {
  return {
    frame: {
      origin: { x: 250, y: 180 },
      size: { x: 500, y: 560 },
    },
    headEulerAngleX: 1,
    headEulerAngleY: 2,
    headEulerAngleZ: -1,
    ...overrides,
  };
}

function solidImage(value: number, width = 10, height = 10): RgbaImage & { data: Uint8Array } {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return { width, height, data };
}

describe('captured-photo framing analysis', () => {
  it('accepts one centered, well-sized, forward-facing face', () => {
    const result = assessFraming([face()], { width: 1000, height: 1000 });

    expect(result.state).toBe('matched');
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.headYaw).toBe(2);
    expect(result.faceHeightRatio).toBeCloseTo(0.56);
  });

  it('asks for adjustment when center or pose exceeds tolerance', () => {
    const result = assessFraming(
      [
        face({
          frame: { origin: { x: 620, y: 180 }, size: { x: 300, y: 560 } },
          headEulerAngleY: 22,
        }),
      ],
      { width: 1000, height: 1000 },
    );

    expect(result.state).toBe('adjust');
    expect(result.score).toBeLessThan(0.72);
  });

  it('never assigns a matched-range score when a hard framing bound fails', () => {
    const result = assessFraming(
      [face({ frame: { origin: { x: 411, y: 180 }, size: { x: 500, y: 560 } } })],
      { width: 1000, height: 1000 },
    );

    expect(result.state).toBe('adjust');
    expect(result.score).toBeLessThan(0.72);
  });

  it('never matches when any pose angle is missing or nonfinite', () => {
    for (const candidate of [
      face({ headEulerAngleX: undefined }),
      face({ headEulerAngleY: null }),
      face({ headEulerAngleZ: Number.POSITIVE_INFINITY }),
      face({
        headEulerAngleX: undefined,
        headEulerAngleY: undefined,
        headEulerAngleZ: undefined,
      }),
    ]) {
      const result = assessFraming([candidate], { width: 1000, height: 1000 });
      expect(result.state).toBe('adjust');
      expect(result.score).toBeLessThan(CAPTURE_ANALYSIS_TOLERANCE.matchedScore);
    }
  });

  it('distinguishes no face, multiple faces, and invalid geometry', () => {
    expect(assessFraming([], { width: 1000, height: 1000 }).state).toBe('no_face');
    expect(assessFraming([face(), face()], { width: 1000, height: 1000 }).state).toBe(
      'multiple_faces',
    );
    expect(assessFraming([face()], { width: 0, height: 1000 }).state).toBe('unavailable');
  });
});

describe('captured-photo lighting analysis', () => {
  it('accepts a balanced mid-luminance sample', () => {
    const result = assessLighting(solidImage(145));

    expect(result.state).toBe('good');
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.sideDifference).toBeCloseTo(0);
  });

  it('flags genuinely dark and bright samples without skin judgments', () => {
    expect(assessLighting(solidImage(35)).state).toBe('too_dark');
    expect(assessLighting(solidImage(230)).state).toBe('too_bright');
  });

  it('flags strong left-to-right imbalance', () => {
    const image = solidImage(60, 20, 10);
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 10; x < image.width; x += 1) {
        const offset = (y * image.width + x) * 4;
        image.data[offset] = 210;
        image.data[offset + 1] = 210;
        image.data[offset + 2] = 210;
      }
    }

    const result = assessLighting(image);
    expect(result.state).toBe('uneven');
    expect(result.sideDifference).toBeGreaterThan(0.22);
  });

  it('flags widespread mixed clipping even when average brightness is balanced', () => {
    const image = solidImage(0, 20, 10);
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 2) {
        const offset = (y * image.width + x) * 4;
        image.data[offset] = 255;
        image.data[offset + 1] = 255;
        image.data[offset + 2] = 255;
      }
    }

    const result = assessLighting(image);
    expect(result.meanLuminance).toBeGreaterThan(0.45);
    expect(result.meanLuminance).toBeLessThan(0.55);
    expect(result.clippedFraction).toBeGreaterThan(0.38);
    expect(result.state).toBe('uneven');
  });

  it('fails closed for malformed pixel buffers', () => {
    expect(assessLighting({ width: 10, height: 10, data: new Uint8Array(4) }).state).toBe(
      'unavailable',
    );
  });
});

describe('combined analysis status', () => {
  it('stays checking while either measurement is pending', () => {
    expect(captureAnalysisStatus(checkingFraming(), unavailableLighting())).toBe('checking');
    expect(captureAnalysisStatus(unavailableFraming(), checkingLighting())).toBe('checking');
  });

  it('is unavailable only when neither measurement completed', () => {
    expect(captureAnalysisStatus(unavailableFraming(), unavailableLighting())).toBe('unavailable');
    expect(
      captureAnalysisStatus(
        { ...unavailableFraming(), state: 'no_face' },
        { ...unavailableLighting(), state: 'good', score: 0.8 },
      ),
    ).toBe('complete');
  });
});
