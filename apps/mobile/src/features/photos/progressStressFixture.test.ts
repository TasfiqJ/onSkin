import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROGRESS_E2E_PHOTOS,
  MAX_PROGRESS_E2E_PHOTOS,
  buildProgressE2EPhotos,
  parseProgressE2EPhotoCount,
} from './progressStressFixture';
import { defaultComparePair, forSeries, groupByMonth, metadataLine } from './timeline';

const FIXTURE_URI = 'data:image/png;base64,c2FuaXRpemVk';

describe('Progress collection stress fixture', () => {
  it('parses only explicit bounded development cardinalities', () => {
    expect(parseProgressE2EPhotoCount(undefined)).toBeNull();
    expect(parseProgressE2EPhotoCount('')).toBeNull();
    expect(parseProgressE2EPhotoCount('not-a-count')).toBeNull();
    expect(parseProgressE2EPhotoCount('-1')).toBeNull();
    expect(parseProgressE2EPhotoCount('populated')).toBe(DEFAULT_PROGRESS_E2E_PHOTOS);
    expect([0, 1, 2, 10, 50, 100, 250].map((count) => parseProgressE2EPhotoCount(`${count}`))).toEqual(
      [0, 1, 2, 10, 50, 100, 250],
    );
    expect(parseProgressE2EPhotoCount('251')).toBeNull();
    expect(parseProgressE2EPhotoCount('999')).toBeNull();
  });

  it('retains the historical populated route identities and dates', () => {
    const photos = buildProgressE2EPhotos(DEFAULT_PROGRESS_E2E_PHOTOS, FIXTURE_URI);

    expect(photos.map((photo) => photo.id)).toEqual([
      'e2e-front-2026-04-01',
      'e2e-front-2026-05-12',
      'e2e-front-2026-06-24',
    ]);
    expect(photos.map((photo) => photo.takenLocalDate)).toEqual([
      '2026-04-01',
      '2026-05-12',
      '2026-06-24',
    ]);
    expect(photos.map((photo) => photo.alignmentScore)).toEqual([0.92, 0.9, 0.94]);
    expect(photos.map((photo) => photo.lightingScore)).toEqual([0.88, 0.9, 0.91]);
    expect(photos.every((photo) => photo.captureSessionId === 'e2e-progress-compare-picker')).toBe(
      true,
    );
  });

  it('builds deterministic unique weekly rows through the engineering ceiling', () => {
    for (const count of [0, 1, 2, 10, 50, 100, 250]) {
      const first = buildProgressE2EPhotos(count, FIXTURE_URI);
      const second = buildProgressE2EPhotos(count, FIXTURE_URI);

      expect(first).toEqual(second);
      expect(first).toHaveLength(count);
      expect(new Set(first.map((photo) => photo.id)).size).toBe(count);
      expect(new Set(first.map((photo) => photo.takenLocalDate)).size).toBe(count);
      expect(first.every((photo) => photo.localUri === FIXTURE_URI)).toBe(true);
      expect(first.every((photo) => photo.notes === null && photo.localOnly)).toBe(true);
      expect(first.filter((photo) => photo.isReference)).toHaveLength(count === 0 ? 0 : 1);
      expect(
        first.every(
          (photo, index) =>
            photo.referencePhotoId === (index === 0 ? null : first[0]!.id),
        ),
      ).toBe(true);

      if (count > 1 && count !== DEFAULT_PROGRESS_E2E_PHOTOS) {
        const intervals = first.slice(1).map((photo, index) => {
          const previous = new Date(`${first[index]!.takenLocalDate}T12:00:00.000Z`).getTime();
          const current = new Date(`${photo.takenLocalDate}T12:00:00.000Z`).getTime();
          return (current - previous) / 86_400_000;
        });
        expect(intervals.every((interval) => interval === 7)).toBe(true);
      }
    }
  });

  it('derives complete 100-photo and 250-photo chronological collections', () => {
    const hundred = buildProgressE2EPhotos(100, FIXTURE_URI);
    const hundredSeries = forSeries(hundred, 'front');
    const hundredMetadata = metadataLine(hundred);
    const hundredPair = defaultComparePair(hundred, { series: 'front' });
    const hundredMonths = groupByMonth(hundred, 'front', '2026-06-24');
    const stress = buildProgressE2EPhotos(250, FIXTURE_URI);
    const stressSeries = forSeries(stress, 'front');
    const stressMetadata = metadataLine(stress);
    const stressPair = defaultComparePair(stress, { series: 'front' });

    expect(hundred).toHaveLength(100);
    expect(hundredSeries).toHaveLength(100);
    expect(hundredMetadata.text).toContain('100 photos');
    expect(hundredPair?.before.id).toBe('e2e-front-stress-0001');
    expect(hundredPair?.after.id).toBe('e2e-front-stress-0100');
    expect(hundredMonths.flatMap((group) => group.photos)).toHaveLength(100);

    expect(stress).toHaveLength(MAX_PROGRESS_E2E_PHOTOS);
    expect(stressSeries).toHaveLength(MAX_PROGRESS_E2E_PHOTOS);
    expect(stressMetadata.text).toContain('250 photos');
    expect(stressPair?.after.id).toBe('e2e-front-stress-0250');
  });
});
