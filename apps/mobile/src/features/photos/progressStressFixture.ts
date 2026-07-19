import type { PhotoRecord } from './store';

export const DEFAULT_PROGRESS_E2E_PHOTOS = 3;
export const MAX_PROGRESS_E2E_PHOTOS = 250;

const STRESS_ANCHOR_LOCAL_DATE = '2026-06-24';
const LEGACY_POPULATED_DATES = ['2026-04-01', '2026-05-12', STRESS_ANCHOR_LOCAL_DATE] as const;
const LEGACY_POPULATED_IDS = [
  'e2e-front-2026-04-01',
  'e2e-front-2026-05-12',
  'e2e-front-2026-06-24',
] as const;

/**
 * Parses the explicit development-only Progress collection fixture.
 * `populated` retains the historical three-photo scenario; integer values cover
 * the plan's 0/1/2/10/50/100 and engineering-stress cardinalities.
 */
export function parseProgressE2EPhotoCount(value: string | undefined): number | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'populated') return DEFAULT_PROGRESS_E2E_PHOTOS;
  if (!/^\d{1,9}$/.test(normalized)) return null;

  const count = Number(normalized);
  if (!Number.isSafeInteger(count) || count > MAX_PROGRESS_E2E_PHOTOS) return null;
  return count;
}

function localDateDaysBefore(anchorYmd: string, days: number): string {
  const anchor = new Date(`${anchorYmd}T12:00:00.000Z`);
  anchor.setUTCDate(anchor.getUTCDate() - days);
  return anchor.toISOString().slice(0, 10);
}

function fixturePhoto({
  date,
  id,
  isReference,
  localUri,
  referencePhotoId,
  alignmentScore = 0.92,
  captureSessionId = 'e2e-progress-stress',
  lightingScore = 0.9,
}: {
  date: string;
  id: string;
  isReference: boolean;
  localUri: string;
  referencePhotoId: string | null;
  alignmentScore?: number;
  captureSessionId?: string;
  lightingScore?: number;
}): PhotoRecord {
  return {
    id,
    series: 'front',
    takenLocalDate: date,
    takenAt: `${date}T12:00:00.000Z`,
    timeOfDay: 'morning',
    alignmentScore,
    lightingScore,
    qualitySource: null,
    isReference,
    referencePhotoId,
    localUri,
    notes: null,
    captureSessionId,
    headRoll: null,
    headYaw: null,
    headPitch: null,
    localOnly: true,
    storagePath: null,
    faceRegionRedacted: false,
    isEncrypted: false,
    encryptedLocalUri: null,
    thumbnailLocalUri: null,
    encryptionVersion: 'none',
    keyId: null,
  };
}

/** Returns oldest-to-newest deterministic metadata with one shared tiny image. */
export function buildProgressE2EPhotos(count: number, localUri: string): PhotoRecord[] {
  const boundedCount = Math.min(
    Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0),
    MAX_PROGRESS_E2E_PHOTOS,
  );
  if (boundedCount === 0) return [];

  if (boundedCount === DEFAULT_PROGRESS_E2E_PHOTOS) {
    const referencePhotoId = LEGACY_POPULATED_IDS[0];
    const alignmentScores = [0.92, 0.9, 0.94] as const;
    const lightingScores = [0.88, 0.9, 0.91] as const;
    return LEGACY_POPULATED_IDS.map((id, index) =>
      fixturePhoto({
        alignmentScore: alignmentScores[index]!,
        captureSessionId: 'e2e-progress-compare-picker',
        date: LEGACY_POPULATED_DATES[index]!,
        id,
        isReference: index === 0,
        lightingScore: lightingScores[index]!,
        localUri,
        referencePhotoId: index === 0 ? null : referencePhotoId,
      }),
    );
  }

  const referencePhotoId = 'e2e-front-stress-0001';
  return Array.from({ length: boundedCount }, (_, index) => {
    const date = localDateDaysBefore(STRESS_ANCHOR_LOCAL_DATE, (boundedCount - 1 - index) * 7);
    return fixturePhoto({
      date,
      id: `e2e-front-stress-${String(index + 1).padStart(4, '0')}`,
      isReference: index === 0,
      localUri,
      referencePhotoId: index === 0 ? null : referencePhotoId,
    });
  });
}
