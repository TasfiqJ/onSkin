import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));
const FEATURE_DIR = fileURLToPath(new URL('./', import.meta.url));

function readRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('direct Progress photo source ownership', () => {
  it('owns one date boundary and one photo observer per focused route', () => {
    const source = readFileSync(`${FEATURE_DIR}/ProgressPhotoRouteSource.tsx`, 'utf8');

    expect(source.match(/useLocalDateBoundary\(\)/g)).toHaveLength(1);
    expect(source.match(/usePhotosFromBoundary\(boundary, 'front'\)/g)).toHaveLength(1);
    expect(source).toContain('<PhotoStorageBoundary query={query} onExit={onExit}>');
    expect(source).toContain('{query.data ? children(query.data) : null}');
  });

  it('injects the shared snapshot into capture, review, and detail content', () => {
    for (const path of ['progress/capture.tsx', 'progress/review.tsx', 'progress/[id].tsx']) {
      const route = readRoute(path);

      expect(route).toContain(
        "import { ProgressPhotoRouteSource } from '@/features/photos/ProgressPhotoRouteSource';",
      );
      expect(route).toContain('<ProgressPhotoRouteSource');
      expect(route).toContain('</ProgressPhotoRouteSource>');
      expect(route).not.toContain("usePhotos('front')");
      expect(route).not.toContain("from '@/features/photos/PhotoStorageGate'");
    }

    expect(readRoute('progress/capture.tsx')).toContain('<CaptureScreenContent photos={photos} />');
    expect(readRoute('progress/review.tsx')).toContain('photos={photos}');
    expect(readRoute('progress/[id].tsx')).toContain(
      '<PhotoDetailScreenContent photos={photos} />',
    );
  });

  it('keeps Review plaintext cleanup ownership outside every conditional source gate', () => {
    const review = readRoute('progress/review.tsx');

    expect(review.indexOf('usePreventRemove(Boolean(captureSessionId)')).toBeLessThan(
      review.indexOf('<ProgressPhotoRouteSource'),
    );
    expect(review.indexOf('<PhotoTimelineLockGate>')).toBeLessThan(
      review.indexOf('<ProgressPhotoRouteSource'),
    );
  });
});
