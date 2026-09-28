import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const progress = readFileSync(
  resolve(import.meta.dirname, '../../app/(tabs)/progress.tsx'),
  'utf8',
);
const compare = readFileSync(resolve(import.meta.dirname, 'CompareSlider.tsx'), 'utf8');
const timelapse = readFileSync(resolve(import.meta.dirname, 'PhotoTimelapse.tsx'), 'utf8');
const detail = readFileSync(resolve(import.meta.dirname, '../../app/progress/[id].tsx'), 'utf8');

describe('Progress sensitive image demand integration', () => {
  it('virtualizes comparison picker and timeline demand', () => {
    expect(progress).toContain('<FlatList');
    expect(progress).toContain('<SectionList');
    expect(progress).toContain('viewabilityConfig={PHOTO_VIEWABILITY_CONFIG}');
    expect(progress).toContain('active={which !== null && visiblePhotoIds.has(photo.id)}');
    expect(progress).toContain('active={!timelapseVisible && visibleRowKeys.has(item.key)}');
    expect(progress).toContain('uri={photo.thumbnailLocalUri ?? photo.localUri}');
    expect(progress).not.toContain('{data.monthGroups.map(');
  });

  it('uses opaque identities for every persisted display surface', () => {
    expect(progress).toContain('photoId={photo.id}');
    expect(compare).toContain('photoId={photo.id}');
    expect(timelapse).toContain('photoId={current.id}');
    expect(compare).toContain('active={active}');
  });

  it('pauses comparison and timeline images below modal overlays', () => {
    expect(progress).toContain('active={picking === null}');
    expect(progress).toContain('active={!timelapseVisible && visibleRowKeys.has(item.key)}');
  });

  it('purges decrypted image memory before leaving a deleted photo', () => {
    const deletePhoto = detail.indexOf('await remove.mutateAsync(id)');
    const purgeMemory = detail.indexOf('await purgeSensitiveImageMemory()');
    const leaveDetail = detail.indexOf('closeToProgress()', purgeMemory);

    expect(deletePhoto).toBeGreaterThan(-1);
    expect(purgeMemory).toBeGreaterThan(deletePhoto);
    expect(leaveDetail).toBeGreaterThan(purgeMemory);
  });
});
