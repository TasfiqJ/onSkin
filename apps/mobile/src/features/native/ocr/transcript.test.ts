import { describe, expect, it } from 'vitest';

import {
  LABEL_OCR_MAX_TRANSCRIPT_UTF8_BYTES,
  type LabelOcrNativeResponse,
  type LabelOcrObservation,
} from './contract';
import { buildLabelOcrTranscript, confidenceCueForObservation } from './transcript';

function observation(
  text: string,
  x: number,
  y: number,
  width = 0.3,
  height = 0.08,
  confidence = 0.9,
  alternative?: { text: string; confidence: number },
): LabelOcrObservation {
  return {
    boundingBox: { x, y, width, height },
    candidates: [{ text, confidence }, ...(alternative === undefined ? [] : [alternative])],
  };
}

function recognized(observations: readonly LabelOcrObservation[]): LabelOcrNativeResponse {
  return {
    schemaVersion: 1,
    requestId: '10000000-0000-4000-8000-000000000001',
    status: 'recognized',
    truncated: false,
    observations,
  };
}

describe('label OCR transcript construction', () => {
  it('orders lower-left Vision geometry by overlapping rows and then left-to-right', () => {
    const result = buildLabelOcrTranscript(
      recognized([
        observation('bottom', 0.1, 0.2),
        observation('right', 0.55, 0.78, 0.35, 0.08),
        observation('left', 0.1, 0.8, 0.35, 0.1),
      ]),
    );

    expect(result.text).toBe('left\nright\nbottom');
    expect(result.lines.map((line) => line.sourceObservationIndex)).toEqual([2, 1, 0]);
  });

  it.each([
    ['Arabic', 'ماء', 'جلسرين'],
    ['Hebrew', 'מים', 'גליצרין'],
  ])('orders split %s observations right-to-left within one visual row', (_script, right, left) => {
    const result = buildLabelOcrTranscript(
      recognized([
        observation(right, 0.62, 0.8, 0.28, 0.1),
        observation(left, 0.1, 0.8, 0.28, 0.1),
      ]),
    );

    expect(result.text).toBe(`${right}\n${left}`);
    expect(result.lines.map((line) => line.sourceObservationIndex)).toEqual([0, 1]);
  });

  it('does not treat Arabic-Indic digits as a strong RTL letter', () => {
    const result = buildLabelOcrTranscript(
      recognized([
        observation('١٠', 0.72, 0.8, 0.18, 0.1),
        observation('Aqua', 0.08, 0.8, 0.24, 0.1),
        observation('Glycerin', 0.38, 0.8, 0.28, 0.1),
      ]),
    );

    expect(result.text).toBe('Aqua\nGlycerin\n١٠');
    expect(result.lines.map((line) => line.sourceObservationIndex)).toEqual([1, 2, 0]);
  });

  it('keeps multilingual NFC text and exposes close alternatives without percentages', () => {
    const line = observation('Café · 水 · ماء', 0.1, 0.8, 0.8, 0.1, 0.88, {
      text: 'Café · 氷 · ماء',
      confidence: 0.81,
    });
    const result = buildLabelOcrTranscript(recognized([line]));

    expect(result.text).toBe('Café · 水 · ماء');
    expect(result.confidenceCue).toBe('ambiguous');
    expect(result.lines[0]).toMatchObject({
      confidenceCue: 'ambiguous',
      alternativeText: 'Café · 氷 · ماء',
    });
    expect(JSON.stringify(result)).not.toContain('%');
  });

  it('uses categorical low-confidence and ambiguity rules', () => {
    expect(confidenceCueForObservation(observation('Water', 0, 0, 0.2, 0.1, 0.79))).toBe('review');
    expect(confidenceCueForObservation(observation('Water', 0, 0, 0.2, 0.1, 0.8))).toBe('clear');
    expect(
      confidenceCueForObservation(
        observation('Water', 0, 0, 0.2, 0.1, 0.95, { text: 'Waler', confidence: 0.86 }),
      ),
    ).toBe('ambiguous');
  });

  it('bounds the editable transcript on a Unicode-scalar boundary and marks truncation', () => {
    const longLine = '水'.repeat(512);
    const observations = Array.from({ length: 30 }, (_, index) =>
      observation(`${longLine}${index}`, 0.1, 0.8, 0.8, 0.1),
    );
    const result = buildLabelOcrTranscript(recognized(observations));

    expect(new TextEncoder().encode(result.text).byteLength).toBeLessThanOrEqual(
      LABEL_OCR_MAX_TRANSCRIPT_UTF8_BYTES,
    );
    expect(result.text.endsWith('\ud800')).toBe(false);
    expect(result.truncated).toBe(true);
  });
});
