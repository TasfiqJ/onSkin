import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { TREND_CANDIDATE_CLASSIFIER_QUARANTINED } from './trend';

describe('legacy Trend classifier quarantine', () => {
  it('exports only an inert quarantine marker and contains no threshold or classifier', () => {
    expect(TREND_CANDIDATE_CLASSIFIER_QUARANTINED).toBe(true);
    const source = readFileSync(fileURLToPath(new URL('./trend.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/export function/u);
    expect(source).not.toMatch(/BASE_MDC|toneAdjustmentFactor|classifyChange|deltaMetric/u);
  });
});
