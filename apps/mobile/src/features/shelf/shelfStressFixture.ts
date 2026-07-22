import { Platform } from 'react-native';

import type { ExpiryBadge } from '@/features/intelligence/pao';

export const MAX_SHELF_E2E_STRESS_ITEMS = 250;

export type ShelfStressActiveRow = Readonly<{
  active: boolean;
  badge: ExpiryBadge;
  expiring: boolean;
  id: string;
  metaLine: string;
  name: string;
}>;

export type ShelfStressArchiveRow = Readonly<{
  createdAt: string;
  finishedAt: string | null;
  id: string;
  name: string;
  repurchaseCount: number;
  status: 'discarded' | 'finished';
}>;

export type ShelfStressFixture = Readonly<{
  activeRows: ShelfStressActiveRow[];
  archiveRows: ShelfStressArchiveRow[];
}>;

export function parseShelfE2EStressCount(value: string | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized || !/^\d{1,9}$/.test(normalized)) return null;
  const count = Number(normalized);
  if (!Number.isSafeInteger(count) || count > MAX_SHELF_E2E_STRESS_ITEMS) return null;
  return count;
}

function boundedCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(0, Math.floor(count)), MAX_SHELF_E2E_STRESS_ITEMS);
}

function stressBadge(index: number): ExpiryBadge {
  switch (index % 5) {
    case 0:
      return { kind: 'countdown', label: '6 days left' };
    case 1:
      return { kind: 'expired', label: 'expired' };
    case 2:
      return { kind: 'date', label: 'Oct' };
    case 3:
      return { kind: 'unknown', label: 'no date' };
    default:
      return { kind: 'paired', label: 'paired' };
  }
}

export function buildShelfE2EActiveRows(count: number): ShelfStressActiveRow[] {
  return Array.from({ length: boundedCount(count) }, (_, index) => {
    const ordinal = String(index + 1).padStart(4, '0');
    const badge = stressBadge(index);
    return {
      active: index % 3 === 0,
      badge,
      expiring: badge.kind === 'countdown' || badge.kind === 'expired',
      id: `e2e-shelf-stress-active-${ordinal}`,
      metaLine:
        index % 2 === 0
          ? `opened Jul · deterministic row ${ordinal}`
          : `added by hand · unopened · deterministic variable-height row ${ordinal}`,
      name: `Shelf stress product ${ordinal}`,
    };
  });
}

function isoDaysBeforeAnchor(days: number): string {
  const anchor = new Date('2026-07-21T12:00:00.000Z');
  anchor.setUTCDate(anchor.getUTCDate() - days);
  return anchor.toISOString();
}

export function buildShelfE2EArchiveRows(count: number): ShelfStressArchiveRow[] {
  return Array.from({ length: boundedCount(count) }, (_, index) => {
    const ordinal = String(index + 1).padStart(4, '0');
    return {
      createdAt: isoDaysBeforeAnchor(180 + index),
      finishedAt: isoDaysBeforeAnchor(index),
      id: `e2e-shelf-stress-archive-${ordinal}`,
      name: `Archive stress product ${ordinal}`,
      repurchaseCount: (index % 4) + 1,
      status: index % 2 === 0 ? 'finished' : 'discarded',
    };
  });
}

/** Exact development-web fixture; invalid values fail closed to production data. */
export function readShelfE2EStressFixture(): ShelfStressFixture | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || Platform.OS !== 'web') return null;

  const activeRaw = process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ACTIVE_COUNT;
  const archiveRaw = process.env.EXPO_PUBLIC_E2E_SHELF_STRESS_ARCHIVE_COUNT;
  const hasActive = Boolean(activeRaw?.trim());
  const hasArchive = Boolean(archiveRaw?.trim());
  if (!hasActive && !hasArchive) return null;

  const activeCount = hasActive ? parseShelfE2EStressCount(activeRaw) : 0;
  const archiveCount = hasArchive ? parseShelfE2EStressCount(archiveRaw) : 0;
  if (activeCount === null || archiveCount === null) return null;

  return {
    activeRows: buildShelfE2EActiveRows(activeCount),
    archiveRows: buildShelfE2EArchiveRows(archiveCount),
  };
}
