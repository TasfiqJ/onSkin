import { beforeEach, describe, expect, it, vi } from 'vitest';

import { focusTimelapseElementAfterLayout } from './timelapseFocus';

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  focus: vi.fn(),
  nextFrame: null as FrameRequestCallback | null,
}));

vi.mock('react-native', () => ({
  AccessibilityInfo: { setAccessibilityFocus: (...args: unknown[]) => mocks.focus(...args) },
  findNodeHandle: (element: { handle?: number } | null) => element?.handle ?? null,
}));

describe('time-lapse focus transfer', () => {
  beforeEach(() => {
    mocks.cancel.mockReset();
    mocks.focus.mockReset();
    mocks.nextFrame = null;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        mocks.nextFrame = callback;
        return 41;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', mocks.cancel);
  });

  it.each([
    ['modal heading', 71],
    ['parent trigger after modal close', 72],
  ])('moves accessibility focus to the %s after layout', (_label, handle) => {
    const cancel = focusTimelapseElementAfterLayout(
      () => ({ handle }) as unknown as import('react-native').View,
    );

    expect(mocks.focus).not.toHaveBeenCalled();
    mocks.nextFrame?.(0);
    expect(mocks.focus).toHaveBeenCalledWith(handle);
    cancel();
    expect(mocks.cancel).toHaveBeenCalledWith(41);
  });
});
