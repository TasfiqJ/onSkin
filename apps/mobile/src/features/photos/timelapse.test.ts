import { describe, expect, it } from 'vitest';

import type { PhotoMeta } from './timeline';
import {
  clampTimelapseIndex,
  nextTimelapseIndex,
  previousTimelapseIndex,
  timelapseFrames,
  timelapseProgress,
} from './timelapse';

function photo(id: string, takenLocalDate: string, localUri: string | null): PhotoMeta {
  return {
    id,
    series: 'front',
    takenLocalDate,
    timeOfDay: 'morning',
    alignmentScore: null,
    lightingScore: null,
    isReference: false,
    referencePhotoId: null,
    localUri,
    notes: null,
  };
}

describe('photo time-lapse', () => {
  it('plays only real local frames in deterministic oldest-to-newest order', () => {
    expect(
      timelapseFrames([
        photo('latest', '2026-06-24', 'file:///latest.onskinphoto'),
        photo('missing', '2026-05-01', null),
        photo('same-day-b', '2026-04-01', 'file:///b.onskinphoto'),
        photo('blank', '2026-03-01', '   '),
        photo('same-day-a', '2026-04-01', 'file:///a.onskinphoto'),
      ]),
    ).toEqual([
      {
        id: 'same-day-a',
        takenLocalDate: '2026-04-01',
        localUri: 'file:///a.onskinphoto',
      },
      {
        id: 'same-day-b',
        takenLocalDate: '2026-04-01',
        localUri: 'file:///b.onskinphoto',
      },
      {
        id: 'latest',
        takenLocalDate: '2026-06-24',
        localUri: 'file:///latest.onskinphoto',
      },
    ]);
  });

  it('clamps invalid and out-of-range frame positions', () => {
    expect(clampTimelapseIndex(-2, 3)).toBe(0);
    expect(clampTimelapseIndex(1.9, 3)).toBe(1);
    expect(clampTimelapseIndex(9, 3)).toBe(2);
    expect(clampTimelapseIndex(Number.NaN, 3)).toBe(0);
    expect(clampTimelapseIndex(1, 0)).toBe(0);
  });

  it('steps without wrapping past either endpoint', () => {
    expect(previousTimelapseIndex(0, 3)).toBe(0);
    expect(previousTimelapseIndex(2, 3)).toBe(1);
    expect(nextTimelapseIndex(0, 3)).toBe(1);
    expect(nextTimelapseIndex(2, 3)).toBe(2);
  });

  it('reports bounded progress across the finite sequence', () => {
    expect(timelapseProgress(0, 0)).toBe(0);
    expect(timelapseProgress(0, 1)).toBe(1);
    expect(timelapseProgress(0, 3)).toBe(0);
    expect(timelapseProgress(1, 3)).toBe(0.5);
    expect(timelapseProgress(9, 3)).toBe(1);
  });
});
