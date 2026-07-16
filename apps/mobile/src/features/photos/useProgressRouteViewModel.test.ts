import { describe, expect, it, vi } from 'vitest';

import { useProgressRouteViewModel } from './useProgressRouteViewModel';

const mocks = vi.hoisted(() => ({
  photos: { data: { count: 3 }, isSuccess: true },
  usePhotosFromBoundary: vi.fn(),
}));

vi.mock('./usePhotos', () => ({
  usePhotosFromBoundary: mocks.usePhotosFromBoundary,
}));

describe('Progress route view model', () => {
  it('owns exactly one photo observer from the supplied local-day boundary', () => {
    const boundary = {
      localDate: '2026-07-15',
      timeZone: 'America/Toronto',
    } as const;
    mocks.usePhotosFromBoundary.mockReset();
    mocks.usePhotosFromBoundary.mockReturnValue(mocks.photos);

    const result = useProgressRouteViewModel(boundary);

    expect(mocks.usePhotosFromBoundary).toHaveBeenCalledExactlyOnceWith(boundary, 'front');
    expect(result).toEqual({ photos: mocks.photos });
  });
});
