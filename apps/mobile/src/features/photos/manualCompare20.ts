import type { PhotoMeta } from './timeline';

export type ManualCompare20Selection = { beforeId?: string; afterId?: string };
export type ManualCompare20Result<T> =
  | { status: 'empty' | 'sparse' | 'missing' | 'unavailable' }
  | { status: 'ready'; before: T; after: T; sameDay: boolean };

/** Current metadata only. IDs never establish time order; a day has no exact ordering. */
export function manualCompare20<T extends PhotoMeta>(
  photos: readonly T[],
  selection: ManualCompare20Selection = {},
): ManualCompare20Result<T> {
  const current = photos.filter((photo) => photo.series === 'front');
  const ids = new Set<string>();
  for (const photo of current) {
    if (!photo.id || ids.has(photo.id) || !/^\d{4}-\d{2}-\d{2}$/.test(photo.takenLocalDate)) {
      return { status: 'unavailable' };
    }
    const day = new Date(`${photo.takenLocalDate}T12:00:00Z`);
    if (
      !Number.isFinite(day.getTime()) ||
      day.toISOString().slice(0, 10) !== photo.takenLocalDate
    ) {
      return { status: 'unavailable' };
    }
    ids.add(photo.id);
  }
  if (
    (selection.beforeId && !ids.has(selection.beforeId)) ||
    (selection.afterId && !ids.has(selection.afterId))
  ) {
    return { status: 'missing' };
  }
  if (current.length < 2) return { status: current.length ? 'sparse' : 'empty' };
  const ordered = [...current].sort((a, b) => a.takenLocalDate.localeCompare(b.takenLocalDate));
  let before = selection.beforeId
    ? current.find((photo) => photo.id === selection.beforeId)!
    : ordered[0]!;
  let after = selection.afterId
    ? current.find((photo) => photo.id === selection.afterId)!
    : ordered[ordered.length - 1]!;
  if (before.id === after.id) return { status: 'missing' };
  if (before.takenLocalDate > after.takenLocalDate) [before, after] = [after, before];
  return {
    status: 'ready',
    before,
    after,
    sameDay: before.takenLocalDate === after.takenLocalDate,
  };
}

/** Revalidate membership and distinctness even if a disabled row's old callback is invoked. */
export function chooseManualCompare20<T extends PhotoMeta>(
  photos: readonly T[],
  selection: ManualCompare20Selection,
  which: 'before' | 'after',
  id: string,
): ManualCompare20Selection | null {
  const pair = manualCompare20(photos, selection);
  if (
    pair.status !== 'ready' ||
    !photos.some((photo) => photo.series === 'front' && photo.id === id)
  )
    return null;
  if (id === (which === 'before' ? pair.after.id : pair.before.id)) return null;
  const next = {
    beforeId: pair.before.id,
    afterId: pair.after.id,
    [which === 'before' ? 'beforeId' : 'afterId']: id,
  };
  const resolved = manualCompare20(photos, next);
  return resolved.status === 'ready'
    ? { beforeId: resolved.before.id, afterId: resolved.after.id }
    : null;
}
