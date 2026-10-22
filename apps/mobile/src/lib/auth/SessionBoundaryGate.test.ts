import { createElement, type ComponentType } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { SessionBoundaryGate } from './SessionBoundaryGate';

const auth = vi.hoisted(() => ({
  initializing: false,
  sessionBoundaryError: true,
  retrySessionBoundary: vi.fn<() => Promise<void>>(),
}));
vi.mock('./AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@/components/ui', () => ({ Text: 'Text' }));
vi.mock('@/lib/observability/operationTiming', () => ({ markStartupPhase: vi.fn() }));

it('owns repeated rejected retry events, hides private children, and opens only after Auth commits', async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const pressable = 'Pressable' as unknown as ComponentType;
  const privateData = 'PrivateData' as unknown as ComponentType;
  auth.retrySessionBoundary.mockRejectedValue(
    new Error('EXPLICIT_SIGN_OUT_LOCAL_BOUNDARY_INCOMPLETE'),
  );
  let view!: ReturnType<typeof create>;
  const element = () => createElement(SessionBoundaryGate, null, createElement('PrivateData'));
  await act(async () => {
    view = create(element());
  });
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await act(async () => {
        // An event handler returns void. Vitest also fails on any unhandled rejection.
        expect(view.root.findByType(pressable).props.onPress()).toBeUndefined();
        await Promise.resolve();
      });
      expect(view.root.findAllByType(privateData)).toHaveLength(0);
      expect(view.root.findByType(pressable)).toBeTruthy();
    }
    auth.retrySessionBoundary.mockImplementation(async () => {
      auth.sessionBoundaryError = false;
    });
    await act(async () => {
      view.root.findByType(pressable).props.onPress();
      await Promise.resolve();
      view.update(element());
    });
    expect(view.root.findAllByType(privateData)).toHaveLength(1);
  } finally {
    await act(async () => view.unmount());
  }
});
