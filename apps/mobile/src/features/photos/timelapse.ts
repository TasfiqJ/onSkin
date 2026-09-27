import type { PhotoMeta } from './timeline';

export const TIMELAPSE_FRAME_DURATION_MS = 1_800;

export type TimelapseFrame = Pick<PhotoMeta, 'id' | 'localUri' | 'takenLocalDate'> & {
  localUri: string;
};

export function timelapseFrames(photos: PhotoMeta[]): TimelapseFrame[] {
  return photos
    .filter((photo): photo is PhotoMeta & { localUri: string } => Boolean(photo.localUri?.trim()))
    .slice()
    .sort(
      (left, right) =>
        left.takenLocalDate.localeCompare(right.takenLocalDate) || left.id.localeCompare(right.id),
    )
    .map(({ id, localUri, takenLocalDate }) => ({ id, localUri, takenLocalDate }));
}

/** In-memory controller identity. It is never persisted or emitted. */
export function timelapseFrameSignature(frames: readonly TimelapseFrame[]): string {
  return JSON.stringify(frames.map(({ id, localUri, takenLocalDate }) => [id, localUri, takenLocalDate]));
}

export function clampTimelapseIndex(index: number, frameCount: number): number {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(frameCount - 1, Math.max(0, Math.trunc(index)));
}

export function nextTimelapseIndex(index: number, frameCount: number): number {
  return clampTimelapseIndex(index + 1, frameCount);
}

export function previousTimelapseIndex(index: number, frameCount: number): number {
  return clampTimelapseIndex(index - 1, frameCount);
}

export function timelapseProgress(index: number, frameCount: number): number {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 1) return frameCount === 1 ? 1 : 0;
  return clampTimelapseIndex(index, frameCount) / (frameCount - 1);
}
